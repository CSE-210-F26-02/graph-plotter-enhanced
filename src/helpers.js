/**
 * 
 * @todo Needs fix on edge case when the numbers are very big causes program to freeze
 * Generates a "nice" set of tick values for a given numeric range.
 * 
 * @param {int} min 
 * @param {int} max 
 * @param {int} count 
 * @returns {int[]} An array of "nice" tick values within the specified range.
 */
function niceTicks(min, max, count = 6) {
  const raw = (max - min) / count;
  if (!isFinite(raw) || raw <= 0) return [min];
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max || v + step === v; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

/**
 * Formats a number to a string with a precision of 5 significant digits.
 * @param {number} v 
 * @returns {string}
 */
const fmt = v => String(+v.toPrecision(5));

/**
 * Sanitize any string and remove potentially harmful characters or attacks
 * @param {string} str
 * @returns {string}
 */
function sanitizeInput(str) {
  
    const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  };

  return String(str).replace(/[&<>]/g, match => entities[match]);
}

export { niceTicks, fmt, sanitizeInput };