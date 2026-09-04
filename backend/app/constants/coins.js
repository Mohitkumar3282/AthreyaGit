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
 * "Every ₹1 you save = 1 Paisa Coin."
 *
 *   ₹1 saved   -> 1 coin    (₹0.01)
 *   ₹100 saved -> 100 coins (₹1)
 *   ₹500 saved -> 500 coins (₹5)
 *
 * One coin is one paisa, so the programme returns 1% of realised savings —
 * denominated in coins because that is what the customer sees.
 */
export const DEFAULT_COIN_SETTINGS = {
  enabled: true,
  // Coins granted per rupee of realised savings (MRP discount + coupon).
  coinsPerRupeeSaved: 1,
  // Rupee value of one coin. 1 coin = 1 paisa, so 100 coins = ₹1.
  rupeeValuePerCoin: 0.01,
  // Smallest redemption allowed. A single coin is worth a paisa, so there is
  // no meaningful floor to enforce — the customer types what they want to use.
  minRedeemCoins: 1,
  // Hard ceiling on how much of an order's payable coins may settle. At a
  // paisa a coin this is effectively non-binding; it exists so ops can
  // tighten it without a deploy.
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
