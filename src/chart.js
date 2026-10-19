import { niceTicks, fmt } from './helpers.js';

/**
 * @C-Herbert
 * @jp8577
 * @david1u
 * Refactored the chart drawing logic out into this file
 */

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const tooltip = $('tooltip');
const COLOR = '#2563eb', GRID = '#e8ebf0', TEXT = '#1c2330', MUTED = '#6b7585';
let graphHeaders = [];

let cachedPlot = {
  pts: [],
  sx: null,
  sy: null,
  xi: 0,
  yi: 0,
  x0: 0,
  x1: 0,
  y0: 0,
  y1: 0
};

// Added: Read editable font sizes safely while the user is typing.
function readFontSize(id, defaultSize) {
  const input = $(id);

  if (!input || input.value === '') return defaultSize;

  const value = Number(input.value);

  return Number.isFinite(value)
    ? Math.min(64, Math.max(8, Math.round(value)))
    : defaultSize;
}

/**
 * Clears the Canvas where the chart is drawn when state resets or an error occurs.
 * @param {string} [msg=''] - The message to display on the canvas.
 * Defaults to an empty string.
 * @returns {void}
 */
function clearChart(msg = '') {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 800, H = cv.clientHeight || 480;
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (msg) {
    ctx.fillStyle = MUTED;
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, H / 2);
  }
}

/**
 * Draws the chart on the canvas based on the current data and selected options.
 * @param {string[][]} rows - The data rows to be plotted.
 * @param {string[]} headers - The headers corresponding to the data columns.
 * @param {number} xs - The index of the X-axis column.
 * By default, it uses the value from the 'xs' select element.
 * @param {number} ys - The index of the Y-axis column.
 * By default, it uses the value from the 'ys' select element.
 * @param {string} type - The type of chart ('line' or 'scatter').
 * By default, it uses the value from the 'type' select element.
 * @param {function|null} [completionHandler=null] -
 * Optional callback to be executed after the chart is drawn.
 * @returns {void}
 */
function draw(
  rows,
  headers,
  xs = +$('xs').value,
  ys = +$('ys').value,
  type = $('type').value,
  completionHandler = null
) {
  graphHeaders = headers;
  if (!rows.length) return;
  const xi = xs, yi = ys;

  // Added: Use custom axis names when provided; otherwise use column names.
  const xLabel = $('xlabel').value.trim() || headers[xi];
  const yLabel = $('ylabel').value.trim() || headers[yi];

  // Added: Read the shared axis-label size and the separate title size.
  const axisFontSize = readFontSize('axis-font-size', 18);
  const titleFontSize = readFontSize('title-font-size', 24);

  let pts = [];
  for (const r of rows) {
    const x = Number(r[xi]), y = Number(r[yi]);
    if (r[xi] !== '' && r[yi] !== '' && isFinite(x) && isFinite(y)) {
      pts.push([x, y]);
    }
  }

  if (!pts.length) {
    clearChart('No valid numeric points found in selected columns.');
    return ($('err').textContent = 'No valid numbers in those columns.');
  }

  $('err').textContent = '';
  if (type === 'line') pts.sort((a, b) => a[0] - b[0]);

  // size canvas for sharp rendering on retina screens
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Avoid call stack overflow for large datasets by iterating
  // instead of spreading Math.min(...pts)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }

  if (x0 === x1) {
    x0 -= 1;
    x1 += 1;
  }

  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }

  const padX = (x1 - x0) * 0.04, padY = (y1 - y0) * 0.06;
  x0 -= padX;
  x1 += padX;
  y0 -= padY;
  y1 += padY;

  // Calculate dynamic left margin based on Y-axis tick string width
  // to prevent clipping
  ctx.font = '12px system-ui, sans-serif';
  const yTicks = niceTicks(y0, y1);
  let maxYTextWidth = 30;
  for (const t of yTicks) {
    const w = ctx.measureText(fmt(t)).width;
    if (w > maxYTextWidth) maxYTextWidth = w;
  }

  // Changed: Reserve additional space for larger axis labels and titles.
  const L = Math.max(50, Math.ceil(maxYTextWidth + axisFontSize + 24));
  const R = 24;
  const T = $('title').value ? Math.max(40, titleFontSize + 25) : 20;
  const B = Math.max(50, axisFontSize + 34);
  const pw = W - L - R, ph = H - T - B;

  const sx = x => L + (x - x0) / (x1 - x0) * pw; // data -> pixel
  const sy = y => T + ph - (y - y0) / (y1 - y0) * ph;

  // Cache plot geometry for hover tooltip lookups
  cachedPlot = { pts, sx, sy, xi, yi, L, T, pw, ph, W, H };

  // grid + tick labels
  // changed: Use dashed lines for gridlines to improve visual clarity.
  ctx.setLineDash([8,4]);
  ctx.strokeStyle = GRID;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // change for the x-axis gridline
  for (const t of niceTicks(x0, x1, 12)) {
    ctx.beginPath();
    ctx.moveTo(sx(t), T);
    ctx.lineTo(sx(t), T + ph);
    ctx.stroke();
    ctx.fillText(fmt(t), sx(t), T + ph + 6);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    ctx.beginPath();
    ctx.moveTo(L, sy(t));
    ctx.lineTo(L + pw, sy(t));
    ctx.stroke();
    ctx.fillText(fmt(t), L - 8, sy(t));
  }

  // Changed: Draw custom axis labels with the selected font size.
  ctx.fillStyle = TEXT;
  ctx.font = `${axisFontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(xLabel, L + pw / 2, H - 10);

  ctx.save();
  ctx.translate(axisFontSize / 2 + 8, T + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Changed: Draw the title with its selected font size and matching spacing.
  if ($('title').value) {
    ctx.font = `bold ${titleFontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText($('title').value, L + pw / 2, 10);
  }

  // data
  ctx.fillStyle = COLOR;
  ctx.strokeStyle = COLOR;
  if (type === 'line') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (
      i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))
    ));
    ctx.stroke();
  } else {
    ctx.globalAlpha = pts.length > 1000 ? 0.45 : 0.75;
    const r = pts.length > 5000 ? 2 : 4;
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (completionHandler) completionHandler();
}

function getNumberOfPointsPlotted() {
  return cachedPlot ? cachedPlot.pts.length : 0;
}

/* ---------- Hover tooltip functionality ---------- */
/**
 * Handles hover tooltip functionality for the chart.
 * Displays the closest data point to the mouse cursor within a 10px radius.
 */
cv.addEventListener('mousemove', e => {
  if (!cachedPlot.pts.length || !cachedPlot.sx) {
    tooltip.style.display = 'none';
    return;
  }

  const rect = cv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Search for the closest point within 10px radius
  let closest = null, minD2 = 100;
  for (let i = 0; i < cachedPlot.pts.length; i++) {
    const p = cachedPlot.pts[i];
    const px = cachedPlot.sx(p[0]), py = cachedPlot.sy(p[1]);
    const d2 = (mx - px) ** 2 + (my - py) ** 2;
    if (d2 < minD2) {
      minD2 = d2;
      closest = { x: p[0], y: p[1], px, py };
    }
  }

  if (closest) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${closest.px}px`;
    tooltip.style.top = `${closest.py}px`;
    tooltip.textContent =
      `${graphHeaders[cachedPlot.xi]}: ${fmt(closest.x)}, ${graphHeaders[cachedPlot.yi]}: ${fmt(closest.y)}`;
  } else {
    tooltip.style.display = 'none';
  }
});

/**
 * Hides the tooltip when the mouse leaves the chart area.
 */
cv.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});

export { clearChart, draw, getNumberOfPointsPlotted };
