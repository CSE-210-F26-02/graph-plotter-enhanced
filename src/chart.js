import { niceTicks, fmt } from './helpers.js';

/**
 * @C-Herbert
 * @jp8577
 * @david1u 
 * Refactored the chart drawing logic out into this file
 */

/**
 * @typedef {Object} ChartData
 * @property {Array<Array<number>>} pts - All points represented by the chart.
 * @property {function} sx - Function for scaling plot-space x-coordinates to element-relative screen space.
 * @property {function} sy - Function for scaling plot-space y-coordinates to element-relative screen space.
 * @property {number} xi - Index of the x-axis header
 * @property {number} yi - Index of the y-axis header
 * @property {string} type - Type of chart to be depicted. Can be either 'scatter' or 'line'.
 * @property {number} L - Left margin extent of the plot relative to the canvas element, in pixels. Functions as base x-offset for graph region. 
 * @property {number} T - Top margin extent of the plot relative to the canvas element, in pixels. Functions as base y-offset for graph region. 
 * @property {number} pw - Plot width, in pixels.
 * @property {number} ph - Plot height, in pixels.
 * @property {number} W - Width of the canvas element depicting the chart, in pixels.
 * @property {number} H - Width of the canvas element depicting the chart, in pixels.
 */

/**
 * @typedef {Object} ZoomParameters
 * @property {Number} xScale - The x scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.
 * @property {Number} yScale - The y scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.
 * @property {Number} xTranslate - The x translation factor of the chart. Ranges from 0.0 to 1.0, representing the left and right edges respectively.
 * @property {Number} yTranslate - The y translation factor of the chart. Ranges from 0.0 to 1.0, representing the bottom and top edges respectively.
 */

const $ = id => document.getElementById(id);

const COLOR = '#2563eb', GRID = '#e8ebf0', TEXT = '#1c2330', MUTED = '#6b7585';

const MIN_ZOOM_SCALE = 0.00002, MAX_ZOOM_SCALE = 10;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

class ChartElement extends HTMLElement {
  // Formerly cv
  #canvas;
  #context;
  #tooltip;

  graphRows = [];
  graphHeaders = [];
  /** @type {ChartData} */
  cachedPlot;
  
  /** @type {ZoomParameters} */
  zoomParameters = {xScale: 1.0, yScale: 1.0, xTranslate: 0.0, yTranslate: 0.0}

  // Drag and cursor state
  isDragging = false;
  dragStartX = 0
  dragStartY = 0;
  zoomCursorTimeout = null;

