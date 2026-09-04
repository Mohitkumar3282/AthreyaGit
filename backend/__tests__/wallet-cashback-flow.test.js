import { jest } from "@jest/globals";

const mockStartSession = jest.fn();
const mockOrderFindOne = jest.fn();

const mockCreateLedgerEntry = jest.fn();
const mockCreateFinanceAuditLog = jest.fn();
const mockCreditWallet = jest.fn();
const mockDebitWallet = jest.fn();
const mockGetCustomerBalance = jest.fn();
const mockGetOrCreateWallet = jest.fn();
const mockUpdateCashInHand = jest.fn();
const mockCreatePendingPayoutForOrder = jest.fn();
const mockCreditCoins = jest.fn();
const mockDebitCoins = jest.fn();
const mockGetCoinBalance = jest.fn();

function createSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
}

function makeOrder(overrides = {}) {
  return {
    _id: "order-1",
    orderId: "ORD10001",
    customer: "cust-1",
    paymentMode: "COD",
    paymentStatus: "CASH_COLLECTED",
    status: "out_for_delivery",
    orderStatus: "out_for_delivery",
    seller: "seller-1",
    deliveryBoy: "rider-1",
    payment: { method: "cash", status: "pending" },
    paymentBreakdown: {
      grandTotal: 300,
      productSavings: 100,
      discountTotal: 0,
      sellerPayoutTotal: 220,
      riderPayoutTotal: 50,
      platformTotalEarning: 30,
      codCollectedAmount: 0,
      codRemittedAmount: 0,
      codPendingAmount: 0,
    },
    cashback: { amount: 1, savingsBase: 100, ratePercent: 1, credited: false, reversed: false },
    coins: { earned: 0, redeemed: 0 },
    financeFlags: { onlinePaymentCaptured: true },
    settlementStatus: {
      overall: "PENDING",
      sellerPayout: "PENDING",
      riderPayout: "PENDING",
      adminEarningCredited: false,
      reconciledAt: null,
    },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

jest.unstable_mockModule("mongoose", () => ({
  default: {
    startSession: mockStartSession,
    Types: {
      ObjectId: class MockObjectId {
        constructor(value) {
          this.value = value;
        }
        toString() {
          return String(this.value);
        }
        static isValid(value) {
          return typeof value === "string" && value.length > 0;
        }
      },
    },
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { findOne: mockOrderFindOne },
}));

jest.unstable_mockModule("../app/services/finance/ledgerService.js", () => ({
  createLedgerEntry: mockCreateLedgerEntry,
}));

jest.unstable_mockModule("../app/services/finance/auditLogService.js", () => ({
  createFinanceAuditLog: mockCreateFinanceAuditLog,
}));

jest.unstable_mockModule("../app/services/finance/walletService.js", () => ({
  creditWallet: mockCreditWallet,
  debitWallet: mockDebitWallet,
  getCustomerBalance: mockGetCustomerBalance,
  getOrCreateWallet: mockGetOrCreateWallet,
  updateCashInHand: mockUpdateCashInHand,
}));

jest.unstable_mockModule("../app/services/finance/payoutService.js", () => ({
  createPendingPayoutForOrder: mockCreatePendingPayoutForOrder,
}));

jest.unstable_mockModule("../app/services/coinsService.js", () => ({
  creditCoins: mockCreditCoins,
  debitCoins: mockDebitCoins,
  getCoinBalance: mockGetCoinBalance,
}));

// The real cashback maths — only the Setting lookup is stubbed out, since
// `mongoose` itself is mocked in this suite.
jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
      then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
    })),
  },
}));

const { settleDeliveredOrder, reverseOrderFinanceOnCancellation } = await import(
  "../app/services/finance/orderFinanceService.js"
);

