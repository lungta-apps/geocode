// api/_lib/cache.js
const store = new Map();

/**
 * Get cached value if not expired.
 * @param {string} key
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
    }
  return entry.value;
}

/**
 * Set cached value with TTL (default 5 minutes).
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs
 */
export function set(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0
  });
}

/** Delete a key. */
export function del(key) {
  store.delete(key);
}
