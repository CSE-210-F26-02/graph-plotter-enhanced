import { niceTicks, tickFormatter, fmt } from './helpers.js';

/**
 * @C-Herbert
 * @jp8577
 * @david1u
 * Refactored the chart drawing logic out into this file
 */

/** OLD
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
 * @typedef {Object} ChartPointData - Represents data based solely on the chart's assigned points.
 * @property {Array<Array<number>>} pts - All points represented by the chart.
 * @property {number} xMin - Minimum x coordinate within the point set.
 * @property {number} yMin - Minimum y coordinate within the point set.
 * @property {number} xMax - Maximum x coordinate within the point set.
 * @property {number} yMax - Maximum y coordinate within the point set.
 * @property {number} xRange - Range of x coordinates in the point set.
 * @property {number} yRange - Range of y coordinates in the point set.
 */

/**
 * @typedef {Object} ChartUIParameters - User controlled settings for how the chart is displayed
 * @property {string} type - Type of chart to be depicted. Can be either 'scatter' or 'line'.
 * @property {Array<string>} headers - List of headers availible for charting, read from input. Note both x and y use the same pool.
 * @property {number} xHeaderIndex - Index of the x-axis header (formerly xi)
 * @property {number} yHeaderIndex - Index of the y-axis header (formerly yi)
 * @property {number} axisFontSize - Font size for axis labels.
 * @property {number} titleFontSize - Font size for title labels.
 */

/**
 * @typedef {Object} ChartUIDimensions - Dimensions used for UI scaling/alignment throughout the code, driven by chart's UI parameters.
 * @property {number} leftMargin - Left margin extent of the plot relative to the canvas element, in pixels. Functions as base x-offset for graph region.
 * @property {number} rightMargin - Right margin extent of the plot relative to the canvas element, in pixels.
 * @property {number} topMargin - Top margin extent of the plot relative to the canvas element, in pixels. Functions as base y-offset for graph region.
 * @property {number} bottomMargin - Bottom margin extent of the plot relative to the canvas element, in pixels.
 * @property {number} plotWidth - Plot width, in pixels. Along with right and left margins, adds up to total canvas size in pixels.
 * @property {number} plotHeight - Plot height, in pixels. Along with top and bottom margins, adds up to total canvas size in pixels.
 */

/**
 * @typedef {Object} ZoomParameters
 * @property {Number} xScale - The x scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.
 * @property {Number} yScale - The y scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.
 * @property {Number} xTranslate - The x translation factor of the chart. Ranges from 0.0 to 1.0, representing the left and right edges respectively.
 * @property {Number} yTranslate - The y translation factor of the chart. Ranges from 0.0 to 1.0, representing the bottom and top edges respectively.
 */

/**
 * @typedef {Object} ZoomDimensions
 * @property {Number} xMin - Minimum x graph-coordinate in the zoomed frame.
 * @property {Number} yMin - Minimum y graph-coordinate in the zoomed frame.
 * @property {Number} xMax - Maximum x graph-coordinate in the zoomed frame.
 * @property {Number} yMax - Maximum y graph-coordinate in the zoomed frame.
 * @property {Number} xRange - Range of x values within zoomed frame.
 * @property {Number} yRange - Range of y values within zoomed frame.
 */

const $ = id => document.getElementById(id);
const COLOR = '#2563eb', GRID = '#e8ebf0', TEXT = '#1c2330', MUTED = '#6b7585';

const MIN_ZOOM_SCALE = 0.00002, MAX_ZOOM_SCALE = 10;
// Smallest visible range relative to the data's magnitude; below this, doubles can't tell ticks apart
const MIN_RELATIVE_RANGE = 1e-12;
// How far (px) a finger can wander and still count as a tap rather than a drag
const DRAG_THRESHOLD = 10;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Custom chart element that encapsulates the chart drawing logic and user interactions.
 */
class ChartElement extends HTMLElement {
  // Html components within chart element.
  #canvas;
  #context;
  #tooltip;

  /** @type {ChartPointData} */
  #ptData;
  
  /** @type {ChartUIParameters} */
  uiParameters = {type:'point', headers: ['x', 'y'], xHeaderIndex:0, yHeaderIndex:1, axisFontSize:12, titleFontSize:24};

  /** @type {ChartUIDimensions} */
  #uiDimensions;

