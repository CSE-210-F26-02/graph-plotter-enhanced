import { niceTicks, fmt } from './helpers.js';

/**
 * @C-Herbert
 * @jp8577
 * @david1u 
 * Refactored the chart drawing logic out into this file
 */

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const tooltip = $('tooltip')
const COLOR = '#2563eb', GRID = '#e8ebf0', TEXT = '#1c2330', MUTED = '#6b7585';
let graphHeaders = [];

let cachedPlot = { pts: [], sx: null, sy: null, xi: 0, yi: 0, x0: 0, x1: 0, y0: 0, y1: 0 };

/**
 * Clears the Canvas where the chart is drawn when state resets or an error occurs.
 * @param {string} [msg=''] - The message to display on the canvas. Defaults to an empty string.
 * @returns {void}
 */
function clearChart(msg = '') {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 800, H = cv.clientHeight || 480;
  cv.width = W * dpr; cv.height = H * dpr;
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
 * @param {number} xs - The index of the X-axis column. By default, it uses the value from the 'xs' select element.
 * @param {number} ys - The index of the Y-axis column. By default, it uses the value from the 'ys' select element.
 * @param {string} type - The type of chart ('line' or 'scatter'). By default, it uses the value from the 'type' select element.
 * @param {function|null} [completionHandler=null] - Optional callback to be executed after the chart is drawn.
 * @returns {void}
 */
function draw(rows, headers,xs = +$('xs').value, ys = +$('ys').value, type = $('type').value, completionHandler = null) {
  graphHeaders = headers;
  if (!rows.length) return;
  const xi = xs, yi = ys;

  // Read points from 'rows' into 'pts'
  let pts = [];
  for (const r of rows) {
    const x = Number(r[xi]), y = Number(r[yi]);
    if (r[xi] !== '' && r[yi] !== '' && isFinite(x) && isFinite(y)) pts.push([x, y]);
  }
  if (!pts.length) {
    clearChart('No valid numeric points found in selected columns.');
    return ($('err').textContent = 'No valid numbers in those columns.');
  }
  $('err').textContent = '';
  // TODO: do we need the if statement?
  if (type === 'line') pts.sort((a, b) => a[0] - b[0]);

  // size canvas for sharp rendering on retina screens
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Find bounding box of charted points (min, max)
  let x_min = Infinity, x_max = -Infinity, y_min = Infinity, y_max = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    if (px < x_min) x_min = px;
    if (px > x_max) x_max = px;
    if (py < y_min) y_min = py;
    if (py > y_max) y_max = py;
  }
  if (x_min === x_max) { x_min -= 1; x_max += 1; }
  if (y_min === y_max) { y_min -= 1; y_max += 1; }
  const padX = (x_max - x_min) * 0.04, padY = (y_max - y_min) * 0.06;
  x_min -= padX; x_max += padX; y_min -= padY; y_max += padY;

  // Calculate dynamic left margin based on Y-axis tick string width to prevent clipping
  ctx.font = '12px system-ui, sans-serif';
  const yTicks = niceTicks(y_min, y_max);
  let maxYTextWidth = 30;
  for (const t of yTicks) {
    const w = ctx.measureText(fmt(t)).width;
    if (w > maxYTextWidth) maxYTextWidth = w;
  }

  // Margin is any blank space outside of axis labels and grid lines
  const leftMargin = Math.max(50, Math.ceil(maxYTextWidth + 24));
  const rightMargin = 24;
  const topMargin = $('title').value ? 40 : 20;
  const bottomMargin = 50;

  // Dimensions of the plot space in pixels
  const plotWidth = W - leftMargin - rightMargin;
  const plotHeight = H - topMargin - bottomMargin;

  // Converts coordinates relative to plot space (in margins) to actual screen positions
  // Cache vars have all this information, could move them out to their own functions
  const toScreenX = x => leftMargin + (x - x_min) / (x_max - x_min) * plotWidth;       // data -> pixel
  const toScreenY = y => topMargin + plotHeight - (y - y_min) / (y_max - y_min) * plotHeight;

  // Cache plot geometry for hover tooltip lookups
  cachedPlot = { pts, sx: toScreenX, sy: toScreenY, xi, yi, L: leftMargin, T: topMargin, pw: plotWidth, ph: plotHeight, W, H };

  // grid + tick labels
  ctx.strokeStyle = GRID; ctx.fillStyle = MUTED;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const tickX of niceTicks(x_min, x_max)) {
    ctx.beginPath(); 
    ctx.moveTo(toScreenX(tickX), topMargin);
    ctx.lineTo(toScreenX(tickX), topMargin + plotHeight);
    ctx.stroke();
    ctx.fillText(fmt(tickX), toScreenX(tickX), topMargin + plotHeight + 6);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const tickY of yTicks) {
    ctx.beginPath(); 
    ctx.moveTo(leftMargin, toScreenY(tickY));
    ctx.lineTo(leftMargin + plotWidth, toScreenY(tickY));
    ctx.stroke();
    ctx.fillText(fmt(tickY), leftMargin - 8, toScreenY(tickY));
  }

  // Not sure I like axis labels drawn on the canvas, TODO?
  // axis labels and title
  ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(headers[xi], leftMargin + plotWidth / 2, H - 10);
  ctx.save(); ctx.translate(14, topMargin + plotHeight / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(headers[yi], 0, 0); ctx.restore();
  if ($('title').value) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText($('title').value, leftMargin + plotWidth / 2, 24); }

  // data
  ctx.fillStyle = COLOR; ctx.strokeStyle = COLOR;
  if (type === 'line') {
    ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(toScreenX(x), toScreenY(y)) : ctx.moveTo(toScreenX(x), toScreenY(y))));
    ctx.stroke();
  } else {
    ctx.globalAlpha = pts.length > 1000 ? 0.45 : 0.75;
    const r = pts.length > 5000 ? 2 : 4;
    for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(toScreenX(x), toScreenY(y), r, 0, Math.PI * 2); ctx.fill(); }
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
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Search for the closest point within 10px radius
  let closest = null, minD2 = 100;
  for (let i = 0; i < cachedPlot.pts.length; i++) {
    const p = cachedPlot.pts[i];
    const px = cachedPlot.sx(p[0]), py = cachedPlot.sy(p[1]);
    const d2 = (mouseX - px) ** 2 + (mouseY - py) ** 2;
    if (d2 < minD2) {
      minD2 = d2;
      closest = { x: p[0], y: p[1], px, py };
    }
  }

  if (closest) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${closest.px}px`;
    tooltip.style.top = `${closest.py}px`;
    tooltip.textContent = `${graphHeaders[cachedPlot.xi]}: ${fmt(closest.x)}, ${graphHeaders[cachedPlot.yi]}: ${fmt(closest.y)}`;
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