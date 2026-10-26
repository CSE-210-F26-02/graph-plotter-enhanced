import { ChartElement } from './chart.js';
import { InvalidFileError, NoDataFoundError, NotEnoughColumnsError } from './errors.js';
import { sanitizeInput } from './helpers.js';


const $ = id => document.getElementById(id);
const chart = $('demo-chart');
const chartWrap = $('chart-wrap');

const showWhichSaveButton = () => {
    if ($('title').value.trim() === '') {
    document.querySelector('.control-wrapper').style.display = 'flex';
    document.querySelector('#dl:not(.control-wrapper #dl)').style.display = 'none';
  }
  else {
    document.querySelector('.control-wrapper').style.display = 'none';
    document.querySelector('#dl:not(.control-wrapper #dl)').style.display = 'inline-block';
  }
};

const adjustSaveButtonSize = () => {
  if (!$('title').value) return;
  const metrics = chart.chartContext.measureText($('title').value);
  const trueHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  // Set the save button position based on the title height
  const saveButton = document.querySelector('#dl:not(.control-wrapper #dl)');
  if (saveButton) {
    saveButton.style.minHeight = `${Math.max(32, trueHeight)}px`;
  }
};

let rows = [], fileName = '';
/*
const drawGraph = () => chart.draw(
  rows,
  headers,
  +$('xs').value,
  +$('ys').value,
  $('type').value,
  () => {
    $('status').textContent =
      `${fileName}: ${rows.length} rows, ${chart.getNumberOfPointsPlotted()} points plotted.`;
  }
);*/

// Added: Reject non-CSV files and display an error on the chart.
function validateCSVFile(file) {
  if (/\.csv$/i.test(file.name)) return true;

  const message = 'Wrong file type. Please upload a CSV file.';

  chart.clearChart(message,'#dc2626');
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
  try {
    $('err').textContent = '';
    const all = parseCSV(text);

    if (all.length < 2) {
      throw new NoDataFoundError('No data rows found.');
    }
    chart.uiParameters.headers = all[0].map((h, i) => sanitizeInput(h).trim() || 'col' + (i + 1));
    rows = all.slice(1);
    fileName = name;

    // keep only columns where most values are numbers
    const numeric = chart.uiParameters.headers.map((_, j) => j).filter(j => {
      const sample = rows.slice(0, 500).filter(r => r[j] && r[j].trim() !== '');
      return sample.length > 0 &&
        sample.filter(r => !isNaN(Number(r[j]))).length / sample.length >= 0.8;
    });

    if (numeric.length < 2) {
      throw new NotEnoughColumnsError('Need at least two numeric columns.');
    }

    const options = numeric.map(j => new Option(chart.uiParameters.headers[j], j));
    $('xs').innerHTML = '';
    $('ys').innerHTML = '';
    options.forEach(option => {
      $('xs').add(option.cloneNode(true));
      $('ys').add(option.cloneNode(true));
    });
    $('xs').value = numeric[0];
    $('ys').value = numeric[1];
    // New data: drop the previous zoom/pan so the whole dataset is visible
    chart.resetView();
    chart.updatePointData(rows);
    chart.draw();
    adjustSaveButtonSize();
  } catch (err) {
    if (err instanceof InvalidFileError || err instanceof NoDataFoundError || err instanceof NotEnoughColumnsError) {
      chart.clearChart(err.message);
      $('err').textContent = err.message;
    } else {
      chart.clearChart('Unknown error occurred.');
      throw err;
    }

    // Reset headers, rows, and file name
    chart.uiParameters.headers = [];
    rows = [];
    fileName = '';

    $('xs').innerHTML = [];
    $('ys').innerHTML = [];
    $('xs').value = '';
    $('ys').value = '';
  }
}


// ---------- drag and drop file upload ----------


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

['xs', 'ys', 'type'].forEach(id => ($(id).onchange = () => {
  // Different columns have a different range, so start from the full view
  if (id !== 'type') chart.resetView();
  if (id == 'xs') chart.uiParameters.xHeaderIndex = this.value;
  if (id == 'ys') chart.uiParameters.yHeaderIndex = this.value;
  chart.updateUIDimensions();
  chart.draw();
  adjustSaveButtonSize();
}));
$('title').oninput = () => {
  showWhichSaveButton();
  chart.updateUIDimensions();
  chart.draw();
  adjustSaveButtonSize();
};
window.addEventListener('resize', () => {
  chart.updateUIDimensions();
  chart.draw();
  adjustSaveButtonSize();
});

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

  chart.updateZoomDimensions();
  chart.draw();
  adjustSaveButtonSize();
};

const downloadChart = () => {
    if (!rows.length) return;

  const c = document.createElement('canvas');
  c.width = chart.chartCanvas.width;
  c.height = chart.chartCanvas.height;

  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(chart.chartCanvas, 0, 0);

  const a = document.createElement('a');
  a.download = 'chart.png';
  a.href = c.toDataURL('image/png');
  a.click();
};

/* Download chart as image */
$('dl-no-title').onclick = () => {
  downloadChart();
};
$('dl').onclick = () => {
  downloadChart();
};

$('sample').click(); // start with sample data
showWhichSaveButton();

