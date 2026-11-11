// Stops MongoDB-operator injection ({"email": {"$ne": null}} in a JSON body, or ?email[$ne]=x in the URL)
// and prototype-pollution keys before any route sees the data.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || BLOCKED_KEYS.has(k)) continue;
      out[k] = cleanValue(v);
    }
    return out;
  }
  return value;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = cleanValue(req.body);
  next();
}

// Query values must be plain strings (or lists of strings); nested objects are dropped.
function sanitizeQuery(req, res, next) {
  const clean = {};
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k.startsWith('$') || BLOCKED_KEYS.has(k)) continue;
    if (typeof v === 'string') clean[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) clean[k] = v;
  }
  // Express 5 makes req.query a read-only getter, so define our own copy.
  Object.defineProperty(req, 'query', { value: clean, writable: true, configurable: true, enumerable: true });
  next();
}

module.exports = { sanitizeBody, sanitizeQuery };
