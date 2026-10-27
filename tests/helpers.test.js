import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, tickFormatter, fmt } from '../src/helpers.js';
import { InvalidFileError, NoDataFoundError, NotEnoughColumnsError, InvalidFileTypeError } from '../src/errors.js';

describe('niceTicks', () => {
  test('picks round steps of 1, 2 or 5 times a power of ten', () => {
    assert.deepEqual(niceTicks(0, 10), [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(niceTicks(0, 1), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  test('handles ranges that cross zero', () => {
    assert.deepEqual(niceTicks(-5, 5), [-4, -2, 0, 2, 4]);
  });

  test('returns just the value for an empty range, and nothing for NaN', () => {
    assert.deepEqual(niceTicks(5, 5), [5]);
    assert.deepEqual(niceTicks(NaN, 1), []);
  });

  test('never returns more than 50 ticks, so a bad range cannot freeze the page', () => {
    assert.equal(niceTicks(0, 1e9, 1000).length, 50);
  });

  test('keeps distinct ticks at large magnitudes (IDs near 1e17)', () => {
    const ticks = niceTicks(1e17, 1e17 + 1000);
    assert.ok(ticks.length >= 2);
    assert.equal(new Set(ticks).size, ticks.length);
  });

  test('includes the upper end when it is a multiple of the step', {
    todo: 'Edge case: 0.3 / 0.05 rounds to 5.999…, so niceTicks(0.1, 0.3) stops at 0.25 and drops 0.3.',
  }, () => {
    assert.equal(niceTicks(0.1, 0.3).at(-1), 0.3);
  });
});

describe('tickFormatter', () => {
  const labels = (min, max) => niceTicks(min, max).map(tickFormatter(min, max));

  test('formats every label on an axis with the same number of decimals', () => {
    assert.deepEqual(labels(0, 10), ['0', '2', '4', '6', '8', '10']);
    assert.deepEqual(labels(-1, 1), ['-1.0', '-0.5', '0', '0.5', '1.0']);
  });

  test('uses one shared exponent for very large or very small values', () => {
    assert.deepEqual(labels(0, 3e-6), ['0', '0.5e-6', '1.0e-6', '1.5e-6', '2.0e-6', '2.5e-6', '3.0e-6']);
    assert.deepEqual(labels(1e9, 1.00000005e9).slice(0, 2), ['1.00000000e9', '1.00000001e9']);
  });

  test('falls back to fmt for an empty range', () => {
    assert.equal(tickFormatter(5, 5)(1 / 3), '0.33333');
  });
});

describe('fmt', () => {
  test('rounds to 5 significant digits', () => {
    assert.equal(fmt(1 / 3), '0.33333');
    assert.equal(fmt(123456789), '123460000');
    assert.equal(fmt(-2.5), '-2.5');
    assert.equal(fmt(0), '0');
  });
});


describe('errors', () => {
  test('each error class keeps its message, name, and is an Error', () => {
    for (const ErrorClass of [InvalidFileError, NoDataFoundError, NotEnoughColumnsError, InvalidFileTypeError]) {
      const error = new ErrorClass('boom');
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'boom');
      assert.equal(error.name, ErrorClass.name);
    }
  });
});
