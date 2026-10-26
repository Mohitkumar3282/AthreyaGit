/**
 * Opens a WhatsApp chat with a ready message.
 *
 * Uses the universal https://wa.me link instead of the phone-only
 * `whatsapp://` scheme. The custom scheme is silently blocked inside installed
 * web apps (PWA), in-app browsers / WebViews, previews and desktop browsers
 * ("Not allowed to launch 'whatsapp://' ..."), so customers saw nothing happen.
 * wa.me opens the WhatsApp app on phones and WhatsApp Web on computers.
 */
export function openWhatsApp(phoneDigits, message) {
  const number = String(phoneDigits || "").replace(/[^\d]/g, "");
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message || "")}`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Same tab: lets the OS hand the link over to the WhatsApp app.
    window.location.href = url;
  } else {
    const w = window.open(url, "_blank", "noopener");
    if (!w) window.location.href = url; // popup blocked -> navigate instead
  }
}
