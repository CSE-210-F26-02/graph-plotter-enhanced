/**
 * Just enough of a browser for src/chart.js and src/app.js to run in Node.
 *
 * Every element id in the real src/index.html exists here (unknown ids return
 * null, like the real page). Elements are plain objects: inputs have a live
 * `value`, selects collect <option>s, click() runs onclick, and canvas calls
 * are no-ops (measureText returns 6px per character). Nothing is rendered; the
 * tests check state such as chart.cachedPlot, #status and #err instead.
 *
 * Import this BEFORE anything from src/.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pageIds = new Set(
  [...readFileSync(new URL('../../src/index.html', import.meta.url), 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
);

/** Values of the page's inputs, by id. Tests may change these. */
export const inputs = {};

/** Defaults taken from src/index.html. */
export function resetInputs() {
  for (const key of Object.keys(inputs)) delete inputs[key];
  Object.assign(inputs, {
    xs: '0', ys: '1', type: 'scatter',
    xlabel: '', ylabel: '', title: '',
    'axis-font-size': '18', 'title-font-size': '24',
  });
}
resetInputs();

function fakeElement(id) {
  const listeners = {};
  let options = [];
  return {
    id,
    style: {},
    textContent: '',
    get value() { return inputs[id] ?? ''; },
    set value(v) { inputs[id] = String(v); },
    get options() { return options; },
    set innerHTML(html) { if (String(html) === '') options = []; },
    add(option) { options.push(option); },
    onclick: null,
    onchange: null,
    click() { this.onclick?.(); },
    appendChild() {},
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
  };
}

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
  canvas.toDataURL = () => 'data:image/png;base64,';
  return canvas;
}

const elements = new Map();

/** Puts a specific object at an id, e.g. a real ChartElement at #demo-chart. */
export function setElement(id, element) {
  elements.set(id, element);
}

function byId(id) {
  if (!pageIds.has(id)) return null;
  if (!elements.has(id)) elements.set(id, fakeElement(id));
  return elements.get(id);
}

/** The #err element that chart.js and app.js write error messages into. */
export const errorBox = byId('err');

/** Every element created with document.createElement (canvas, tooltip), newest last. */
export const created = [];

globalThis.window ??= { devicePixelRatio: 1, addEventListener() {} };
// A "frame" every 16 ms, so code that redraws once per frame works in tests.
globalThis.requestAnimationFrame ??= (callback) => setTimeout(() => callback(performance.now()), 16);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.HTMLElement ??= class HTMLElement {
  appendChild() {}
  addEventListener() {}
};
globalThis.customElements ??= { define() {} };
globalThis.Option ??= class Option {
  constructor(text, value) { this.text = text; this.value = String(value); }
  cloneNode() { return new Option(this.text, this.value); }
};
/** Reads a fake file ({ name, text }) synchronously. */
globalThis.FileReader ??= class FileReader {
  readAsText(file) { this.result = file.text; this.onload?.(); }
};
globalThis.document ??= {
  createElement(tag) {
    const element = tag === 'canvas' ? fakeCanvas() : fakeElement();
    created.push(element);
    return element;
  },
  getElementById: byId,
  querySelector: () => fakeElement(),
};

// parser.js is a classic <script> in index.html, so parseCSV is a page global.
// Run the real file and expose it the same way.
const sandbox = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../src/parser.js', import.meta.url), 'utf8'), sandbox, { filename: 'parser.js' });
globalThis.parseCSV ??= sandbox.parseCSV;
