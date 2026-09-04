import { jest } from "@jest/globals";

/**
 * Multi-shop delivery fee policy.
 *
 * A basket spanning several shops is ONE delivery for the customer, so it must
 * never be charged a full delivery fee per shop:
 *
 *   first (farthest) shop -> full distance-based delivery fee
 *   each additional shop  -> `multiShopPickupFee` only
 *
 * The worked example from the spec: an 80 rupee basket at shop 1 and a 100
 * rupee basket at shop 2 pay 30 + 5 = 35 delivery, not 60.
 */

const mockProductFind = jest.fn();
const mockCategoryFind = jest.fn();
const mockGetOrCreateFinanceSettings = jest.fn();
const mockSettingFindOne = jest.fn(() => createQueryChain(null));

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: { find: mockProductFind },
}));

jest.unstable_mockModule("../app/models/category.js", () => ({
  default: { find: mockCategoryFind },
}));

jest.unstable_mockModule("../app/services/finance/financeSettingsService.js", () => ({
  getOrCreateFinanceSettings: mockGetOrCreateFinanceSettings,
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: mockSettingFindOne },
}));

jest.unstable_mockModule("../app/models/coinWallet.js", () => ({
  default: { findOne: jest.fn(() => createQueryChain(null)) },
}));

jest.unstable_mockModule("../app/models/coinTransaction.js", () => ({
  default: {
    findOne: jest.fn(() => createQueryChain(null)),
    create: jest.fn(),
  },
}));

const { buildCheckoutPricingSnapshot } = await import(
  "../app/services/checkoutPricingService.js"
);

// Zero handling fee / commission so the assertions isolate the delivery axis.
const freeCategory = (id) => ({
  _id: id,
  name: `Header ${id}`,
  adminCommissionType: "percentage",
  adminCommissionValue: 0,
  adminCommissionFixedRule: "per_qty",
  handlingFeeType: "fixed",
  handlingFeeValue: 0,
  handlingFees: 0,
});

const product = (id, price, sellerId, headerId) => ({
  _id: id,
  name: id.toUpperCase(),
  salePrice: 0,
  price,
  mainImage: "",
  headerId,
  sellerId,
  status: "active",
  variants: [],
});

const FINANCE_SETTINGS = {
  deliveryPricingMode: "distance_based",
  customerBaseDeliveryFee: 30,
  riderBasePayout: 30,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fixedDeliveryFee: 30,
  multiShopPickupFee: 5,
  handlingFeeStrategy: "highest_category_fee",
  codEnabled: true,
  onlineEnabled: true,
};

/** Runs a checkout over `shops` = [{ sellerId, price }]. */
async function priceBasket(shops, settingsOverride = {}) {
  mockProductFind.mockReturnValue(
    createQueryChain(
      shops.map((shop, i) => product(`p${i + 1}`, shop.price, shop.sellerId, `h${i + 1}`)),
    ),
  );
  mockCategoryFind.mockReturnValue(
    createQueryChain(shops.map((_, i) => freeCategory(`h${i + 1}`))),
  );
  mockGetOrCreateFinanceSettings.mockResolvedValue({
    ...FINANCE_SETTINGS,
    ...settingsOverride,
  });

  return buildCheckoutPricingSnapshot({
    orderItems: shops.map((_, i) => ({ product: `p${i + 1}`, quantity: 1 })),
    address: {}, // no coords -> distance 0 for every seller, no Seller lookup
    session: null,
  });
}

describe("multi-shop delivery fee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
  });

  it("charges base fee + one pickup fee for a two-shop basket (spec example)", async () => {
    const snapshot = await priceBasket([
      { sellerId: "seller-a", price: 80 },
      { sellerId: "seller-b", price: 100 },
    ]);

    expect(snapshot.sellerCount).toBe(2);

    // 30 base + 5 for the second pickup. NOT 60.
    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(35);
    expect(snapshot.aggregateBreakdown.productSubtotal).toBe(180);
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(215);
  });

  it("charges the plain base fee for a single-shop basket", async () => {
    const snapshot = await priceBasket([{ sellerId: "seller-a", price: 80 }]);

    expect(snapshot.sellerCount).toBe(1);
    // No extra pickup exists, so no surcharge may be added.
    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(30);
    expect(snapshot.aggregateBreakdown.grandTotal).toBe(110);
  });

  it("adds one pickup fee per extra shop, not a fee per shop", async () => {
    const snapshot = await priceBasket([
      { sellerId: "seller-a", price: 50 },
      { sellerId: "seller-b", price: 60 },
      { sellerId: "seller-c", price: 70 },
      { sellerId: "seller-d", price: 80 },
    ]);

    expect(snapshot.sellerCount).toBe(4);
    // 30 + (5 x 3) = 45, versus 120 if each shop billed a full delivery fee.
    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(45);
  });

  it("books the base fee on exactly one shop and the surcharge on the rest", async () => {
    const snapshot = await priceBasket([
      { sellerId: "seller-a", price: 80 },
      { sellerId: "seller-b", price: 100 },
      { sellerId: "seller-c", price: 120 },
    ]);

    const fees = snapshot.sellerBreakdownEntries
      .map((entry) => entry.breakdown.deliveryFeeCharged)
      .sort((a, b) => a - b);

    expect(fees).toEqual([5, 5, 30]);

    const primaries = snapshot.sellerBreakdownEntries.filter(
      (entry) => entry.breakdown.snapshots.isPrimaryDeliverySeller,
    );
    expect(primaries).toHaveLength(1);

    // Per-shop lines must still sum to what the customer is billed.
    const summed = snapshot.sellerBreakdownEntries.reduce(
      (sum, entry) => sum + entry.breakdown.deliveryFeeCharged,
      0,
    );
    expect(summed).toBe(snapshot.aggregateBreakdown.deliveryFeeCharged);
  });

  it("tags extra-shop lines as pickup surcharges for reconciliation", async () => {
    const snapshot = await priceBasket([
      { sellerId: "seller-a", price: 80 },
      { sellerId: "seller-b", price: 100 },
    ]);

    const markers = snapshot.sellerBreakdownEntries
      .map((entry) => entry.breakdown.snapshots.multiShopPickupFeeCharged)
      .sort((a, b) => a - b);

    // The primary shop's delivery line is a delivery fee, not a surcharge.
    expect(markers).toEqual([0, 5]);
  });

  it("honours an admin-configured pickup fee", async () => {
    const snapshot = await priceBasket(
      [
        { sellerId: "seller-a", price: 80 },
        { sellerId: "seller-b", price: 100 },
      ],
      { multiShopPickupFee: 12 },
    );

    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(42);
  });

  it("treats a zero pickup fee as fully free extra pickups", async () => {
    const snapshot = await priceBasket(
      [
        { sellerId: "seller-a", price: 80 },
        { sellerId: "seller-b", price: 100 },
      ],
      { multiShopPickupFee: 0 },
    );

    expect(snapshot.aggregateBreakdown.deliveryFeeCharged).toBe(30);
  });
});
