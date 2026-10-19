import { clearChart, draw, getNumberOfPointsPlotted } from './chart.js';
import { InvalidFileError, NoDataFoundError, NotEnoughColumnsError } from './errors.js';
import { sanitizeInput } from './helpers.js';

const $ = id => document.getElementById(id);
const cv = $('cv')
const chartWrap = $('chart-wrap');

const drawGraph = () => draw(
  rows,
  headers,
  +$('xs').value,
  +$('ys').value,
  $('type').value,
  () => {
    $('status').textContent =
      `${fileName}: ${rows.length} rows, ${getNumberOfPointsPlotted()} points plotted.`;
  }
);

let headers = [], rows = [], fileName = '';

// Added: Reject non-CSV files and display an error on the chart.
function validateCSVFile(file) {
  if (/\.csv$/i.test(file.name)) return true;

  const message = 'Wrong file type. Please upload a CSV file.';

  clearChart(message,'#dc2626');
  $('err').textContent = message;

  return false;
}

// ---------- load data ----------
/**
 * Loads CSV data into the application.
 * @param {string} text - The CSV data as a string.
 * @param {string} name - The name of the CSV file.
 */
function load(text, name) {
  $('err').textContent = '';
  const all = parseCSV(text);

  if (all.length < 2) {
    clearChart('No data rows found.');
    return ($('err').textContent = 'No data rows found.');
  }

  headers = all[0].map((h, i) => h.trim() || 'col' + (i + 1));
  rows = all.slice(1);
  fileName = name;

  // keep only columns where most values are numbers
  const numeric = headers.map((_, j) => j).filter(j => {
    const sample = rows.slice(0, 500).filter(r => r[j] && r[j].trim() !== '');
    return sample.length > 0 &&
      sample.filter(r => !isNaN(Number(r[j]))).length / sample.length >= 0.8;
  });

  if (numeric.length < 2) {
    clearChart('Need at least two numeric columns.');
    return ($('err').textContent = 'Need at least two numeric columns.');
  }

  const options = numeric
    .map(j => `<option value="${j}">${headers[j]}</option>`)
    .join('');

  $('xs').innerHTML = options;
  $('ys').innerHTML = options;
  $('xs').value = numeric[0];
  $('ys').value = numeric[1];
  drawGraph();
}


// ---------- drag and drop file upload ----------

/**
 * @jessiezhang199 Idea: We can maybe add like a visual cue to change the screen
 * so when a file enters the drop area they know its a drag and drop.
 * I didn't even know this feature existed until I read the code and even then
 * though there's a blue box but it isn't really obvious
 */

/**
 * Enable dragging CSV files directly onto the chart area
 * Users can drag CSV files directly onto the chart area to load them.
 */
['dragenter', 'dragover'].forEach(evt => {
  chartWrap.addEventListener(evt, e => {
    e.preventDefault();
    chartWrap.classList.add('drag-over');
  });
});

/**
 * Removes the drag-over class when the drag leaves the chart area
 * or a file is dropped.
 */
['dragleave', 'drop'].forEach(evt => {
  chartWrap.addEventListener(evt, e => {
    e.preventDefault();
    chartWrap.classList.remove('drag-over');
  });
});

chartWrap.addEventListener('drop', e => {
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if (!f) return;

  // Added: Check files dropped onto the chart.
  if (!validateCSVFile(f)) return;

  const reader = new FileReader();
  reader.onload = () => load(reader.result, f.name);
  reader.readAsText(f);
});

// ---------- events ----------
$('file').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;

  // Added: Check the file type before reading.
  if (!validateCSVFile(f)) {
    e.target.value = '';
    return;
  }
  const reader = new FileReader();

  reader.onload = () => {
    load(reader.result, f.name);
    e.target.value = ''; // Reset input value so re-selecting same file works
  };

  reader.readAsText(f);
};

$('sample').onclick = () => {
  let csv = 'day,temperature,sales\n';

  for (let i = 0; i < 200; i++) {
    const t = 10 + 12 * Math.sin(i / 30) + Math.random() * 4;
    csv += `${i},${t.toFixed(2)},${(50 + t * 6 + Math.random() * 40).toFixed(1)}\n`;
  }

  load(csv, 'sample.csv');
};

/* Resize handler */

['xs', 'ys', 'type'].forEach(id => ($(id).onchange = drawGraph));
$('title').oninput = drawGraph;
window.addEventListener('resize', drawGraph);

// Added: Keep each editable font-size field synchronized with its preset menu.
const fontControls = [
  {
    inputId: 'axis-font-size',
    presetId: 'axis-font-preset',
    defaultSize: 18
  },
  {
    inputId: 'title-font-size',
    presetId: 'title-font-preset',
    defaultSize: 24
  }
];

// Added: Select the matching preset, or mark the typed value as custom.
function syncFontPreset(input, preset) {
  const matches = Array.from(preset.options).some(option =>
    option.value !== '' && option.value === input.value
  );

  preset.value = matches ? input.value : '';
}

// Added: Restore empty defaults and constrain entered sizes to integers 8–64.
function normalizeFontSize(control) {
  const input = $(control.inputId);
  const preset = $(control.presetId);
  const value = input.value === ''
    ? control.defaultSize
    : Number(input.value);

  input.value = String(
    Number.isFinite(value)
      ? Math.min(64, Math.max(8, Math.round(value)))
      : control.defaultSize
  );

  syncFontPreset(input, preset);
}

fontControls.forEach(control => {
  const input = $(control.inputId);
  const preset = $(control.presetId);

  // Added: Choosing a preset updates the visible numeric input.
  preset.addEventListener('change', () => {
    if (preset.value !== '') {
      input.value = preset.value;
    }
  });

  // Added: Allow free typing without changing the value mid-entry.
  input.addEventListener('input', () => {
    syncFontPreset(input, preset);
  });

  // Added: Validate the size when the user leaves the field.
  input.addEventListener('blur', () => {
    normalizeFontSize(control);
  });

  // Added: Keep the displayed defaults synchronized on startup.
  syncFontPreset(input, preset);
});

// Added: Regenerate the graph using the current labels and font sizes.
$('generate').onclick = () => {
  fontControls.forEach(normalizeFontSize);

  if (!rows.length) {
    $('err').textContent = 'Load a CSV or use sample data first.';
    return;
  }

  drawGraph();
};

/* Download chart as image */
$('dl').onclick = () => {
  if (!rows.length) return;

  const c = document.createElement('canvas');
  c.width = cv.width;
  c.height = cv.height;

  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(cv, 0, 0);

  const a = document.createElement('a');
  a.download = 'chart.png';
  a.href = c.toDataURL('image/png');
  a.click();
};

$('sample').click(); // start with sample data

