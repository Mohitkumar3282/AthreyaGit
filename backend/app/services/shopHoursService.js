import Seller from "../models/seller.js";

/**
 * Automatic shop open/close.
 *
 * A shop is OPEN when it is inside its store timings (India time) AND the
 * owner has not manually paused it. `Seller.isOpen` is kept in sync with that
 * result by `shopHoursSyncJob`, so every existing `isOpen: true` filter in the
 * codebase keeps working unchanged.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istMinutesOfDay(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function parseClock(token) {
  const m = String(token || "")
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === "pm" && h !== 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
  } else if (h > 24) {
    return null;
  }
  return (h % 24) * 60 + min;
}

/**
 * "9:00 AM - 10:00 PM" | "9am to 10pm" | "09:00-22:00" | "24 hours"
 * -> { openMin, closeMin, allDay } or null when it cannot be understood.
 */
export function parseStoreTimings(text) {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return null;
  if (/24\s*(x\s*7|hours|hrs|h)|all\s*day|always/.test(raw)) {
    return { openMin: 0, closeMin: 0, allDay: true };
  }
  const parts = raw.split(/\s*(?:-|–|—|to)\s*/);
  if (parts.length !== 2) return null;
  const openMin = parseClock(parts[0]);
  const closeMin = parseClock(parts[1]);
  if (openMin === null || closeMin === null) return null;
  if (openMin === closeMin) return { openMin, closeMin, allDay: true };
  return { openMin, closeMin, allDay: false };
}

export function isWithinTimings(parsed, date = new Date()) {
  if (!parsed || parsed.allDay) return true;
  const now = istMinutesOfDay(date);
  const { openMin, closeMin } = parsed;
  return openMin < closeMin
    ? now >= openMin && now < closeMin
    : now >= openMin || now < closeMin; // overnight, e.g. 6 PM - 2 AM
}

const fmt = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Open/closed right now plus a customer-facing reason. */
export function getShopStatus(seller, date = new Date()) {
  const parsed = parseStoreTimings(seller?.storeTimings);
  const inHours = isWithinTimings(parsed, date);
  const paused = seller?.manuallyClosed === true;
  const isOpen = inHours && !paused;
  let closedMessage = "";
  if (!isOpen) {
    if (paused) {
      closedMessage = "This shop is temporarily closed.";
    } else if (parsed) {
      closedMessage = `Shop closed. Opens at ${fmt(parsed.openMin)}.`;
    } else {
      closedMessage = "This shop is currently closed.";
    }
  }
  return { isOpen, inHours, paused, closedMessage, hours: seller?.storeTimings || "" };
}

/** Writes the computed state back to Seller.isOpen for rows that changed. */
export async function syncShopOpenStatus() {
  const now = new Date();
  const sellers = await Seller.find({})
    .select("_id isOpen storeTimings manuallyClosed")
    .lean();
  const ops = [];
  for (const s of sellers) {
    const open = getShopStatus(s, now).isOpen;
    if (s.isOpen !== open) {
      ops.push({ updateOne: { filter: { _id: s._id }, update: { $set: { isOpen: open } } } });
    }
  }
  if (ops.length) await Seller.bulkWrite(ops, { ordered: false });
  return ops.length;
}
