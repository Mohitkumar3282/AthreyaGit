import { jest } from "@jest/globals";

/**
 * Multi-store ETA ladder.
 *
 * A multi-shop basket is one trip with several pickups, so each extra store
 * widens the promise at both ends. For a NEARBY basket (distance ~0, where the
 * floor governs) the published ladder is:
 *
 *   1 shop  -> 10-15 mins
 *   2 shops -> 15-25 mins
 *   3 shops -> 20-35 mins
 */

const mockSettingFindOne = jest.fn();

function createQueryChain(result) {
  return {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
}

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: { findOne: mockSettingFindOne },
}));

const { calculateDeliveryEta, estimateDeliveryEta } = await import(
  "../app/services/deliveryEtaService.js"
);

describe("multi-store delivery ETA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
  });

  it("matches the published ladder for a nearby basket", () => {
    const table = [
      [1, "10-15 mins"],
      [2, "15-25 mins"],
      [3, "20-35 mins"],
    ];

    for (const [shopCount, label] of table) {
      const eta = calculateDeliveryEta({ distanceKm: 0, shopCount });
      expect([shopCount, eta.label]).toEqual([shopCount, label]);
    }
  });

  it("adds 5 to the lower bound and 10 to the upper per extra shop", () => {
    const one = calculateDeliveryEta({ distanceKm: 0, shopCount: 1 });
    const four = calculateDeliveryEta({ distanceKm: 0, shopCount: 4 });

    expect(four.minMinutes - one.minMinutes).toBe(15); // 3 extra shops x 5
    expect(four.maxMinutes - one.maxMinutes).toBe(30); // 3 extra shops x 10
  });

  it("treats a missing, zero or single shop count identically", () => {
    const implicit = calculateDeliveryEta({ distanceKm: 2 });
    const zero = calculateDeliveryEta({ distanceKm: 2, shopCount: 0 });
    const one = calculateDeliveryEta({ distanceKm: 2, shopCount: 1 });

    expect(zero.label).toBe(implicit.label);
    expect(one.label).toBe(implicit.label);
    // An order always has at least one pickup.
    expect(implicit.shopCount).toBe(1);
    expect(zero.shopCount).toBe(1);
  });

  it("stacks shop count on top of distance rather than replacing it", () => {
    const nearTwoShops = calculateDeliveryEta({ distanceKm: 0, shopCount: 2 });
    const farTwoShops = calculateDeliveryEta({ distanceKm: 10, shopCount: 2 });

    // Distance still moves the quote when the shop count is unchanged.
    expect(farTwoShops.minMinutes).toBeGreaterThan(nearTwoShops.minMinutes);

    // base 10 + (10km x 3) = 40, +5 for the second shop
    expect(farTwoShops.minMinutes).toBe(45);
    expect(farTwoShops.maxMinutes).toBe(55); // 40 + 5 spread + 10 extra shop
  });

  it("reports the extra-shop contribution in the breakdown", () => {
    const eta = calculateDeliveryEta({ distanceKm: 0, shopCount: 3 });

    expect(eta.shopCount).toBe(3);
    expect(eta.breakdown.extraShops).toBe(2);
    expect(eta.breakdown.extraShopMinMinutes).toBe(10);
    expect(eta.breakdown.extraShopMaxMinutes).toBe(20);
  });

  it("never lets the window invert, even on a huge basket", () => {
    for (const shopCount of [1, 2, 5, 12, 40]) {
      const eta = calculateDeliveryEta({ distanceKm: 3, shopCount });
      expect(eta.maxMinutes).toBeGreaterThanOrEqual(eta.minMinutes);
    }
  });

  it("holds the ceiling for an extreme shop count", () => {
    const eta = calculateDeliveryEta({
      distanceKm: 0,
      shopCount: 500,
      settings: { maxMinutes: 90 },
    });

    expect(eta.minMinutes).toBeLessThanOrEqual(90);
    expect(eta.maxMinutes).toBeLessThanOrEqual(90);
    expect(eta.maxMinutes).toBeGreaterThanOrEqual(eta.minMinutes);
  });

  it("honours admin-tuned per-shop increments", async () => {
    mockSettingFindOne.mockReturnValue(
      createQueryChain({
        deliveryEta: {
          enabled: true,
          basePrepMinutes: 10,
          minutesPerKm: 3,
          minMinutes: 10,
          maxMinutes: 180,
          rangeSpreadMinutes: 5,
          extraShopMinMinutes: 8,
          extraShopMaxMinutes: 20,
        },
      }),
    );

    const eta = await estimateDeliveryEta({ distanceKm: 0, shopCount: 2 });
    expect(eta.label).toBe("18-35 mins"); // 10+8 .. 10+5+20
  });

  it("clamps an upper increment configured below the lower one", () => {
    // Would otherwise invert the window on every multi-shop order.
    const eta = calculateDeliveryEta({
      distanceKm: 0,
      shopCount: 3,
      settings: { extraShopMinMinutes: 10, extraShopMaxMinutes: 2 },
    });

    expect(eta.maxMinutes).toBeGreaterThanOrEqual(eta.minMinutes);
  });
});
