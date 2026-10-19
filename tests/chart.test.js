import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inputs, resetInputs, errorBox, created } from './helpers/fake-dom.js';
import { ChartElement } from '../src/chart.js';

// The fake canvas is 800 x 480 px; see helpers/fake-dom.js.
let chart, tooltip;

beforeEach(() => {
  resetInputs();
  errorBox.textContent = '';
  chart = new ChartElement();
  tooltip = created.findLast((element) => element.id === 'tooltip');
});

afterEach(() => clearTimeout(chart.zoomCursorTimeout)); // zoom leaves a 250 ms cursor timer

const HEADERS = ['x', 'y'];
const draw = (rows, type = 'scatter') => chart.draw(rows, HEADERS, 0, 1, type);
const plotted = () => chart.cachedPlot.pts;
const center = () => ({
  clientX: chart.cachedPlot.L + chart.cachedPlot.pw / 2,
  clientY: chart.cachedPlot.T + chart.cachedPlot.ph / 2,
});

describe('draw: which points are plotted', () => {
  test('plots every row with numbers in both columns', () => {
    draw([['1', '2'], ['3', '4'], ['5', '6']]);
    assert.deepEqual(plotted(), [[1, 2], [3, 4], [5, 6]]);
    assert.equal(chart.getNumberOfPointsPlotted(), 3);
  });

  test('skips blank cells, text, Infinity and missing columns', () => {
    draw([['1', '2'], ['', '5'], ['abc', '5'], ['3', ' '], ['Infinity', '1'], ['7'], ['4', '8']]);
    assert.deepEqual(plotted(), [[1, 2], [4, 8]]);
  });

  test('reads numbers written as 1e3, -2.5 or with spaces', () => {
    draw([['1e3', '-2.5'], [' 4 ', '5']]);
    assert.deepEqual(plotted(), [[1000, -2.5], [4, 5]]);
  });

  test('line charts connect points in X order; scatter keeps file order', () => {
    const rows = [['3', '9'], ['1', '1'], ['2', '4']];
    draw(rows, 'line');
    assert.deepEqual(plotted().map(([x]) => x), [1, 2, 3]);
    draw(rows, 'scatter');
    assert.deepEqual(plotted().map(([x]) => x), [3, 1, 2]);
  });

  test('does not change the rows passed in', () => {
    const rows = [['3', '9'], ['1', '1']];
    draw(rows, 'line');
    assert.deepEqual(rows, [['3', '9'], ['1', '1']]);
  });

  test('shows an error and clears the plot when no point is valid', () => {
    draw([['a', 'b'], ['', '']]);
    assert.equal(chart.cachedPlot, null);
    assert.equal(chart.getNumberOfPointsPlotted(), 0);
    assert.equal(errorBox.textContent, 'No valid numbers in those columns.');
  });

  test('does nothing for an empty dataset', () => {
    assert.doesNotThrow(() => draw([]));
    assert.equal(chart.getNumberOfPointsPlotted(), 0);
  });
});

describe('draw: axis mapping', () => {
  test('every point lands inside the plot area, with higher Y drawn higher up', () => {
    draw([['0', '0'], ['10', '100'], ['5', '50']]);
    const { sx, sy, L, T, pw, ph } = chart.cachedPlot;
    for (const [x, y] of plotted()) {
      assert.ok(sx(x) > L && sx(x) < L + pw, `x=${x} drawn at ${sx(x)}`);
      assert.ok(sy(y) > T && sy(y) < T + ph, `y=${y} drawn at ${sy(y)}`);
    }
    assert.ok(sy(100) < sy(0), 'larger Y should be closer to the top');
  });

  test('a column with one repeated value still maps to real pixels', () => {
    draw([['5', '7'], ['5', '7']]);
    const { sx, sy } = chart.cachedPlot;
    assert.ok(Number.isFinite(sx(5)) && Number.isFinite(sy(7)));
  });

  test('a title makes room at the top of the chart', () => {
    draw([['0', '0'], ['1', '1']]);
    const noTitle = chart.cachedPlot.T;
    inputs.title = 'Sales';
    draw([['0', '0'], ['1', '1']]);
    assert.ok(chart.cachedPlot.T > noTitle);
  });
});

describe('readFontSize', () => {
  test('rounds and limits sizes to 8–64', () => {
    inputs['axis-font-size'] = '20.6';
    assert.equal(chart.readFontSize('axis-font-size', 18), 21);
    inputs['axis-font-size'] = '2';
    assert.equal(chart.readFontSize('axis-font-size', 18), 8);
    inputs['axis-font-size'] = '500';
    assert.equal(chart.readFontSize('axis-font-size', 18), 64);
  });

  test('uses the default for empty, non-numeric or missing inputs', () => {
    inputs['axis-font-size'] = '';
    assert.equal(chart.readFontSize('axis-font-size', 18), 18);
    inputs['axis-font-size'] = 'big';
    assert.equal(chart.readFontSize('axis-font-size', 18), 18);
    assert.equal(chart.readFontSize('no-such-input', 24), 24);
  });
});

describe('interaction', () => {
  const rows = [['0', '0'], ['10', '100']];

  test('isInsidePlot is false before anything is drawn, then matches the plot area', () => {
    assert.equal(chart.isInsidePlot(400, 240), false);
    draw(rows);
    const { clientX, clientY } = center();
    assert.equal(chart.isInsidePlot(clientX, clientY), true);
    assert.equal(chart.isInsidePlot(1, 1), false);
  });

  test('scrolling up zooms in around the cursor; scrolling down zooms out', () => {
    draw(rows);
    chart.onScrollWheel({ ...center(), deltaY: -1, preventDefault() {} });
    assert.ok(Math.abs(chart.zoomParameters.xScale - 0.9) < 1e-12);
    chart.onScrollWheel({ ...center(), deltaY: 1, preventDefault() {} });
    assert.ok(Math.abs(chart.zoomParameters.xScale - 0.99) < 1e-12);
  });

  test('zooming out stops at the maximum scale of 10', () => {
    draw(rows);
    for (let i = 0; i < 60; i++) chart.onScrollWheel({ ...center(), deltaY: 1, preventDefault() {} });
    assert.equal(chart.zoomParameters.xScale, 10);
  });

  test('dragging inside the plot pans the view; leaving the plot stops the drag', () => {
    draw(rows);
    const start = center();
    chart.onMouseDown(start);
    assert.equal(chart.isDragging, true);
    chart.onMouseMove({ clientX: start.clientX + 50, clientY: start.clientY });
    assert.ok(chart.zoomParameters.xTranslate < 0, 'dragging right should move the view left');
    chart.onMouseMove({ clientX: 1, clientY: 1 });
    assert.equal(chart.isDragging, false);
  });

  test('resetView restores the full, unpanned view', () => {
    draw(rows);
    chart.onScrollWheel({ ...center(), deltaY: -1, preventDefault() {} });
    chart.resetView();
    assert.deepEqual(chart.zoomParameters, { xScale: 1, yScale: 1, xTranslate: 0, yTranslate: 0 });
  });

  test('hovering near a point shows its column names and values', () => {
    draw([['1', '2'], ['3', '4']]);
    const { sx, sy } = chart.cachedPlot;
    chart.onMouseMove({ clientX: sx(3) + 2, clientY: sy(4) - 2 });
    assert.equal(tooltip.style.display, 'block');
    assert.equal(tooltip.textContent, 'x: 3, y: 4');
    chart.onMouseMove({ clientX: sx(1) + 200, clientY: sy(2) });
    assert.equal(tooltip.style.display, 'none');
  });
});