  constructor(){
    super();

    this.#canvas = document.createElement("canvas");
    this.#context = this.#canvas.getContext('2d');
    this.#tooltip = document.createElement("div");
    this.appendChild(this.#canvas);
    this.appendChild(this.#tooltip);
    // Needed for CSS styling
    this.#tooltip.id = "tooltip";

    this.addEventListener('mousedown', this.onMouseDown);
    this.addEventListener('mousemove', this.onMouseMove);
    this.addEventListener('wheel', this.onScrollWheel, { passive: false });

    /**
     * Hides the tooltip and cancels dragging when the mouse leaves the canvas.
     */
    this.addEventListener('mouseleave', () => {
      this.stopDragging();
      this.#tooltip.style.display = 'none';
    });

    this.addEventListener('mouseup', this.stopDragging);
  }

  /**
   * Clears the Canvas where the chart is drawn when state resets or an error occurs.
   * @param {string} [msg=''] - The message to display on the canvas. Defaults to an empty string.
   * @returns {void}
   */
  clearChart(msg = '') {
    const cv = this.#canvas;
    const ctx = this.#context;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 800, H = cv.clientHeight || 480;

    cv.width = W * dpr;
    cv.height = H * dpr;
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
  draw(rows, headers, xs = +$('xs').value, ys = +$('ys').value, type =$('type').value, completionHandler = null) {
    const cv = this.#canvas;
    const ctx = this.#context;
    this.graphRows = rows;
    this.graphHeaders = headers;
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
    if (!this.isDragging && !this.zoomCursorTimeout) cv.style.cursor = 'grab';

    // TODO: do we need the if statement?
    if (type === 'line') pts.sort((a, b) => a[0] - b[0]);

    const W = cv.clientWidth, H = cv.clientHeight;
    // size canvas for sharp rendering on retina screens
    const dpr = window.devicePixelRatio || 1;
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
    const scaledXRange = xRange * this.zoomParameters.xScale;
    const scaledYRange = yRange * this.zoomParameters.yScale;

    let xMin = ptsXMin + xRange * this.zoomParameters.xTranslate;
    let yMin = ptsYMin + yRange * this.zoomParameters.yTranslate;
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

    // Converts plot-space coordinates to ChartElement-relative screen positions.
    const toElementX = x => leftMargin + (x - xMin) / (xMax - xMin) * plotWidth;       // data -> pixel
    const toElementY = y => topMargin + plotHeight - (y - yMin) / (yMax - yMin) * plotHeight;

    // Cache plot geometry for hover tooltip and pan/zoom lookups
    this.cachedPlot = { pts, sx: toElementX, sy: toElementY, xi, yi, type, L: leftMargin, T: topMargin, pw: plotWidth, ph: plotHeight, W, H };

    // -- Draw --

    // grid + tick labels
    ctx.strokeStyle = GRID; ctx.fillStyle = MUTED;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const tickX of niceTicks(xMin, xMax)) {
      const sx = toElementX(tickX);
      if (sx < leftMargin || sx > leftMargin + plotWidth) continue;
      ctx.beginPath(); 
      ctx.moveTo(sx, topMargin);
      ctx.lineTo(sx, topMargin + plotHeight);
      ctx.stroke();
      ctx.fillText(fmt(tickX), sx, topMargin + plotHeight + 6);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const tickY of yTicks) {
      const sy = toElementY(tickY);
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
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(toElementX(x), toElementY(y)) : ctx.moveTo(toElementX(x), toElementY(y))));
      ctx.stroke();
    } else {
      ctx.globalAlpha = pts.length > 1000 ? 0.45 : 0.75;
      const r = pts.length > 5000 ? 2 : 4;
      for (const [x, y] of pts) {
        // TODO: Move check somewhere else, knowing which points are in bounds is helpful elsewhere as well
        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
          ctx.beginPath(); ctx.arc(toElementX(x), toElementY(y), r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (completionHandler) completionHandler();
  }

  getNumberOfPointsPlotted() {
    return this.cachedPlot ? this.cachedPlot.pts.length : 0;
  }

  /**
  * Resets active drag state and restores the default grab cursor.
  */
  stopDragging() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.#canvas.style.cursor = this.cachedPlot.pts.length ? 'grab' : 'default';
  }

  /**
   * Checks if a point is inside the plot
   * @param {number} x - The x position of the point to check, in plot-space pixel coordinates 
   * @param {number} y - The y position of the point to check, in plot-space pixel coordinates 
   * @returns {boolean} True if the point is within the plot boundaries, false otherwise.
   */
  isInsidePlot(x, y) {
    if (!this.cachedPlot) return false;
    if (x >= this.cachedPlot.L && x <= (this.cachedPlot.L + this.cachedPlot.pw) &&
        y >= this.cachedPlot.T && y <= (this.cachedPlot.T + this.cachedPlot.ph)) {
      return true;
    } else {
      return false;
    }
  }

  onMouseDown(e) {
    if (!this.cachedPlot || !this.cachedPlot.pts.length) return;
    const rect = this.#canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Only start dragging if clicking inside the chart plot area
    if (!this.isInsidePlot(mouseX, mouseY)) return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.#canvas.style.cursor = 'grabbing';
    this.#tooltip.style.display = 'none';
  }

  /**
  * Handles drag-to-pan and hover tooltip functionality for the chart.
  */
  onMouseMove(e) {
    if (!this.cachedPlot || !this.cachedPlot.pts.length || !this.cachedPlot.sx) {
      this.#tooltip.style.display = 'none';
      return;
    }

    const rect = this.#canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const insidePlot = this.isInsidePlot(mouseX, mouseY);

    // If the user drags outside the chart plot area, virtually lift their finger up
    if (this.isDragging && !insidePlot) {
      this.stopDragging();
      return;
    }

    // Handle unbounded panning when dragging
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      // 1.08 and 1.12 account for the 4% X padding and 6% Y padding on each side
      if (this.cachedPlot.pw > 0) {
        this.zoomParameters.xTranslate -= (dx / this.cachedPlot.pw) * this.zoomParameters.xScale * 1.08;
      }
      if (this.cachedPlot.ph > 0) {
        this.zoomParameters.yTranslate += (dy / this.cachedPlot.ph) * this.zoomParameters.yScale * 1.12;
      }

      this.draw(this.graphRows, this.graphHeaders, this.cachedPlot.xi, this.cachedPlot.yi, this.cachedPlot.type);
      return;
    }

    if (!this.zoomCursorTimeout) {
      this.#canvas.style.cursor = insidePlot ? 'grab' : 'default';
    }

    // Search for the closest point within 10px radius
    let closest = null, minD2 = 100;
    if (insidePlot) {
      for (let i = 0; i < this.cachedPlot.pts.length; i++) {
        const p = this.cachedPlot.pts[i];
        const px = this.cachedPlot.sx(p[0]), py = this.cachedPlot.sy(p[1]);
        const d2 = (mouseX - px) ** 2 + (mouseY - py) ** 2;
        if (d2 < minD2) {
          minD2 = d2;
          closest = { x: p[0], y: p[1], px, py };
        }
      }
    }

    if (closest) {
      this.#tooltip.style.display = 'block';
      this.#tooltip.style.left = `${closest.px + rect.left}px`;
      this.#tooltip.style.top = `${closest.py + rect.top}px`;
      this.#tooltip.textContent = `${this.graphHeaders[this.cachedPlot.xi]}: ${fmt(closest.x)}, ${this.graphHeaders[this.cachedPlot.yi]}: ${fmt(closest.y)}`;
    } else {
      this.#tooltip.style.display = 'none';
    }
  }

  /**
   * Handles scroll-wheel zooming centered on the cursor position.
   */
  onScrollWheel(e) {
    if (!this.cachedPlot.pts || !this.cachedPlot.pts.length || !this.cachedPlot.pw || !this.cachedPlot.ph) return;
    e.preventDefault();
    this.#tooltip.style.display = 'none';

    const rect = this.#canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Show zoom-in or zoom-out cursor while scrolling
    const zoomingIn = e.deltaY < 0;
    this.#canvas.style.cursor = zoomingIn ? 'zoom-in' : 'zoom-out';
    clearTimeout(this.zoomCursorTimeout);
    this.zoomCursorTimeout = setTimeout(() => {
      this.zoomCursorTimeout = null;
      this.#canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
    }, 250);

    // Normalized cursor position within the plot area (0 to 1)
    const uX = clamp((mouseX - this.cachedPlot.L) / this.cachedPlot.pw, 0, 1);
    const uY = clamp(1 - (mouseY - this.cachedPlot.T) / this.cachedPlot.ph, 0, 1);

    const zoomFactor = zoomingIn ? 0.9 : 1.1;
    const oldXScale = this.zoomParameters.xScale;
    const oldYScale = this.zoomParameters.yScale;

    const newXScale = clamp(oldXScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
    const newYScale = clamp(oldYScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);

    // Adjust translation (including padding) so the point under the cursor stays stationary
    this.zoomParameters.xTranslate += (1.08 * uX - 0.04) * (oldXScale - newXScale);
    this.zoomParameters.yTranslate += (1.12 * uY - 0.06) * (oldYScale - newYScale);

    this.zoomParameters.xScale = newXScale;
    this.zoomParameters.yScale = newYScale;

    this.draw(this.graphRows, this.graphHeaders, this.cachedPlot.xi, this.cachedPlot.yi, this.cachedPlot.type);
  }
}

customElements.define('custom-chart', ChartElement);

export { ChartElement };