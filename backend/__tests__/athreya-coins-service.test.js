import { jest } from "@jest/globals";

const mockSettingFindOne = jest.fn();
const mockCoinWalletFindOne = jest.fn();
const mockCoinWalletCreate = jest.fn();
const mockCoinTxFindOne = jest.fn();
const mockCoinTxCreate = jest.fn();
const mockCoinTxFind = jest.fn();
const mockCoinTxCount = jest.fn();

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
}

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: mockSettingFindOne },
}));

jest.unstable_mockModule("../app/models/coinWallet.js", () => ({
  default: { findOne: mockCoinWalletFindOne, create: mockCoinWalletCreate },
}));

jest.unstable_mockModule("../app/models/coinTransaction.js", () => ({
  default: {
    findOne: mockCoinTxFindOne,
    create: mockCoinTxCreate,
    find: mockCoinTxFind,
    countDocuments: mockCoinTxCount,
  },
}));

const {
  coinsToRupees,
  computeCoinsForSavings,
  computeMaxRedeemableCoins,
  computeRedeemableCoins,
  creditCoins,
  debitCoins,
  getCoinBalance,
  getCoinSummary,
  normalizeCoinSettings,
  rupeesToCoins,
} = await import("../app/services/coinsService.js");

function makeWallet(overrides = {}) {
  return {
    customer: "cust-1",
    balance: 0,
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    status: "ACTIVE",
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Athreya Coins — every ₹1 saved earns 1 paisa coin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
  });

  it("grants one coin per rupee saved", () => {
    // The three worked examples from the programme rules.
    expect(computeCoinsForSavings(1)).toBe(1);
    expect(computeCoinsForSavings(100)).toBe(100);
    expect(computeCoinsForSavings(500)).toBe(500);
  });

  it("values coins at a paisa each", () => {
    expect(coinsToRupees(1)).toBe(0.01);
    expect(coinsToRupees(100)).toBe(1);
    expect(coinsToRupees(500)).toBe(5);
    expect(coinsToRupees(1000)).toBe(10);
    expect(coinsToRupees(1250)).toBe(12.5);
  });

  it("matches the worked order example end to end", () => {
    // ₹36 of savings on a delivered order -> 36 coins -> ₹0.36 of value.
    const coins = computeCoinsForSavings(36);
    expect(coins).toBe(36);
    expect(coinsToRupees(coins)).toBe(0.36);
  });

  it("floors partial rupees rather than minting fractional coins", () => {
    expect(computeCoinsForSavings(36.8)).toBe(36);
    expect(computeCoinsForSavings(0.99)).toBe(0);
  });

  it("grants nothing when there were no savings", () => {
    expect(computeCoinsForSavings(0)).toBe(0);
    expect(computeCoinsForSavings(-100)).toBe(0);
  });

  it("treats malformed savings as zero rather than NaN", () => {
    expect(computeCoinsForSavings("not-a-number")).toBe(0);
    expect(computeCoinsForSavings(undefined)).toBe(0);
  });

  it("respects a per-order earning cap", () => {
    expect(computeCoinsForSavings(10000, { maxEarnPerOrder: 500 })).toBe(500);
  });

  it("mints nothing while the programme is disabled", () => {
    expect(computeCoinsForSavings(500, { enabled: false })).toBe(0);
    expect(computeCoinsForSavings(500, { coinsPerRupeeSaved: 0 })).toBe(0);
  });

  it("scales with an admin-configured earn rate", () => {
    // A 2x promotional rate: ₹100 saved returns 200 coins (₹2).
    expect(computeCoinsForSavings(100, { coinsPerRupeeSaved: 2 })).toBe(200);
  });

  it("converts rupees back into coins consistently", () => {
    expect(rupeesToCoins(1)).toBe(100);
    expect(rupeesToCoins(12.5)).toBe(1250);
  });
});

describe("Athreya Coins — redemption at checkout", () => {
  it("applies the typed redemption against the order", () => {
    // The worked checkout example: 500 coins off a ₹380 bill.
    const result = computeRedeemableCoins({
      requestedCoins: 500,
      balance: 1250,
      orderAmount: 380,
    });
    expect(result.coins).toBe(500);
    expect(result.rupeeValue).toBe(5);
    expect(result.cappedBy).toBeNull();
    expect(Number((380 - result.rupeeValue).toFixed(2))).toBe(375);
  });

  it("caps redemption at the customer's balance", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 5000,
      balance: 1250,
      orderAmount: 380,
    });
    expect(result.coins).toBe(1250);
    expect(result.rupeeValue).toBe(12.5);
    expect(result.cappedBy).toBe("BALANCE");
  });

  it("never lets coins exceed the order value", () => {
    // 100,000 coins is ₹1000 of value against a ₹250 order.
    const result = computeRedeemableCoins({
      requestedCoins: 100000,
      balance: 100000,
      orderAmount: 250,
    });
    expect(result.rupeeValue).toBeLessThanOrEqual(250);
    expect(result.coins).toBe(25000);
    expect(result.cappedBy).toBe("ORDER_CAP");
  });

  it("honours a tightened per-order percentage cap", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 100000,
      balance: 100000,
      orderAmount: 400, // 20% of ₹400 = ₹80 = 8000 coins
      settings: { maxRedeemPercentOfOrder: 20 },
    });
    expect(result.coins).toBe(8000);
    expect(result.rupeeValue).toBe(80);
  });

  it("declines redemption on a zero-value order", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 100,
      balance: 500,
      orderAmount: 0,
    });
    expect(result.coins).toBe(0);
    expect(result.cappedBy).toBe("ORDER_AMOUNT");
  });

  it("declines redemption from an empty balance", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 100,
      balance: 0,
      orderAmount: 380,
    });
    expect(result.coins).toBe(0);
    expect(result.cappedBy).toBe("BALANCE");
  });

  it("declines redemption while the programme is disabled", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 100,
      balance: 500,
      orderAmount: 1000,
      settings: { enabled: false },
    });
    expect(result.coins).toBe(0);
    expect(result.cappedBy).toBe("DISABLED");
  });

  it("honours a raised minimum redemption when one is configured", () => {
    const result = computeRedeemableCoins({
      requestedCoins: 50,
      balance: 500,
      orderAmount: 1000,
      settings: { minRedeemCoins: 100 },
    });
    expect(result.coins).toBe(0);
  });

  it("reports the largest redemption the customer could make", () => {
    // Whole balance fits inside a ₹380 order (₹12.50 of coins).
    const result = computeMaxRedeemableCoins({ balance: 1250, orderAmount: 380 });
    expect(result.coins).toBe(1250);
    expect(result.rupeeValue).toBe(12.5);
  });

  it("clamps out-of-range admin config instead of trusting it", () => {
    const config = normalizeCoinSettings({
      coinsPerRupeeSaved: -5,
      maxRedeemPercentOfOrder: -20,
      rupeeValuePerCoin: 0,
    });
    expect(config.coinsPerRupeeSaved).toBe(0);
    expect(config.maxRedeemPercentOfOrder).toBe(0);
    // Never zero — that would divide by zero converting coins to rupees.
    expect(config.rupeeValuePerCoin).toBeGreaterThan(0);
  });
});

