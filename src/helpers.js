// Upper bound on ticks per axis, so a bad range can never freeze the page.
const MAX_TICKS = 50

/**
 * Picks a "nice" (1, 2 or 5 times a power of ten) step for a numeric range.
 * @param {number} min
 * @param {number} max
 * @param {number} count - Approximate number of ticks wanted.
 * @returns {number} The step, or NaN if the range is empty or not finite.
 */
function niceStep(min, max, count = 6) {
    let raw = (max - min) / count
    if (
        raw == 0 &&
        (max >= Number.MAX_SAFE_INTEGER || min <= Number.MIN_SAFE_INTEGER)
    )
        raw = BigInt(max) - BigInt(min) / BigInt(count)
    if (!isFinite(raw) || raw <= 0) return NaN
    const p = 10 ** Math.floor(Math.log10(raw))
    const m = raw / p
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
}

/**
 * Generates a "nice" set of tick values for a given numeric range.
 * Works for any magnitude: each tick is computed as index * step (no running sum),
 * values are rounded relative to the step, and the count is capped at MAX_TICKS.
 *
 * @param {number} min
 * @param {number} max
 * @param {number} count - Approximate number of ticks wanted.
 * @returns {number[]} An array of "nice" tick values within the specified range.
 */
function niceTicks(min, max, count = 6) {
    const step = niceStep(min, max, count)
    if (isNaN(step)) return isFinite(min) ? [min] : []

    // Decimal places needed to represent a multiple of step exactly
    const decimals = Math.min(100, Math.max(0, -Math.floor(Math.log10(step))))
    const first = Math.ceil(min / step)
    const last = Math.floor(max / step)
    const ticks = []
    for (let i = first; i <= last && ticks.length < MAX_TICKS; i++) {
        const v = +(i * step).toFixed(decimals)
        // When step is below float precision at this magnitude, neighbours collapse; skip repeats
        if (ticks[ticks.length - 1] !== v) ticks.push(v)
    }
    return ticks
}

/**
 * Builds a label formatter for ticks of a given range so that every label on an
 * axis uses the same notation and number of digits. Small/typical magnitudes use
 * fixed notation; very large or very small ones share one exponent (e.g. 1.25e9).
 *
 * @param {number} min
 * @param {number} max
 * @param {number} count - Must match the count passed to niceTicks.
 * @returns {function(number): string}
 */
function tickFormatter(min, max, count = 6) {
    const step = niceStep(min, max, count)
    if (isNaN(step)) return fmt

    const stepExp = Math.floor(Math.log10(step))
    const maxAbs = Math.max(Math.abs(min), Math.abs(max))
    const maxExp = maxAbs > 0 ? Math.floor(Math.log10(maxAbs)) : stepExp
    const isZero = (v) => Math.abs(v) < step / 2

    if (maxExp < 7 && maxExp >= -4 && stepExp >= -10) {
        const decimals = Math.max(0, -stepExp)
        return (v) => (isZero(v) ? '0' : v.toFixed(decimals))
    }

    // Common exponent for the whole axis; digits are capped at what a double can hold
    const scale = 10 ** maxExp
    const digits = Math.min(15, Math.max(0, maxExp - stepExp))
    return (v) => (isZero(v) ? '0' : `${(v / scale).toFixed(digits)}e${maxExp}`)
}

/**
 * Formats a number to a string with a precision of 5 significant digits.
 * @param {number} v
 * @returns {string}
 */
const fmt = (v) => String(+v.toPrecision(5))

export { niceTicks, tickFormatter, fmt }
