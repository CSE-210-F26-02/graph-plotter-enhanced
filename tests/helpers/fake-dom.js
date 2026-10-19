/**
 * Just enough of a browser for src/chart.js to run in Node.
 *
 * ChartElement extends HTMLElement, draws on a <canvas> 2D context, and reads
 * page inputs (#xlabel, #title, font sizes...) through document.getElementById.
 * This module provides stand-ins for those, so draw() can run and its results
 * (cachedPlot, the points, the axis mapping) can be checked. Nothing is
 * rendered; canvas calls are no-ops, and measureText returns 6px per character.
 *
 * Import this BEFORE src/chart.js.
 */

/** Values of the page inputs that chart.js reads. Tests may change these. */
export const inputs = {};

export function resetInputs() {
  for (const key of Object.keys(inputs)) delete inputs[key];
  Object.assign(inputs, {
    xs: '0', ys: '1', type: 'scatter',
    xlabel: '', ylabel: '', title: '',
    'axis-font-size': '18', 'title-font-size': '24',
  });
}
resetInputs();

/** The #err element that chart.js writes error messages into. */
export const errorBox = { textContent: '' };

const fakeElement = () => ({
  style: {},
  textContent: '',
  appendChild() {},
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
});

function fakeCanvas() {
  const canvas = fakeElement();
  canvas.clientWidth = 800;
  canvas.clientHeight = 480;
  const context = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text) => ({ width: String(text).length * 6 });
      return () => {}; // fillText, arc, stroke, setLineDash, ...
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  canvas.getContext = () => context;
  return canvas;
}

globalThis.window ??= { devicePixelRatio: 1 };
globalThis.HTMLElement ??= class HTMLElement {
  appendChild() {}
  addEventListener() {}
};
globalThis.customElements ??= { define() {} };
/** Every element chart.js creates (its canvas and tooltip), newest last. */
export const created = [];

globalThis.document ??= {
  createElement(tag) {
    const element = tag === 'canvas' ? fakeCanvas() : fakeElement();
    created.push(element);
    return element;
  },
  getElementById(id) {
    if (id === 'err') return errorBox;
    if (!(id in inputs)) return null;
    // Live view of `inputs`, so tests can change a value between calls.
    return { get value() { return inputs[id]; }, set value(v) { inputs[id] = String(v); }, textContent: '' };
  },
};
