import { jest } from "@jest/globals";

const mockProductFind = jest.fn();
const mockCategoryFind = jest.fn();
const mockSellerFindById = jest.fn();
const mockGetOrCreateFinanceSettings = jest.fn();
const mockSettingFindOne = jest.fn();
const mockCoinWalletFindOne = jest.fn();

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
  default: { findOne: mockCoinWalletFindOne },
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

// Roughly 1 km apart, well inside the seller's 10 km service radius.
const SELLER_LOCATION = { coordinates: [77.5946, 12.9716] };
const NEAR_ADDRESS = { location: { lat: 12.9806, lng: 77.5946 } }; // ~1 km
const FAR_ADDRESS = { location: { lat: 13.0616, lng: 77.5946 } }; // ~10 km

function stubCatalog({ price = 500, salePrice = 400 } = {}) {
  mockProductFind.mockReturnValue(
    createQueryChain([
      {
        _id: "p1",
        name: "Ghee 1L",
        price,
        salePrice,
        mainImage: "",
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
        adminCommissionFixedRule: "per_qty",
        handlingFeeType: "fixed",
        handlingFeeValue: 0,
        handlingFees: 0,
      },
    ]),
  );
}

describe("checkout pricing — dynamic ETA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubCatalog();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
    mockCoinWalletFindOne.mockReturnValue(createQueryChain(null));
    mockSellerFindById.mockReturnValue(
      createQueryChain({
        _id: "seller-a",
        shopName: "Shop A",
        serviceRadius: 20,
        location: SELLER_LOCATION,
      }),
    );
    mockGetOrCreateFinanceSettings.mockResolvedValue({
      deliveryPricingMode: "distance_based",
      customerBaseDeliveryFee: 30,
      riderBasePayout: 30,
      baseDistanceCapacityKm: 0.5,
      incrementalKmSurcharge: 10,
      deliveryPartnerRatePerKm: 5,
      fixedDeliveryFee: 30,
      handlingFeeStrategy: "highest_category_fee",
    });
  });

  it("quotes a longer ETA for a farther delivery address", async () => {
    const near = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
    });
    const far = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: FAR_ADDRESS,
    });

    expect(near.deliveryEta).toBeTruthy();
    expect(far.deliveryEta).toBeTruthy();
    expect(far.deliveryEta.minMinutes).toBeGreaterThan(near.deliveryEta.minMinutes);
    expect(near.deliveryEta.label).toMatch(/mins$/);
    expect(near.aggregateBreakdown.deliveryEta).toEqual(near.deliveryEta);
  });

  it("still returns a quote for an address with no coordinates", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: {},
    });
    expect(snapshot.deliveryEta.minMinutes).toBeGreaterThan(0);
    expect(snapshot.deliveryEta.distanceKm).toBe(0);
  });
});