describe("Athreya Coins — ledger movements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
    mockCoinTxFindOne.mockReturnValue(createQueryChain(null));
    mockCoinTxCreate.mockImplementation((rows) => Promise.resolve(rows));
  });

  it("credits coins and records the movement with its rupee value", async () => {
    const wallet = makeWallet({ balance: 1214 });
    mockCoinWalletFindOne.mockResolvedValue(wallet);

    const result = await creditCoins({
      customerId: "cust-1",
      coins: 36,
      orderId: "AD12345",
    });

    expect(result.applied).toBe(true);
    expect(result.balance).toBe(1250);
    expect(wallet.lifetimeEarned).toBe(36);
    expect(wallet.save).toHaveBeenCalled();

    const [rows] = mockCoinTxCreate.mock.calls[0];
    expect(rows[0]).toMatchObject({
      direction: "CREDIT",
      coins: 36,
      rupeeValue: 0.36,
      balanceBefore: 1214,
      balanceAfter: 1250,
      orderId: "AD12345",
    });
  });

  it("debits coins and tracks lifetime redemption", async () => {
    const wallet = makeWallet({ balance: 1250 });
    mockCoinWalletFindOne.mockResolvedValue(wallet);

    const result = await debitCoins({ customerId: "cust-1", coins: 500 });

    expect(result.balance).toBe(750);
    expect(wallet.lifetimeRedeemed).toBe(500);
  });

  it("refuses to debit more coins than the customer holds", async () => {
    mockCoinWalletFindOne.mockResolvedValue(makeWallet({ balance: 5 }));
    await expect(debitCoins({ customerId: "cust-1", coins: 40 })).rejects.toThrow(
      /Insufficient Athreya Coins/,
    );
  });

  it("treats a replayed movement as a no-op instead of double-granting", async () => {
    mockCoinTxFindOne.mockReturnValue(
      createQueryChain({ coins: 36, balanceAfter: 1250, idempotencyKey: "COIN-EARN-AD12345" }),
    );

    const result = await creditCoins({
      customerId: "cust-1",
      coins: 36,
      idempotencyKey: "COIN-EARN-AD12345",
    });

    expect(result.applied).toBe(false);
    expect(result.duplicate).toBe(true);
    expect(mockCoinTxCreate).not.toHaveBeenCalled();
    expect(mockCoinWalletFindOne).not.toHaveBeenCalled();
  });

  it("ignores a zero-coin movement without touching the wallet", async () => {
    mockCoinWalletFindOne.mockReturnValue(createQueryChain(null));
    const result = await creditCoins({ customerId: "cust-1", coins: 0 });
    expect(result.applied).toBe(false);
    expect(mockCoinTxCreate).not.toHaveBeenCalled();
  });

  it("refuses movements on a frozen wallet", async () => {
    mockCoinWalletFindOne.mockResolvedValue(makeWallet({ balance: 100, status: "FROZEN" }));
    await expect(creditCoins({ customerId: "cust-1", coins: 10 })).rejects.toThrow(
      /not active/,
    );
  });

  it("reports a zero balance rather than throwing when the read fails", async () => {
    mockCoinWalletFindOne.mockImplementation(() => {
      throw new Error("mongo down");
    });
    await expect(getCoinBalance("cust-1")).resolves.toBe(0);
  });

  it("summarises the balance alongside its rupee value and live config", async () => {
    mockCoinWalletFindOne.mockReturnValue(
      createQueryChain({ balance: 1250, lifetimeEarned: 1350, lifetimeRedeemed: 100 }),
    );

    const summary = await getCoinSummary("cust-1");
    expect(summary.balance).toBe(1250);
    expect(summary.rupeeValue).toBe(12.5);
    expect(summary.lifetimeEarned).toBe(1350);
    expect(summary.settings.coinsPerRupeeSaved).toBe(1);
    expect(summary.settings.rupeeValuePerCoin).toBe(0.01);
  });
});
