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

let graphRows = [];
let graphHeaders = [];
let cachedPlot = { pts: [], sx: null, sy: null, xi: 0, yi: 0, type: 'scatter', x0: 0, x1: 0, y0: 0, y1: 0 };
// Zoom/Pan parameters expressed as percentages. For zoom (scale), 1.0 = no zoom and 0.0 = max zoom.
let zoomParameters = {xScale: 0.7, yScale: 0.7, xTranslate: 0.15, yTranslate: 0.15}
const MIN_ZOOM_SCALE = 0.00002, MAX_ZOOM_SCALE = 10000;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// Drag and cursor state
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let zoomCursorTimeout = null;

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
  cv.style.cursor = 'default';
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
// TODO: Split this function, way too big
function draw(rows, headers, xs = +$('xs').value, ys = +$('ys').value, type =$('type').value, completionHandler = null) {
  graphRows = rows;
  graphHeaders = headers;
  if (!rows.length) return;
  const xi = xs, yi = ys;

  // -- Update Cache data --

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
  if (!isDragging && !zoomCursorTimeout) cv.style.cursor = 'grab';

  // TODO: do we need the if statement?
  if (type === 'line') pts.sort((a, b) => a[0] - b[0]);

  // size canvas for sharp rendering on retina screens
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Find bounding box of charted points (min, max)
  let ptsXMin = Infinity, ptsXMax = -Infinity, ptsYMin = Infinity, ptsYMax = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    if (px < ptsXMin) ptsXMin = px;
    if (px > ptsXMax) ptsXMax = px;
    if (py < ptsYMin) ptsYMin = py;
    if (py > ptsYMax) ptsYMax = py;
  }
  if (ptsXMin === ptsXMax) { ptsXMin -= 1; ptsXMax += 1; }
  if (ptsYMin === ptsYMax) { ptsYMin -= 1; ptsYMax += 1; }

  // Apply unbounded zoom scaling and translation relative to data range
  const xRange = ptsXMax - ptsXMin;
  const yRange = ptsYMax - ptsYMin;
  const scaledXRange = xRange * zoomParameters.xScale;
  const scaledYRange = yRange * zoomParameters.yScale;

  let xMin = ptsXMin + xRange * zoomParameters.xTranslate;
  let yMin = ptsYMin + yRange * zoomParameters.yTranslate;
  let xMax = xMin + scaledXRange;
  let yMax = yMin + scaledYRange;

  // Pad
  const padX = scaledXRange * 0.04, padY = scaledYRange * 0.06;
  xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;

  // Calculate dynamic left margin based on Y-axis tick string width to prevent clipping
  ctx.font = '12px system-ui, sans-serif';
  const yTicks = niceTicks(yMin, yMax);
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
  const toScreenX = x => leftMargin + (x - xMin) / (xMax - xMin) * plotWidth;       // data -> pixel
  const toScreenY = y => topMargin + plotHeight - (y - yMin) / (yMax - yMin) * plotHeight;

  // Cache plot geometry for hover tooltip and pan/zoom lookups
  cachedPlot = { pts, sx: toScreenX, sy: toScreenY, xi, yi, type, L: leftMargin, T: topMargin, pw: plotWidth, ph: plotHeight, W, H };

  // -- Draw --

  // grid + tick labels
  ctx.strokeStyle = GRID; ctx.fillStyle = MUTED;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const tickX of niceTicks(xMin, xMax)) {
    const sx = toScreenX(tickX);
    if (sx < leftMargin || sx > leftMargin + plotWidth) continue;
    ctx.beginPath(); 
    ctx.moveTo(sx, topMargin);
    ctx.lineTo(sx, topMargin + plotHeight);
    ctx.stroke();
    ctx.fillText(fmt(tickX), sx, topMargin + plotHeight + 6);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const tickY of yTicks) {
    const sy = toScreenY(tickY);
    if (sy < topMargin || sy > topMargin + plotHeight) continue;
    ctx.beginPath(); 
    ctx.moveTo(leftMargin, sy);
    ctx.lineTo(leftMargin + plotWidth, sy);
    ctx.stroke();
    ctx.fillText(fmt(tickY), leftMargin - 8, sy);
  }

  // Not sure I like axis labels drawn on the canvas, TODO?
  // axis labels and title
  ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(headers[xi], leftMargin + plotWidth / 2, H - 10);
  ctx.save(); ctx.translate(14, topMargin + plotHeight / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(headers[yi], 0, 0); ctx.restore();
  if ($('title').value) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText($('title').value, leftMargin + plotWidth / 2, 24); }

  // data (clipped to the plot area so panned/zoomed data doesn't draw over margins)
  ctx.save();
  ctx.beginPath();
  ctx.rect(leftMargin, topMargin, plotWidth, plotHeight);
  ctx.clip();

  ctx.fillStyle = COLOR; ctx.strokeStyle = COLOR;
  if (type === 'line') {
    ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(toScreenX(x), toScreenY(y)) : ctx.moveTo(toScreenX(x), toScreenY(y))));
    ctx.stroke();
  } else {
    ctx.globalAlpha = pts.length > 1000 ? 0.45 : 0.75;
    const r = pts.length > 5000 ? 2 : 4;
    for (const [x, y] of pts) {
      // TODO: Move check somewhere else, knowing which points are in bounds is helpful elsewhere as well
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        ctx.beginPath(); ctx.arc(toScreenX(x), toScreenY(y), r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (completionHandler) completionHandler();
}

function getNumberOfPointsPlotted() {
  return cachedPlot ? cachedPlot.pts.length : 0;
}

/**
 * Resets active drag state and restores the default grab cursor.
 */
function stopDragging() {
  if (!isDragging) return;
  isDragging = false;
  cv.style.cursor = cachedPlot.pts.length ? 'grab' : 'default';
}

/* ---------- Pan, Zoom, and Hover tooltip functionality ---------- */

cv.addEventListener('mousedown', e => {
  if (!cachedPlot.pts.length) return;
  const rect = cv.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Only start dragging if clicking inside the chart plot area
  if (mouseX < cachedPlot.L || mouseX > cachedPlot.L + cachedPlot.pw ||
      mouseY < cachedPlot.T || mouseY > cachedPlot.T + cachedPlot.ph) {
    return;
  }

  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  cv.style.cursor = 'grabbing';
  tooltip.style.display = 'none';
});

window.addEventListener('mouseup', stopDragging);

/**
 * Handles drag-to-pan and hover tooltip functionality for the chart.
 */
cv.addEventListener('mousemove', e => {
  if (!cachedPlot.pts.length || !cachedPlot.sx) {
    tooltip.style.display = 'none';
    return;
  }

  const rect = cv.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const insidePlot = mouseX >= cachedPlot.L && mouseX <= cachedPlot.L + cachedPlot.pw &&
                     mouseY >= cachedPlot.T && mouseY <= cachedPlot.T + cachedPlot.ph;

  // If the user drags outside the chart plot area, virtually lift their finger up
  if (isDragging && !insidePlot) {
    stopDragging();
    return;
  }

  // Handle unbounded panning when dragging
  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // 1.08 and 1.12 account for the 4% X padding and 6% Y padding on each side
    if (cachedPlot.pw > 0) {
      zoomParameters.xTranslate -= (dx / cachedPlot.pw) * zoomParameters.xScale * 1.08;
    }
    if (cachedPlot.ph > 0) {
      zoomParameters.yTranslate += (dy / cachedPlot.ph) * zoomParameters.yScale * 1.12;
    }

    draw(graphRows, graphHeaders, cachedPlot.xi, cachedPlot.yi, cachedPlot.type);
    return;
  }

  if (!zoomCursorTimeout) {
    cv.style.cursor = insidePlot ? 'grab' : 'default';
  }

  // Search for the closest point within 10px radius
  let closest = null, minD2 = 100;
  if (insidePlot) {
    for (let i = 0; i < cachedPlot.pts.length; i++) {
      const p = cachedPlot.pts[i];
      const px = cachedPlot.sx(p[0]), py = cachedPlot.sy(p[1]);
      const d2 = (mouseX - px) ** 2 + (mouseY - py) ** 2;
      if (d2 < minD2) {
        minD2 = d2;
        closest = { x: p[0], y: p[1], px, py };
      }
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
 * Handles scroll-wheel zooming centered on the cursor position.
 */
cv.addEventListener('wheel', e => {
  if (!cachedPlot.pts.length || !cachedPlot.pw || !cachedPlot.ph) return;
  e.preventDefault();
  tooltip.style.display = 'none';

  const rect = cv.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Show zoom-in or zoom-out cursor while scrolling
  const zoomingIn = e.deltaY < 0;
  cv.style.cursor = zoomingIn ? 'zoom-in' : 'zoom-out';
  clearTimeout(zoomCursorTimeout);
  zoomCursorTimeout = setTimeout(() => {
    zoomCursorTimeout = null;
    cv.style.cursor = isDragging ? 'grabbing' : 'grab';
  }, 250);

  // Normalized cursor position within the plot area (0 to 1)
  const uX = clamp((mouseX - cachedPlot.L) / cachedPlot.pw, 0, 1);
  const uY = clamp(1 - (mouseY - cachedPlot.T) / cachedPlot.ph, 0, 1);

  const zoomFactor = zoomingIn ? 0.9 : 1.1;
  const oldXScale = zoomParameters.xScale;
  const oldYScale = zoomParameters.yScale;

  const newXScale = clamp(oldXScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
  const newYScale = clamp(oldYScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);

  // Adjust translation (including padding) so the point under the cursor stays stationary
  zoomParameters.xTranslate += (1.08 * uX - 0.04) * (oldXScale - newXScale);
  zoomParameters.yTranslate += (1.12 * uY - 0.06) * (oldYScale - newYScale);

  zoomParameters.xScale = newXScale;
  zoomParameters.yScale = newYScale;

  draw(graphRows, graphHeaders, cachedPlot.xi, cachedPlot.yi, cachedPlot.type);
}, { passive: false });

/**
 * Hides the tooltip and cancels dragging when the mouse leaves the canvas.
 */
cv.addEventListener('mouseleave', () => {
  stopDragging();
  tooltip.style.display = 'none';
});

export { clearChart, draw, getNumberOfPointsPlotted };