describe("checkout pricing — Athreya Coins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubCatalog({ price: 500, salePrice: 400 }); // ₹100 of catalog savings
    // Athreya Coins ships disabled (Wallet Cashback is the default retention
    // mechanism), so this suite has to switch the programme on explicitly.
    mockSettingFindOne.mockReturnValue(
      createQueryChain({ athreyaCoins: { enabled: true } }),
    );
    // ₹100 of coins in hand (1 coin = 1 paisa).
    mockCoinWalletFindOne.mockReturnValue(createQueryChain({ balance: 10000 }));
    mockSellerFindById.mockReturnValue(
      createQueryChain({
        _id: "seller-a",
        shopName: "Shop A",
        serviceRadius: 20,
        location: SELLER_LOCATION,
      }),
    );
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

  it("reports the catalog savings the coin grant is minted from", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 2 }],
      address: NEAR_ADDRESS,
    });

    // (500 - 400) * 2 = ₹200 saved -> 1 coin per rupee -> 200 coins (₹2)
    expect(snapshot.aggregateBreakdown.productSavings).toBe(200);
    expect(snapshot.coins.savingsBase).toBe(200);
    expect(snapshot.coins.earned).toBe(200);
  });

  it("subtracts a redemption from the payable and leaves the rider payout intact", async () => {
    const baseline = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
    });

    const redeemed = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
      coinsRedeem: 5000,
      customerId: "cust-1",
    });

    // 5000 coins is ₹50 of value.
    expect(redeemed.coins.redeemed).toBe(5000);
    expect(redeemed.coins.discount).toBe(50);
    expect(redeemed.aggregateBreakdown.coinsRedeemed).toBe(5000);
    expect(redeemed.aggregateBreakdown.coinsDiscount).toBe(50);
    expect(redeemed.aggregateBreakdown.grandTotal).toBe(
      Number((baseline.aggregateBreakdown.grandTotal - 50).toFixed(2)),
    );
    expect(redeemed.aggregateBreakdown.payableAmount).toBe(
      redeemed.aggregateBreakdown.grandTotal,
    );
    // The platform, not the rider, funds the loyalty discount.
    expect(redeemed.aggregateBreakdown.riderPayoutTotal).toBe(
      baseline.aggregateBreakdown.riderPayoutTotal,
    );
    expect(redeemed.aggregateBreakdown.sellerPayoutTotal).toBe(
      baseline.aggregateBreakdown.sellerPayoutTotal,
    );
    expect(redeemed.aggregateBreakdown.platformTotalEarning).toBe(
      Number((baseline.aggregateBreakdown.platformTotalEarning - 50).toFixed(2)),
    );
  });

  it("clamps a request that exceeds the customer's balance", async () => {
    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
      coinsRedeem: 999999,
      customerId: "cust-1",
    });

    // Balance is 10000 coins (₹100) against a ₹430 order.
    expect(snapshot.coins.redeemed).toBe(10000);
    expect(snapshot.coins.cappedBy).toBe("BALANCE");
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(330);
  });

  it("never lets a huge balance overpay the order", async () => {
    // ₹5000 of coins against a ₹430 order — capped at the order value.
    mockCoinWalletFindOne.mockReturnValue(createQueryChain({ balance: 500000 }));

    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
      coinsRedeem: 500000,
      customerId: "cust-1",
    });

    expect(snapshot.coins.discount).toBe(430);
    expect(snapshot.coins.cappedBy).toBe("ORDER_CAP");
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(0);
  });

  it("ignores a redemption request from a customer with no coins", async () => {
    mockCoinWalletFindOne.mockReturnValue(createQueryChain({ balance: 0 }));

    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
      coinsRedeem: 100,
      customerId: "cust-1",
    });

    expect(snapshot.coins.redeemed).toBe(0);
    expect(snapshot.aggregateBreakdown.coinsDiscount).toBe(0);
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(430);
  });

  it("does not read a coin balance when no redemption was requested", async () => {
    await buildCheckoutPricingSnapshot({
      orderItems: [{ product: "p1", quantity: 1 }],
      address: NEAR_ADDRESS,
      customerId: "cust-1",
    });
    expect(mockCoinWalletFindOne).not.toHaveBeenCalled();
  });

  it("splits a redemption across sellers so the parts sum back to the discount", async () => {
    mockProductFind.mockReturnValue(
      createQueryChain([
        {
          _id: "p1",
          name: "A",
          price: 300,
          salePrice: 300,
          headerId: "h1",
          sellerId: "seller-a",
          status: "active",
          variants: [],
          gst: 0,
        },
        {
          _id: "p2",
          name: "B",
          price: 700,
          salePrice: 700,
          headerId: "h1",
          sellerId: "seller-b",
          status: "active",
          variants: [],
          gst: 0,
        },
      ]),
    );

    const snapshot = await buildCheckoutPricingSnapshot({
      orderItems: [
        { product: "p1", quantity: 1 },
        { product: "p2", quantity: 1 },
      ],
      address: NEAR_ADDRESS,
      coinsRedeem: 600,
      customerId: "cust-1",
    });

    const perSeller = snapshot.sellerBreakdownEntries.map((entry) => entry.breakdown);
    const coinSum = perSeller.reduce((sum, row) => sum + row.coinsRedeemed, 0);
    const discountSum = perSeller.reduce((sum, row) => sum + row.coinsDiscount, 0);

    expect(coinSum).toBe(snapshot.coins.redeemed);
    expect(Number(discountSum.toFixed(2))).toBe(snapshot.coins.discount);
    perSeller.forEach((row) => {
      expect(row.grandTotal).toBeGreaterThanOrEqual(0);
      expect(row.payableAmount).toBe(row.grandTotal);
    });
  });
});