describe("Wallet Cashback — credited on delivery", () => {
  let currentSession;
  let currentOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = createSession();
    mockStartSession.mockResolvedValue(currentSession);
    currentOrder = makeOrder();
    mockOrderFindOne.mockResolvedValue(currentOrder);
    mockGetOrCreateWallet.mockResolvedValue({ _id: "wallet-1" });
    mockCreditWallet.mockResolvedValue({ before: 0, after: 1, wallet: { _id: "wallet-1" } });
    mockDebitWallet.mockResolvedValue({ before: 1, after: 0, wallet: { _id: "wallet-1" } });
    mockGetCustomerBalance.mockResolvedValue(0);
  });

  it("credits the frozen cashback to the customer's wallet", async () => {
    await settleDeliveredOrder("ORD10001");

    const call = mockCreditWallet.mock.calls.find(
      ([args]) => args.ledgerType === "CASHBACK_CREDITED",
    );
    expect(call).toBeTruthy();
    expect(call[0]).toMatchObject({
      ownerType: "CUSTOMER",
      ownerId: "cust-1",
      amount: 1,
      bucket: "available",
      idempotencyKey: "CASHBACK-ORD10001",
    });
    expect(currentOrder.cashback.credited).toBe(true);
    expect(currentOrder.cashback.creditedAt).toBeInstanceOf(Date);
  });

  it("does not re-credit an order whose cashback already landed", async () => {
    currentOrder = makeOrder({
      cashback: { amount: 1, savingsBase: 100, ratePercent: 1, credited: true },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);

    await settleDeliveredOrder("ORD10001");

    expect(
      mockCreditWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_CREDITED"),
    ).toHaveLength(0);
  });

  it("skips the credit entirely for an order with no savings", async () => {
    currentOrder = makeOrder({
      paymentBreakdown: { ...makeOrder().paymentBreakdown, productSavings: 0 },
      cashback: { amount: 0, savingsBase: 0, ratePercent: 1, credited: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);

    await settleDeliveredOrder("ORD10001");

    expect(
      mockCreditWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_CREDITED"),
    ).toHaveLength(0);
  });

  it("pays nothing for a legacy order once the programme is switched off", async () => {
    // No `cashback` sub-doc at all. The fallback recomputes from the frozen
    // breakdown using LIVE settings — and rupee cashback now ships disabled
    // (Athreya Coins is the live loop), so nothing is paid.
    currentOrder = makeOrder({ cashback: undefined });
    mockOrderFindOne.mockResolvedValue(currentOrder);

    await settleDeliveredOrder("ORD10001");

    expect(
      mockCreditWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_CREDITED"),
    ).toHaveLength(0);
  });

  it("still honours a cashback amount frozen on the order at placement", async () => {
    // An order placed while rupee cashback was enabled keeps its promise even
    // if the programme is switched off before it is delivered.
    currentOrder = makeOrder({
      cashback: { amount: 2.5, savingsBase: 250, ratePercent: 1, credited: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);

    await settleDeliveredOrder("ORD10001");

    const call = mockCreditWallet.mock.calls.find(
      ([args]) => args.ledgerType === "CASHBACK_CREDITED",
    );
    expect(call[0].amount).toBe(2.5);
  });

  it("is a no-op on a settlement that has already been applied", async () => {
    currentOrder = makeOrder({
      financeFlags: { onlinePaymentCaptured: true, deliveredSettlementApplied: true },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);

    await settleDeliveredOrder("ORD10001");

    expect(mockCreditWallet).not.toHaveBeenCalled();
  });
});

describe("Wallet Cashback — reversed on cancellation", () => {
  let currentSession;
  let currentOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = createSession();
    mockStartSession.mockResolvedValue(currentSession);
    mockGetOrCreateWallet.mockResolvedValue({ _id: "wallet-1" });
    mockCreditWallet.mockResolvedValue({ before: 0, after: 1, wallet: { _id: "wallet-1" } });
    mockDebitWallet.mockResolvedValue({ before: 1, after: 0, wallet: { _id: "wallet-1" } });
  });

  it("claws back cashback that was already credited", async () => {
    currentOrder = makeOrder({
      paymentMode: "COD",
      cashback: { amount: 1, savingsBase: 100, ratePercent: 1, credited: true, reversed: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);
    mockGetCustomerBalance.mockResolvedValue(50);

    await reverseOrderFinanceOnCancellation("ORD10001", { reason: "Returned" });

    const call = mockDebitWallet.mock.calls.find(
      ([args]) => args.ledgerType === "CASHBACK_REVERSED",
    );
    expect(call).toBeTruthy();
    expect(call[0]).toMatchObject({ amount: 1, idempotencyKey: "CASHBACK-REV-ORD10001" });
    expect(currentOrder.cashback.reversed).toBe(true);
    expect(currentOrder.cashback.credited).toBe(false);
  });

  it("claws back only what the balance still covers, and records the shortfall", async () => {
    currentOrder = makeOrder({
      paymentMode: "COD",
      cashback: { amount: 10, savingsBase: 1000, ratePercent: 1, credited: true, reversed: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);
    // Customer already spent most of it.
    mockGetCustomerBalance.mockResolvedValue(4);

    await reverseOrderFinanceOnCancellation("ORD10001", { reason: "Returned" });

    const call = mockDebitWallet.mock.calls.find(
      ([args]) => args.ledgerType === "CASHBACK_REVERSED",
    );
    expect(call[0].amount).toBe(4);
    expect(call[0].metadata).toMatchObject({ creditedAmount: 10, shortfall: 6 });
    expect(currentOrder.cashback.reversed).toBe(true);
  });

  it("takes nothing back when the wallet is already empty", async () => {
    currentOrder = makeOrder({
      paymentMode: "COD",
      cashback: { amount: 5, savingsBase: 500, ratePercent: 1, credited: true, reversed: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);
    mockGetCustomerBalance.mockResolvedValue(0);

    await reverseOrderFinanceOnCancellation("ORD10001", { reason: "Returned" });

    expect(
      mockDebitWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_REVERSED"),
    ).toHaveLength(0);
    // Still marked reversed so a retry does not try again.
    expect(currentOrder.cashback.reversed).toBe(true);
  });

  it("does nothing for an order cancelled before delivery", async () => {
    currentOrder = makeOrder({
      paymentMode: "COD",
      cashback: { amount: 1, savingsBase: 100, ratePercent: 1, credited: false, reversed: false },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);
    mockGetCustomerBalance.mockResolvedValue(100);

    await reverseOrderFinanceOnCancellation("ORD10001", { reason: "Cancelled" });

    expect(
      mockDebitWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_REVERSED"),
    ).toHaveLength(0);
  });

  it("does not claw back twice", async () => {
    currentOrder = makeOrder({
      paymentMode: "COD",
      cashback: { amount: 1, savingsBase: 100, ratePercent: 1, credited: true, reversed: true },
    });
    mockOrderFindOne.mockResolvedValue(currentOrder);
    mockGetCustomerBalance.mockResolvedValue(100);

    await reverseOrderFinanceOnCancellation("ORD10001", { reason: "Returned" });

    expect(
      mockDebitWallet.mock.calls.filter(([a]) => a.ledgerType === "CASHBACK_REVERSED"),
    ).toHaveLength(0);
  });
});
