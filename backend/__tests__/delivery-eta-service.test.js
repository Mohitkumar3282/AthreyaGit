import { jest } from "@jest/globals";

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

const {
  calculateDeliveryEta,
  estimateDeliveryEta,
  formatEtaLabel,
  normalizeEtaSettings,
  DEFAULT_ETA_SETTINGS,
} = await import("../app/services/deliveryEtaService.js");

describe("dynamic delivery ETA", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
  });

  it("quotes a longer window the farther the delivery address is", () => {
    const nearby = calculateDeliveryEta({ distanceKm: 0.4 });
    const middle = calculateDeliveryEta({ distanceKm: 4 });
    const far = calculateDeliveryEta({ distanceKm: 12 });

    expect(nearby.minMinutes).toBeLessThan(middle.minMinutes);
    expect(middle.minMinutes).toBeLessThan(far.minMinutes);

    // base 8 + 3 min/km
    expect(middle.minMinutes).toBe(20);
    expect(middle.maxMinutes).toBe(25);
    expect(middle.label).toBe("20-25 mins");
  });

  it("never quotes below the configured floor for a zero-distance order", () => {
    const eta = calculateDeliveryEta({ distanceKm: 0 });
    expect(eta.minMinutes).toBe(DEFAULT_ETA_SETTINGS.minMinutes);
    expect(eta.breakdown.clampedToMin).toBe(false);

    const floored = calculateDeliveryEta({
      distanceKm: 0,
      settings: { basePrepMinutes: 1, minMinutes: 10 },
    });
    expect(floored.minMinutes).toBe(10);
    expect(floored.breakdown.clampedToMin).toBe(true);
  });

  it("caps an absurd distance at the configured ceiling", () => {
    const eta = calculateDeliveryEta({ distanceKm: 5000 });
    expect(eta.minMinutes).toBe(DEFAULT_ETA_SETTINGS.maxMinutes);
    expect(eta.breakdown.clampedToMax).toBe(true);
  });

  it("adds per-item picking time only when configured", () => {
    const withoutPicking = calculateDeliveryEta({ distanceKm: 2, itemCount: 10 });
    const withPicking = calculateDeliveryEta({
      distanceKm: 2,
      itemCount: 10,
      settings: { minutesPerItem: 1 },
    });

    expect(withPicking.minMinutes - withoutPicking.minMinutes).toBe(10);
  });

  it("treats malformed distances as zero rather than producing NaN", () => {
    const eta = calculateDeliveryEta({ distanceKm: "not-a-number" });
    expect(Number.isFinite(eta.minMinutes)).toBe(true);
    expect(eta.minMinutes).toBe(DEFAULT_ETA_SETTINGS.minMinutes);

    const negative = calculateDeliveryEta({ distanceKm: -50 });
    expect(negative.minMinutes).toBe(DEFAULT_ETA_SETTINGS.minMinutes);
  });

  it("honours admin overrides from Setting.deliveryEta", async () => {
    mockSettingFindOne.mockReturnValue(
      createQueryChain({
        deliveryEta: {
          enabled: true,
          basePrepMinutes: 15,
          minutesPerKm: 5,
          minMinutes: 20,
          maxMinutes: 90,
          rangeSpreadMinutes: 10,
        },
      }),
    );

    const eta = await estimateDeliveryEta({ distanceKm: 6 });
    expect(eta.minMinutes).toBe(45); // 15 + 6*5
    expect(eta.maxMinutes).toBe(55);
    expect(eta.label).toBe("45-55 mins");
  });

  it("returns null when an admin turns the feature off", async () => {
    mockSettingFindOne.mockReturnValue(
      createQueryChain({ deliveryEta: { enabled: false } }),
    );
    await expect(estimateDeliveryEta({ distanceKm: 3 })).resolves.toBeNull();
  });

  it("falls back to defaults instead of throwing when settings cannot be read", async () => {
    mockSettingFindOne.mockImplementation(() => {
      throw new Error("mongo down");
    });
    const eta = await estimateDeliveryEta({ distanceKm: 4 });
    expect(eta.minMinutes).toBe(20);
  });

  it("normalizes out-of-order min/max bounds", () => {
    const config = normalizeEtaSettings({ minMinutes: 60, maxMinutes: 10 });
    expect(config.maxMinutes).toBeGreaterThanOrEqual(config.minMinutes);
  });

  it("collapses the label when the spread is zero", () => {
    expect(formatEtaLabel(20, 20)).toBe("20 mins");
    expect(formatEtaLabel(20, 25)).toBe("20-25 mins");
  });
});
