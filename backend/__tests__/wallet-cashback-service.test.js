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
  computeCashbackForSavings,
  getCashbackSettings,
  normalizeCashbackSettings,
  resolveSavingsBase,
} = await import("../app/services/walletCashbackService.js");

// Rupee cashback is the OPT-IN alternative to Athreya Coins: coins are the
// live retention loop, so the programme ships disabled and every test that
// exercises a payout has to switch it on explicitly.
const ON = { enabled: true };

describe("Wallet Cashback — calculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
  });

  it("returns 1% of savings, matching the specified examples", () => {
    // The two worked examples from the spec.
    expect(computeCashbackForSavings(20, ON)).toBe(0.2);
    expect(computeCashbackForSavings(100, ON)).toBe(1);
  });

  it("keeps sub-rupee precision instead of truncating to zero", () => {
    // 1% of ₹1 is one paisa — a naive Math.floor would pay nothing.
    expect(computeCashbackForSavings(1, ON)).toBe(0.01);
    expect(computeCashbackForSavings(49, ON)).toBe(0.49);
  });

  it("rounds to paise rather than carrying floating-point dust", () => {
    expect(computeCashbackForSavings(250.5, ON)).toBe(2.51);
    expect(computeCashbackForSavings(33.33, ON)).toBe(0.33);
  });

  it("pays nothing when there were no savings", () => {
    expect(computeCashbackForSavings(0, ON)).toBe(0);
    expect(computeCashbackForSavings(-500, ON)).toBe(0);
  });

  it("treats malformed input as zero savings rather than NaN", () => {
    expect(computeCashbackForSavings("not-a-number", ON)).toBe(0);
    expect(computeCashbackForSavings(undefined, ON)).toBe(0);
    expect(computeCashbackForSavings(null, ON)).toBe(0);
  });

  it("skips credits below the dust threshold", () => {
    // 1% of ₹0.40 = ₹0.004, which rounds under the ₹0.01 minimum.
    expect(computeCashbackForSavings(0.4, ON)).toBe(0);
  });

  it("honours a per-order cap", () => {
    expect(computeCashbackForSavings(100000, { ...ON, maxCashbackPerOrder: 50 })).toBe(50);
  });

  it("pays nothing while the programme is disabled", () => {
    expect(computeCashbackForSavings(1000, { enabled: false })).toBe(0);
    expect(computeCashbackForSavings(1000, { ...ON, ratePercent: 0 })).toBe(0);
  });

  it("scales with an admin-configured rate", () => {
    expect(computeCashbackForSavings(100, { ...ON, ratePercent: 5 })).toBe(5);
    expect(computeCashbackForSavings(100, { ...ON, ratePercent: 2.5 })).toBe(2.5);
  });

  it("pays nothing by default, since Athreya Coins is the live loop", () => {
    expect(computeCashbackForSavings(1000)).toBe(0);
  });

  it("clamps out-of-range admin config instead of trusting it", () => {
    const config = normalizeCashbackSettings({ ratePercent: 900, maxCashbackPerOrder: -5 });
    expect(config.ratePercent).toBe(100);
    expect(config.maxCashbackPerOrder).toBe(0);
  });
});

describe("Wallet Cashback — savings base", () => {
  it("combines catalog savings with the coupon discount", () => {
    expect(resolveSavingsBase({ productSavings: 80, discountTotal: 20 })).toBe(100);
  });

  it("reads through an order's frozen payment breakdown", () => {
    const order = { paymentBreakdown: { productSavings: 150, discountTotal: 50 } };
    expect(resolveSavingsBase(order)).toBe(200);
  });

  it("never lets a negative field reduce the base", () => {
    expect(resolveSavingsBase({ productSavings: -100, discountTotal: 30 })).toBe(30);
  });

  it("is zero for an order with no savings at all", () => {
    expect(resolveSavingsBase({})).toBe(0);
    expect(resolveSavingsBase()).toBe(0);
  });
});

describe("Wallet Cashback — settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies admin overrides from Setting.walletCashback", async () => {
    mockSettingFindOne.mockReturnValue(
      createQueryChain({
        walletCashback: { enabled: true, ratePercent: 3, maxCashbackPerOrder: 25 },
      }),
    );
    const settings = await getCashbackSettings();
    expect(settings.ratePercent).toBe(3);
    expect(computeCashbackForSavings(1000, settings)).toBe(25);
  });

  it("is off by default, at a 1% rate whenever it is switched on", async () => {
    mockSettingFindOne.mockReturnValue(createQueryChain(null));
    const settings = await getCashbackSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.ratePercent).toBe(1);
  });

  it("falls back to defaults instead of throwing when settings cannot be read", async () => {
    mockSettingFindOne.mockImplementation(() => {
      throw new Error("mongo down");
    });
    const settings = await getCashbackSettings();
    expect(settings.ratePercent).toBe(1);
  });
});