  /** @type {ZoomParameters} */
  zoomParameters = {xScale: 1.0, yScale: 1.0, xTranslate: 0.0, yTranslate: 0.0}

  /** @type {ZoomDimensions} */
  #zoomDimensions;

  // Drag and cursor state
  isDragging = false;
  dragStartX = 0
  dragStartY = 0;
  zoomCursorTimeout = null;
  /* Variable to track the distance between two touch points for touch operations */
  // Know how far apart the screen moved to get a zoom factor for pinch-zooming; null when not pinching
  lastTouchDistance = null;
  tapPoint = null;

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
    this.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.addEventListener('touchend', this.onTouchEnd);
    this.addEventListener('touchcancel', this.onTouchEnd);

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
   * @param {string} [msg=''] - The message to display on the canvas.
   * Defaults to an empty string.
   * @returns {void}
   */
  clearChart(msg = '', color = MUTED) {
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
      ctx.fillStyle = color;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, W / 2, H / 2);
    }

    this.#ptData = null;
    this.#uiDimensions = null;
    this.#zoomDimensions = null;
  }

  /**
   * Restores the default (fully zoomed-out, unpanned) view and cancels any
   * in-progress interaction. Call before drawing newly loaded data.
   * @returns {void}
   */
  resetView() {
    this.zoomParameters = { xScale: 1.0, yScale: 1.0, xTranslate: 0.0, yTranslate: 0.0 };
    this.isDragging = false;
    this.#tooltip.style.display = 'none';
  }

  /** Updates the ptData structure of the chart. Automatically calls updateZoomDimensions (and, by extension, updateUIDimensions), since all dimension data needs to be recalculated.
   * @param {string[][]} data - The data to be plotted, as row, col strings from a CSV file.
   */
  updatePointData(data){
    if (!rows.length) return;

    // Read points from 'rows' into 'pts'
    let pts = [];
    for (const r of rows) {
      const x = Number(r[xHeaderIndex]), y = Number(r[yHeaderIndex]);
      if (r[xHeaderIndex]?.trim() !== '' && r[yHeaderIndex]?.trim() !== '' && isFinite(x) && isFinite(y)) {
        pts.push([x, y]);
      }
    }

    if (!pts.length) {
      this.clearChart('No valid numeric points found in selected columns.');
      throw new Error('No valid numbers in specified columns.');
    }

    pts.sort((a, b) => a[0] - b[0]);

    // Find bounding box of point set (min, max)
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

    this.#ptData = {pts:pts, xMin:ptsXMin, yMin:ptsYMin, xMax:ptsXMax, yMax:ptsYMax, xRange: ptsXMax - ptsXMin, yRange: ptsYMax - ptsYMin};
    this.updateZoomDimensions();
  }

  /**
   * Updates the zoomDimensions field of the chart, using cached zoomParameters and ptData. Automatically updates UI dimensions, since the data will be dirty after adjusting zoom.
   */
  updateZoomDimensions() {
    if (!this.#ptData) {
        throw new Error("Cannot update chart zoom dimensions without point data!");
    }

    const scaledXRange = this.#ptData.xRange * this.zoomParameters.xScale;
    const scaledYRange = this.#ptData.yRange * this.zoomParameters.yScale;

    // Calculate bounds for zoomed frame.
    let frameXMin = ptsXMin + this.#ptData.xRange * this.zoomParameters.xTranslate;
    let frameYMin = ptsYMin + this.#ptData.yRange * this.zoomParameters.yTranslate;
    let frameXMax = frameXMin + scaledXRange;
    let frameYMax = frameYMin + scaledYRange;

    // Pad - TODO: Remove? Already dealing with zoom, could just bake into scale factors
    const padX = scaledXRange * 0.04, padY = scaledYRange * 0.06;
    frameXMin -= padX; frameXMax += padX; frameYMin -= padY; frameYMax += padY;

    this.#zoomDimensions = {xMin: frameXMin, yMin: frameYMin, xMax: frameXMax, yMax: frameYMax, xRange: scaledXRange, yRange:scaledYRange};
    this.updateUIDimensions();
  }

  /**
   * Updates uiDimensions field of the chart, using cached zoomDimensions.
   */
  updateUIDimensions() {
    if (!this.#zoomDimensions) {
        throw new Error("Cannot update chart ui dimensions without zoom information!");
    }

    // Margin is any blank space outside of axis labels and grid lines

    // Calculate dynamic left margin based on Y-axis tick string width to prevent clipping
    this.#context.font = '12px system-ui, sans-serif';
    const yTicks = niceTicks(this.#zoomDimensions.yMin, this.#zoomDimensions.yMax);
    const fmtY = tickFormatter(this.#zoomDimensions.yMin, this.#zoomDimensions.yMax);
    let maxYTextWidth = 30;
    for (const t of yTicks) {
      const w = this.#context.measureText(fmtY(t)).width;
      if (w > maxYTextWidth) maxYTextWidth = w;
    }

    const leftMargin = Math.max(50, Math.ceil(maxYTextWidth + this.uiParameters.axisFontSize + 24));
    const rightMargin = 24;
    // TODO: Adapt to title existence - shrink more?
    const topMargin = Math.max(40, this.uiParameters.titleFontSize + 25);
    const bottomMargin = Math.max(50, this.uiParameters.axisFontSize + 34);

    // Dimensions of the plot space in pixels
    const plotWidth = this.#canvas.clientWidth - leftMargin - rightMargin;
    const plotHeight = this.#canvas.clientHeight - topMargin - bottomMargin;

    this.#uiDimensions = { leftMargin: leftMargin, rightMargin: rightMargin, topMargin: topMargin, bottomMargin: bottomMargin, plotWidth: plotWidth, plotHeight: plotHeight};
  }

  /**
   * Converts a x-coordinate from graph space to element-relative pixel space. Uses cached UI dimensions.
   * @param {Number} graphX 
   */
  toElementX(graphX) {
    return this.#uiDimensions.leftMargin + (graphX - this.#zoomDimensions.xMin) / (this.#zoomDimensions.xMax - this.#zoomDimensions.xMin) *  this.#uiDimensions.plotWidth;
  }

  /**
   * Converts a y-coordinate from graph space to element-relative pixel space.
   * @param {Number} graphX 
   */
  toElementY(graphY) {
    // TODO: Review
    return this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight - (graphY - this.#zoomDimensions.yMin) / ( this.#zoomDimensions.yMax -  this.#zoomDimensions.yMin) * this.#uiDimensions.plotHeight;
  }

  /**
   * Draws the chart on the canvas based on the current data and selected options.
   * @param {string[]} headers - The headers corresponding to the data columns.
   * @param {number} xHeaderIndex - The index of the X-axis column.
   * @param {number} yHeaderIndex - The index of the Y-axis column.
   * @param {string} type - The type of chart ('line' or 'scatter').
   * @param {function|null} [completionHandler=null] -
   * Optional callback to be executed after the chart is drawn.
   * @returns {void}
   */
    // Added: Read the shared axis-label size and the separate title size.
    //const axisFontSize = this.readFontSize('axis-font-size', 18);
    // const titleFontSize = this.readFontSize('title-font-size', 24);



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
  draw(completionHandler = null) {
    const cv = this.#canvas;
    const ctx = this.#context;
    // Added: Use custom axis names when provided; otherwise use column names.


    // TODO: Testing...
    // size canvas for sharp rendering on retina screens
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; 
    cv.height = H * dpr;

    if (!this.isDragging && !this.zoomCursorTimeout) cv.style.cursor = 'grab';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

        // -- Draw --
    // grid + tick labels
    // changed: Use dashed lines for gridlines to improve visual clarity.
    ctx.setLineDash([8,4]);
    ctx.strokeStyle = GRID;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Use fewer X ticks when labels get long (e.g. 1.0000005e9) so they never overlap
    let xCount = 12, xTicks, fmtX;
    for (; xCount >= 2; xCount--) {
      xTicks = niceTicks(this.#zoomDimensions.xMin, this.#zoomDimensions.xMax, xCount);
      fmtX = tickFormatter(this.#zoomDimensions.xMin, this.#zoomDimensions.xMax, xCount);
      let widest = 0;
      for (const t of xTicks) widest = Math.max(widest, ctx.measureText(fmtX(t)).width);
      if ((widest + 16) * xTicks.length <= this.#uiDimensions.plotWidth) break;
    }

    for (const tickX of xTicks) {
      const sx = this.toElementX(tickX);
      if (sx < this.#uiDimensions.leftMargin || sx > this.#uiDimensions.leftMargin + this.#uiDimensions.plotWidth) continue;
      ctx.beginPath(); 
      ctx.moveTo(sx, this.#uiDimensions.topMargin);
      ctx.lineTo(sx, this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight);
      ctx.stroke();
      ctx.fillText(fmtX(tickX), sx, this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight + 6);
    }

    ctx.textAlign = 'right'; 
    ctx.textBaseline = 'middle';

    // TODO: Remove $, should not reference elements from ChartElement.
    const xLabel = $('xlabel').value.trim() || headers[xHeaderIndex];
    const yLabel = $('ylabel').value.trim() || headers[yHeaderIndex];

    const yTicks = niceTicks(this.#zoomDimensions.yMin, this.#zoomDimensions.yMax);
    const fmtY = tickFormatter(this.#zoomDimensions.yMin, this.#zoomDimensions.yMax);

    for (const tickY of yTicks) {
      const sy = this.toElementY(tickY);
      if (sy < this.#uiDimensions.topMargin || sy > this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight) continue;
      ctx.beginPath(); 
      ctx.moveTo(this.#uiDimensions.leftMargin, sy);
      ctx.lineTo(this.#uiDimensions.leftMargin + this.#uiDimensions.plotWidth, sy);
      ctx.stroke();
      ctx.fillText(fmtY(tickY), this.#uiDimensions.leftMargin - 8, sy);
    }

    const xLabelCenter = this.#uiDimensions.leftMargin + this.#uiDimensions.plotWidth / 2;

    // Changed: Draw custom axis labels with the selected font size.
    ctx.fillStyle = TEXT;
    ctx.font = `${this.uiParameters.axisFontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(xLabel, xLabelCenter, H - 10);

    ctx.save();
    ctx.translate(this.uiParameters.axisFontSize / 2 + 8, this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Changed: Draw the title with its selected font size and matching spacing.
    // TODO: Remove $
    if ($('title').value) {
      ctx.font = `bold ${this.uiParameters.titleFontSize}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      // Add some top padding for the title to avoid overlapping with the chart area.
      const titlePadding = 10;

      ctx.fillText($('title').value, xLabelCenter, titlePadding);
    }

    // data (clipped to the plot area so panned/zoomed data doesn't draw over margins)
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.#uiDimensions.leftMargin, this.#uiDimensions.topMargin, this.#uiDimensions.plotWidth, this.#uiDimensions.plotHeight);
    ctx.clip();

    ctx.fillStyle = COLOR; 
    ctx.strokeStyle = COLOR;
    if (type === 'line') {
      ctx.lineWidth = 2; 
      ctx.beginPath();
      this.#ptData.pts.forEach(([x, y], i) => (
        i ? ctx.lineTo(this.toElementX(x), this.toElementY(y)) : ctx.moveTo(this.toElementX(x), this.toElementY(y))
      ));
      ctx.stroke();
    } else {
      ctx.globalAlpha = this.#ptData.pts > 1000 ? 0.45 : 0.75;
      const r = this.#ptData.pts > 5000 ? 2 : 4;
      for (const [x, y] of this.#ptData.pts) {
        // TODO: Move check somewhere else, knowing which points are in bounds is helpful elsewhere as well
        if (x >= this.zoomParameters.xMin && x <= this.zoomParameters.xMax && y >= this.zoomParameters.yMin && y <= this.zoomParameters.yMax) {
          ctx.beginPath(); 
          ctx.arc(this.toElementX(x), this.toElementY(y), r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (completionHandler) completionHandler();
  }

  // Added: Read editable font sizes safely while the user is typing.
  readFontSize(id, defaultSize) {
    const input = $(id);

    if (!input || input.value === '') return defaultSize;

    const value = Number(input.value);

    return Number.isFinite(value)
      ? Math.min(64, Math.max(8, Math.round(value)))
      : defaultSize;
  }

  getNumberOfPointsPlotted() {
    return this.#ptData ? this.#ptData.pts.length : 0;
  }

  /**
  * Resets active drag state and restores the default grab cursor.
  * @param {MouseEvent} e - The mouse event object.
  * @returns {void}
  */
  stopDragging() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.#canvas.style.cursor = this.#ptData?.pts.length ? 'grab' : 'default';
  }

  /**
   * Checks if a point is inside the plot
   * @param {number} x - The x position of the point to check, in plot-space pixel coordinates 
   * @param {number} y - The y position of the point to check, in plot-space pixel coordinates 
   * @returns {boolean} True if the point is within the plot boundaries, false otherwise.
   */
  isInsidePlot(x, y) {
    if (!this.#ptData) return false;
    if (x >= this.#uiDimensions.leftMargin && x <= (this.#uiDimensions.leftMargin + this.#uiDimensions.plotWidth) &&
        y >= this.#uiDimensions.topMargin && y <= (this.#uiDimensions.topMargin + this.#uiDimensions.plotHeight)) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Handles mouse down events for initiating drag-to-pan functionality.
   * @param {MouseEvent} e - The mouse event object.
   */
  onMouseDown(e) {
    if (!this.#ptData || !this.#ptData.pts.length) return;
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
  * 
  * @param {MouseEvent} e - The mouse event object.
  * @returns {void}
  */
  onMouseMove(e) {
    if (!this.#ptData || !this.#ptData.pts.length || !this.#uiDimensions) {
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
      
      // TODO: Double check comments are okay
      if (this.#uiDimensions.plotWidth > 0) {

        this.zoomParameters.xTranslate -= (dx / this.#uiDimensions.plotWidth); // * this.zoomParameters.xScale * 1.08;
      }
      if (this.#uiDimensions.plotHeight > 0) {
        this.zoomParameters.yTranslate += (dy / this.#uiDimensions.plotHeight); // * this.zoomParameters.yScale * 1.12;
      }

      this.updateZoomDimensions();
      this.draw();
      return;
    }

    if (!this.zoomCursorTimeout) {
      this.#canvas.style.cursor = insidePlot ? 'grab' : 'default';
    }

    // Search for the closest point within 10px radius
    let closest = null, minD2 = 100;
    if (insidePlot) {
      for (let i = 0; i < this.#ptData.pts.length; i++) {
        const p = this.#ptData.pts[i];
        const px = this.toElementX(p[0]), py = this.toElementY(p[1]);
        const d2 = (mouseX - px) ** 2 + (mouseY - py) ** 2;
        if (d2 < minD2) {
          minD2 = d2;
          closest = { x: p[0], y: p[1], px, py };
        }
      }
    }

    if (closest) {
      this.#tooltip.style.display = 'block';
      this.#tooltip.style.left = `${closest.px}px`;
      this.#tooltip.style.top = `${closest.py}px`;
      this.#tooltip.textContent = 
        `${this.uiParameters.headers[this.uiParameters.xHeaderIndex]}: ${fmt(closest.x)}, ${this.uiParameters.headers[this.uiParameters.yHeaderIndex]}: ${fmt(closest.y)}`;
    } else {
      this.#tooltip.style.display = 'none';
    }
  }

  /**
   * Handles scroll-wheel zooming centered on the cursor position.
   */
  onScrollWheel(e) {
    if (!this.#ptData || !this.#uiDimensions) return;
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
    const uX = clamp((mouseX - this.#uiDimensions.leftMargin) / this.#uiDimensions.plotWidth, 0, 1);
    const uY = clamp(1 - (mouseY - this.#uiDimensions.topMargin) / this.#uiDimensions.plotHeight, 0, 1);

    const zoomFactor = zoomingIn ? 0.9 : 1.1;
    const oldXScale = this.zoomParameters.xScale;
    const oldYScale = this.zoomParameters.yScale;

    let newXScale = clamp(oldXScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
    let newYScale = clamp(oldYScale * zoomFactor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);

    // Stop zooming in once the view would be narrower than floating point can resolve
    // (e.g. IDs near 1e17), otherwise tick labels collapse. Never forces a zoom out.
    if (zoomingIn) {
      const xAbs = Math.max(Math.abs(this.#ptData.xMin), Math.abs(this.#ptData.xMax));
      const yAbs = Math.max(Math.abs(this.#ptData.yMin), Math.abs(this.#ptData.yMax));
      newXScale = Math.max(newXScale, Math.min(oldXScale, xAbs * MIN_RELATIVE_RANGE / this.#ptData.xRange));
      newYScale = Math.max(newYScale, Math.min(oldYScale, yAbs * MIN_RELATIVE_RANGE / this.#ptData.yRange));
    }

    // Adjust translation (including padding) so the point under the cursor stays stationary
    this.zoomParameters.xTranslate += (1.08 * uX - 0.04) * (oldXScale - newXScale);
    this.zoomParameters.yTranslate += (1.12 * uY - 0.06) * (oldYScale - newYScale);

    this.zoomParameters.xScale = newXScale;
    this.zoomParameters.yScale = newYScale;

    this.updateZoomDimensions();
    this.draw();
  }

  /**
   * Calculates the distance between two touch points.
   * @param {TouchList} touches - An array of the current and last touch points.
   * @returns {number} The distance between the two touch points.
   */
  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Handles touch start events for tapping, panning and pinch-zooming.
   * @param {TouchEvent} e - The touch event object.
   */
  onTouchStart(e) {
    if (!this.#ptData || !this.#uiDimensions) return;
    if (e.touches.length === 1) {
      /* Tap or drag gesture detected; initiate dragging if the touch is within the plot area. */
      this.onMouseDown(e.touches[0]);
      if (this.isDragging) {
        e.preventDefault();
        this.tapPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    } else if (e.touches.length === 2) {
      /* Pinch-to-zoom gesture detected; cancel any ongoing drag and record the initial distance between the two touch points. */
      e.preventDefault();
      this.tapPoint = null;
      this.stopDragging();
      this.lastTouchDistance = this.getTouchDistance(e.touches);
    }
  }

  /**
   * Handles touch move events for detecting panning and pinch-zooming.
   * If zooming handles the zooming, otherwise it pans and redraws exactly like a mouse drag.
   * @param {TouchEvent} e - The touch event object.
   */
  onTouchMove(e) {
    if (!this.#ptData || !this.#uiDimensions) return;

    if (e.touches.length === 1 && this.isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      if (this.tapPoint) {
        const moved = Math.hypot(touch.clientX - this.tapPoint.x, touch.clientY - this.tapPoint.y);
        if (moved < DRAG_THRESHOLD) return;
        this.tapPoint = null;
      }
      // Pans and redraws exactly like a mouse drag
      this.onMouseMove(touch);
    } else if (e.touches.length === 2 && this.lastTouchDistance !== null) {
      e.preventDefault();
      const currentDistance = this.getTouchDistance(e.touches);
      const zoomFactor = currentDistance / this.lastTouchDistance;

      // Adjust zoom based on pinch gesture
      const zoomingIn = zoomFactor > 1;
      const factor = zoomingIn ? 0.9 : 1.1;

      const oldXScale = this.zoomParameters.xScale;
      const oldYScale = this.zoomParameters.yScale;

      let newXScale = clamp(oldXScale * factor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
      let newYScale = clamp(oldYScale * factor, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);

      // Stop zooming in once the view would be narrower than floating point can resolve
      // Note: might want to swap to zoom dimensions since those seem to be more appropriate?
      if (zoomingIn) {
        const xAbs = Math.max(Math.abs(this.#ptData.xMin), Math.abs(this.#ptData.xMax));
        const yAbs = Math.max(Math.abs(this.#ptData.yMin), Math.abs(this.#ptData.yMax));
        newXScale = Math.max(newXScale, Math.min(oldXScale, xAbs * MIN_RELATIVE_RANGE / this.#ptData.xRange));
        newYScale = Math.max(newYScale, Math.min(oldYScale, yAbs * MIN_RELATIVE_RANGE / this.#ptData.yRange));
      }

      
      this.zoomParameters.xScale = newXScale;
      this.zoomParameters.yScale = newYScale;

      this.updateZoomDimensions();
      this.draw();
      this.lastTouchDistance = currentDistance;
    }
  }

  /**
   * Handles touch end events for tapping, panning and pinch-zooming.
   * @param {TouchEvent} e - The touch event object.
   */
  onTouchEnd(e) {
    if (e.touches.length === 0) {
      this.stopDragging();
      this.lastTouchDistance = null;
      if (this.tapPoint && e.type === 'touchend') {
        this.onMouseMove(e.changedTouches[0]);
      }
      this.tapPoint = null;
    } else if (e.touches.length === 1) {
      /* Lifting one finger of a pinch resumes panning with the remaining finger */
      this.lastTouchDistance = null;
      this.tapPoint = null;
      this.onMouseDown(e.touches[0]);
    }
  }

  /**
   * Getter for chart's canvas. Only used for downloading.
   */
  get chartCanvas() {
    return this.#canvas;
  }

  // Not sure if this should be exposed, but it was used in app.js

  /**
   * Getter for chart's draw context.
   */
  get chartContext() {
    return this.#context;
  }
}



customElements.define('custom-chart', ChartElement);

export { ChartElement };
