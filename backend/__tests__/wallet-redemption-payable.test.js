import { jest } from "@jest/globals";

const mockProductFind = jest.fn();
const mockCategoryFind = jest.fn();
const mockSellerFindById = jest.fn();
const mockGetOrCreateFinanceSettings = jest.fn();
const mockSettingFindOne = jest.fn();

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));
jest.unstable_mockModule("../app/models/category.js", () => ({
  default: { find: mockCategoryFind },
}));
jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: { findById: mockSellerFindById },
}));
jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: mockSettingFindOne },
}));
jest.unstable_mockModule("../app/models/coinWallet.js", () => ({
  default: { findOne: jest.fn(() => createQueryChain(null)) },
}));
jest.unstable_mockModule("../app/models/coinTransaction.js", () => ({
  default: { findOne: jest.fn(() => createQueryChain(null)), create: jest.fn() },
}));
jest.unstable_mockModule("../app/services/finance/financeSettingsService.js", () => ({
  getOrCreateFinanceSettings: mockGetOrCreateFinanceSettings,
}));

const { buildCheckoutPricingSnapshot } = await import(
  "../app/services/checkoutPricingService.js"
);

function stubCatalog() {
  mockProductFind.mockReturnValue(
    createQueryChain([
      {
        _id: "p1",
        name: "Atta 5kg",
        price: 500,
        salePrice: 400,
        headerId: "h1",
        sellerId: "seller-a",
        status: "active",
        variants: [],
        gst: 0,
      },
    ]),
  );
  mockCategoryFind.mockReturnValue(
    createQueryChain([
      {
        _id: "h1",
        name: "Grocery",
        adminCommissionType: "percentage",
        adminCommissionValue: 10,
        handlingFeeType: "fixed",
        handlingFeeValue: 0,
        handlingFees: 0,
      },
    ]),
  );
}

describe("Wallet redemption reduces the amount the customer pays", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubCatalog();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
    mockGetOrCreateFinanceSettings.mockResolvedValue({
      deliveryPricingMode: "fixed_price",
      customerBaseDeliveryFee: 30,
      riderBasePayout: 30,
      baseDistanceCapacityKm: 0.5,
      incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5,
      fixedDeliveryFee: 30,
      handlingFeeStrategy: "highest_category_fee",
    });
  });

  async function priceWith(overrides = {}) {
    return buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: {},
      ...overrides,
    });
  }

  it("deducts the wallet amount from the payable by default", async () => {
    const baseline = await priceWith();
    const withWallet = await priceWith({ walletAmount: 120 });

    // 400 item + 30 delivery = 430 payable before redemption.
    expect(baseline.aggregateBreakdown.payableAmount).toBe(430);
    expect(withWallet.aggregateBreakdown.walletAmount).toBe(120);
    expect(withWallet.aggregateBreakdown.payableAmount).toBe(310);
    expect(withWallet.aggregateBreakdown.grandTotal).toBe(310);
  });

  it("keeps grossTotal at the pre-redemption figure for reconciliation", async () => {
    const snapshot = await priceWith({ walletAmount: 120 });
    expect(snapshot.aggregateBreakdown.grossTotal).toBe(430);
    expect(
      snapshot.aggregateBreakdown.grossTotal - snapshot.aggregateBreakdown.walletAmount,
    ).toBe(snapshot.aggregateBreakdown.payableAmount);
  });

  it("never drives the payable below zero when the wallet exceeds the bill", async () => {
    const snapshot = await priceWith({ walletAmount: 10000 });
    expect(snapshot.aggregateBreakdown.payableAmount).toBe(0);
    expect(snapshot.aggregateBreakdown.walletAmount).toBe(430);
  });

  it("leaves the seller and rider whole — the wallet is the customer's money", async () => {
    const baseline = await priceWith();
    const withWallet = await priceWith({ walletAmount: 120 });

    expect(withWallet.aggregateBreakdown.sellerPayoutTotal).toBe(
      baseline.aggregateBreakdown.sellerPayoutTotal,
    );
    expect(withWallet.aggregateBreakdown.riderPayoutTotal).toBe(
      baseline.aggregateBreakdown.riderPayoutTotal,
    );
  });

  it("clamps against the post-tip total, not the pre-tip one", async () => {
    const snapshot = await priceWith({ walletAmount: 10000, tipAmount: 20 });
    // 430 + 20 tip = 450 of redeemable payable.
    expect(snapshot.aggregateBreakdown.walletAmount).toBe(450);
    expect(snapshot.aggregateBreakdown.payableAmount).toBe(0);
  });

  it("is a no-op when no wallet balance is applied", async () => {
    const snapshot = await priceWith({ walletAmount: 0 });
    expect(snapshot.aggregateBreakdown.walletAmount).toBe(0);
    expect(snapshot.aggregateBreakdown.payableAmount).toBe(430);
  });

  it("quotes the Athreya Coins the order will return on delivery", async () => {
    const snapshot = await priceWith();
    // ₹100 of catalog savings -> 100 coins (₹1).
    expect(snapshot.aggregateBreakdown.savingsTotal).toBe(100);
    expect(snapshot.coins.earned).toBe(100);
    // Rupee cashback is the opt-in alternative and ships disabled, so the
    // same savings are never rewarded twice.
    expect(snapshot.cashback.amount).toBe(0);
  });

  it("does not reward the wallet redemption itself", async () => {
    const plain = await priceWith();
    const redeemed = await priceWith({ walletAmount: 120 });
    // Spending wallet balance must not mint more rewards.
    expect(redeemed.coins.earned).toBe(plain.coins.earned);
    expect(redeemed.aggregateBreakdown.savingsTotal).toBe(
      plain.aggregateBreakdown.savingsTotal,
    );
  });
});
