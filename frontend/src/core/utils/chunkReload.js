/**
 * Recovery for "Failed to fetch dynamically imported module" after a deploy.
 *
 * Every build gives lazy-loaded pages new hashed filenames and removes the old
 * ones. A user who still has the previous index.html / JS loaded will request a
 * chunk that no longer exists the next time they open a lazy page. Reloading
 * fetches the new index.html, which points at the new chunks.
 *
 * A timestamp guard stops reload loops if the chunk is genuinely broken.
 */

const RELOAD_KEY = 'chunk-reload-at';
const MIN_INTERVAL_MS = 15000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
];

export function isChunkLoadError(error) {
  if (!error) return false;
  const text = `${error.name || ''} ${error.message || error}`;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(text));
}

/**
 * Reload the page once to pick up the latest build.
 * @returns {boolean} true if a reload was triggered, false if one happened too recently.
 */
export function reloadForNewVersion() {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  } catch {
    // storage unavailable — fall through and reload once
  }
  if (Date.now() - last < MIN_INTERVAL_MS) return false;

  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
  return true;
}

/** Install the global listener Vite dispatches when a lazy import fails. */
export function installChunkErrorRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) {
      // Stop the error from reaching the router error page while we reload.
      event.preventDefault();
    }
  });
}
