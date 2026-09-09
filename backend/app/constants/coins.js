/**
 * Athreya Coins — loyalty currency constants.
 *
 * Coins are a NON-MONETARY loyalty unit kept deliberately separate from the
 * audited money ledger (`Wallet` / `LedgerEntry`). A coin is redeemable for a
 * configurable rupee value at checkout, but it is never withdrawable and never
 * settles against seller / rider payouts — the platform absorbs the redemption
 * exactly like a coupon discount.
 */

export const COIN_TRANSACTION_TYPE = {
  // Coins granted for an order's customer savings (MRP discount + coupon).
  EARN: "EARN",
  // Coins spent at checkout.
  REDEEM: "REDEEM",
  // Redeemed coins handed back when an order is cancelled / refunded.
  REVERSAL: "REVERSAL",
  // Manual admin grant or clawback.
  ADJUSTMENT: "ADJUSTMENT",
  // Coins clawed back when an earning order is later returned.
  EXPIRY: "EXPIRY",
};

export const ALL_COIN_TRANSACTION_TYPES = Object.values(COIN_TRANSACTION_TYPE);

export const COIN_DIRECTION = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
};

export const ALL_COIN_DIRECTIONS = Object.values(COIN_DIRECTION);

export const COIN_WALLET_STATUS = {
  ACTIVE: "ACTIVE",
  FROZEN: "FROZEN",
};

export const ALL_COIN_WALLET_STATUSES = Object.values(COIN_WALLET_STATUS);

/**
 * When coins earned for an order actually land in the customer's balance.
 *   DELIVERY  – credited by `settleDeliveredOrder` (default; abuse-safe).
 *   PLACEMENT – credited inside `placeOrderAtomic`.
 */
export const COIN_CREDIT_TRIGGER = {
  DELIVERY: "DELIVERY",
  PLACEMENT: "PLACEMENT",
};

export const ALL_COIN_CREDIT_TRIGGERS = Object.values(COIN_CREDIT_TRIGGER);

/**
 * Athreya Coins Conversion:
 *   ₹100 saved -> 1,000 Athreya Coins (10 coins per ₹1 saved)
 *
 * Wallet value:
 *   1,000 Coins = ₹1.00 (1 coin = ₹0.001)
 */
export const DEFAULT_COIN_SETTINGS = {
  enabled: true,
  // Coins granted per rupee of realised savings (MRP discount + coupon).
  // ₹100 saved = 1,000 Athreya Coins.
  coinsPerRupeeSaved: 10,
  // Rupee value of one coin. 1,000 coins = ₹1.00, so 1 coin = ₹0.001.
  rupeeValuePerCoin: 0.001,
  // Smallest redemption allowed.
  minRedeemCoins: 1,
  // Hard ceiling on how much of an order's payable coins may settle.
  maxRedeemPercentOfOrder: 100,
  // 0 = uncapped.
  maxEarnPerOrder: 0,
  creditOn: COIN_CREDIT_TRIGGER.DELIVERY,
};

export default {
  COIN_TRANSACTION_TYPE,
  COIN_DIRECTION,
  COIN_WALLET_STATUS,
  COIN_CREDIT_TRIGGER,
  DEFAULT_COIN_SETTINGS,
};
