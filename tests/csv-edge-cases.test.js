// Edge-case CSV files, run through the real upload path (see helpers/load-app.js).
// Each case has an ID matching docs/qa/csv-edge-cases.md, where expected vs.
// actual results are written up. Cases marked { todo } are confirmed bugs: they
// describe the EXPECTED behaviour, are reported, and don't fail the build.
// When a bug is fixed its test passes; then delete its todo option.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { upload, chart } from './helpers/load-app.js';

after(() => clearTimeout(chart.zoomCursorTimeout)); // zoom leaves a 250 ms cursor timer

/** True when every plotted point maps to a real pixel (no NaN/Infinity axis). */
const axisIsFinite = () => chart.cachedPlot?.pts.every(([x, y]) => Number.isFinite(chart.cachedPlot.sx(x)) && Number.isFinite(chart.cachedPlot.sy(y)));
const center = () => ({ clientX: chart.cachedPlot.L + chart.cachedPlot.pw / 2, clientY: chart.cachedPlot.T + chart.cachedPlot.ph / 2, preventDefault() {} });

describe('Very large and very small numbers', () => {
  test('EC-01: 16-digit IDs (1e15 scale) plot as distinct points', () => {
    const r = upload('id,value\n1000000000000001,1\n1000000000000002,2\n1000000000000003,3');
    assert.deepEqual(r.points.map(([x]) => x), [1000000000000001, 1000000000000002, 1000000000000003]);
    assert.ok(axisIsFinite());
  });

  test('EC-02: values around 1e20 plot', () => {
    const r = upload('x,y\n1e20,1\n2e20,2\n3e20,3');
    assert.equal(r.points.length, 3);
    assert.ok(axisIsFinite());
  });

  test('EC-03: values near the largest double (1.7e308) plot on a finite axis', () => {
    const r = upload('x,y\n1,1e308\n2,1.7e308');
    assert.equal(r.points.length, 2);
    assert.ok(axisIsFinite());
  });

  test('EC-04: a value beyond the largest double (1e400) is skipped, and the status shows it', () => {
    const r = upload('x,y\n1,1e400\n2,2\n3,3');
    assert.deepEqual(r.points, [[2, 2], [3, 3]]);
    assert.match(r.status, /3 rows, 2 points plotted/);
  });

  test('EC-05: 30-digit integers either plot or give a clear error, never a blank chart', {
    todo: 'Bug: both values round to the same double, the x range collapses to 0, axis positions become NaN '
      + 'and the chart is blank while the status says "2 points plotted".',
  }, () => {
    const r = upload('x,y\n123456789012345678901234567890,1\n123456789012345678901234567891,2');
    assert.ok(r.error !== '' || axisIsFinite(), 'axis positions are NaN and no error is shown');
  });

  test('EC-06: files of huge numbers load without freezing (under 1 s)', () => {
    const big = 'x,y\n' + Array.from({ length: 1000 }, (_, i) => `${(i + 1) * 1e300},${-i * 1e290}`).join('\n');
    const r = upload(big);
    assert.equal(r.points.length, 1000);
    assert.ok(r.ms < 1000, `took ${Math.round(r.ms)} ms`);
  });

  test('EC-07: zooming 400 steps in and out on 1e17-scale IDs does not freeze (under 2 s)', () => {
    upload('id,v\n100000000000000000,1\n100000000000000100,2\n100000000000000300,3');
    const start = performance.now();
    for (let i = 0; i < 400; i++) chart.onScrollWheel({ ...center(), deltaY: -1 });
    for (let i = 0; i < 400; i++) chart.onScrollWheel({ ...center(), deltaY: 1 });
    assert.ok(performance.now() - start < 2000);
    assert.ok(axisIsFinite());
  });

  test('EC-08: very small values (1e-300) plot', () => {
    const r = upload('x,y\n1,1e-300\n2,2e-300');
    assert.equal(r.points.length, 2);
    assert.ok(axisIsFinite());
  });
});

describe('Negative numbers', () => {
  test('EC-09: all-negative data plots', () => {
    assert.deepEqual(upload('x,y\n-5,-10\n-2,-4\n-1,-2').points, [[-5, -10], [-2, -4], [-1, -2]]);
  });

  test('EC-10: data crossing zero plots', () => {
    assert.deepEqual(upload('x,y\n-5,3\n0,0\n5,-3').points, [[-5, 3], [0, 0], [5, -3]]);
  });

  test('EC-11: "-0" and "-1e5" are read as numbers', () => {
    assert.deepEqual(upload('x,y\n-0,-1e5\n1,2').points, [[-0, -100000], [1, 2]]);
  });
});

describe('Blank values', () => {
  test('EC-12: rows with a blank cell are skipped; the rest plot', () => {
    const r = upload('x,y\n1,\n,2\n3,4\n5,6');
    assert.deepEqual(r.points, [[3, 4], [5, 6]]);
    assert.match(r.status, /4 rows, 2 points plotted/);
  });

  test('EC-13: whitespace-only cells count as blank', () => {
    assert.deepEqual(upload('x,y\n1,  \n   ,2\n3,4').points, [[3, 4]]);
  });

  test('EC-14: an entirely blank column gives a clear error', () => {
    assert.equal(upload('x,y\n1,\n2,\n3,').error, 'Need at least two numeric columns.');
  });

  test('EC-15: rows with missing cells are skipped', () => {
    assert.deepEqual(upload('x,y,z\n1,2,3\n4\n5,6').points, [[1, 2], [5, 6]]);
  });
});

describe('Missing and malformed headers', () => {
  test('EC-16: a file with no header row plots every row, with default column names', {
    todo: 'Bug: the first data row is used as the column names ("1", "10") and is not plotted, '
      + 'so a 3-row file shows 2 points with no warning.',
  }, () => {
    const r = upload('1,10\n2,20\n3,30');
    assert.equal(r.points.length, 3);
  });

  test('EC-17: empty header cells get default names col1, col2', () => {
    assert.deepEqual(upload(',\n1,2\n3,4').columns, ['col1', 'col2']);
  });

  test('EC-18: duplicate header names are both offered', () => {
    assert.deepEqual(upload('v,v\n1,2\n3,4').columns, ['v', 'v']);
  });

  test('EC-19: a header row with no data gives a clear error', () => {
    assert.equal(upload('x,y').error, 'No data rows found.');
  });

  test('EC-20: extra header names with no data under them are ignored', () => {
    const r = upload('a,b,c,d\n1,2\n3,4');
    assert.deepEqual(r.columns, ['a', 'b']);
    assert.equal(r.points.length, 2);
  });

  test('EC-21: data columns without a header name get default names and still plot', {
    todo: 'Bug: columns past the header row are dropped, so "a\\n1,2\\n3,4" fails with '
      + '"Need at least two numeric columns." although it has two numeric columns.',
  }, () => {
    assert.equal(upload('a\n1,2\n3,4').points.length, 2);
  });

  test('EC-22: an unclosed quote in the header plots the data or names the quote as the problem', {
    todo: 'Bug: the quote swallows the whole header line, leaving one column, and the error is the '
      + 'misleading "Need at least two numeric columns."',
  }, () => {
    const r = upload('"x,y\n1,2\n3,4');
    assert.ok(r.points.length === 2 || /quote/i.test(r.error), `error was: ${r.error}`);
  });
});

describe('Quotes and line endings', () => {
  test('EC-23: one stray quote at the start of a row does not stop the other rows plotting', {
    todo: 'Bug: the row parses as a single column, the x column falls below the 80%-numeric threshold, '
      + 'and the whole file is rejected with "Need at least two numeric columns."',
  }, () => {
    const r = upload('x,y\n"1,2\n3,4\n5,6');
    assert.ok(r.points.some(([x, y]) => x === 3 && y === 4) && r.points.some(([x, y]) => x === 5 && y === 6));
  });

  test('EC-24: a trailing newline does not duplicate a row', {
    todo: 'Bug: the parser re-reads the first data row at the end, so a 3-row file shows "4 rows, 4 points" '
      + 'and plots (1,10) twice. The built-in sample data shows 201 rows instead of 200.',
  }, () => {
    const r = upload('x,y\n1,10\n2,20\n3,30\n');
    assert.match(r.status, /3 rows, 3 points plotted/);
  });

  test('EC-25: Windows line endings (CRLF) plot correctly', () => {
    const r = upload('x,y\r\n1,2\r\n3,4');
    assert.deepEqual(r.columns, ['x', 'y']);
    assert.deepEqual(r.points, [[1, 2], [3, 4]]);
  });
});

describe('Scripts and HTML in labels', () => {
  test('EC-26: a <script> header is shown exactly as written', {
    todo: 'Bug: app.js HTML-escapes column names, but they are only ever shown as plain text (canvas, '
      + '<option> text), so the label reads "&lt;script&gt;alert(1)&lt;/script&gt;". Nothing executes.',
  }, () => {
    assert.equal(upload('<script>alert(1)</script>,y\n1,2\n3,4').columns[0], '<script>alert(1)</script>');
  });

  test('EC-27: an <img onerror> header is shown exactly as written', {
    todo: 'Bug: same escaping as EC-26; the label reads "&lt;img src=x onerror=alert(1)&gt;".',
  }, () => {
    assert.equal(upload('"<img src=x onerror=alert(1)>",y\n1,2\n3,4').columns[0], '<img src=x onerror=alert(1)>');
  });

  test('EC-28: a header with & is shown exactly as written', {
    todo: 'Bug: same escaping as EC-26; "R&D" shows as "R&amp;D" in the dropdowns and on the axis.',
  }, () => {
    assert.equal(upload('R&D,y\n1,2\n3,4').columns[0], 'R&D');
  });

  test('EC-29: a file name containing HTML is shown as plain text in the status', () => {
    const name = '<img src=x onerror=alert(1)>.csv';
    assert.ok(upload('x,y\n1,2', name).status.startsWith(name));
  });

  test('EC-30: no source file inserts text as HTML (guards against XSS)', () => {
    const dir = new URL('../src/', import.meta.url);
    for (const file of readdirSync(dir).filter((f) => /\.(js|html)$/.test(f))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      assert.doesNotMatch(source, /insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function\(/, file);
      for (const [, value] of source.matchAll(/innerHTML\s*=\s*([^;\n]+)/g)) {
        assert.match(value.trim(), /^(''|""|\[\])$/, `${file}: innerHTML = ${value.trim()}`);
      }
    }
  });
});

describe('After a failed upload', () => {
  test('EC-31: the status no longer describes the previous file', {
    todo: 'Bug: after "No data rows found.", the status still says "good.csv: 2 rows, 2 points plotted."',
  }, () => {
    upload('a,b\n1,2\n3,4', 'good.csv');
    const r = upload('a,b', 'bad.csv');
    assert.doesNotMatch(r.status, /good\.csv/);
  });

  test('EC-32: a wrong file type leaves either the whole previous chart or none of it', {
    todo: 'Bug: the chart is cleared but the old column names and status stay, and "Generate graph" '
      + 'redraws the previous file.',
  }, () => {
    upload('a,b\n1,2\n3,4', 'good.csv');
    const r = upload('a,b\n9,9', 'bad.txt');
    assert.equal(r.error, 'Wrong file type. Please upload a CSV file.');
    const keptOldChart = r.points.length > 0;
    assert.equal(r.columns.length > 0, keptOldChart, 'column list and chart disagree');
    assert.equal(/good\.csv/.test(r.status), keptOldChart, 'status and chart disagree');
  });
});

describe('Unsupported formats get a message', () => {
  test('EC-33: thousands separators ("1,000") are rejected with an error', () => {
    assert.equal(upload('x,y\n1,"1,000"\n2,"2,000"').error, 'Need at least two numeric columns.');
  });

  test('EC-34: semicolon-separated files are rejected with an error', () => {
    assert.equal(upload('x;y\n1;2\n3;4').error, 'Need at least two numeric columns.');
  });

  test('EC-35: a non-.csv file is rejected', () => {
    assert.equal(upload('x,y\n1,2', 'data.txt').error, 'Wrong file type. Please upload a CSV file.');
  });

  test('EC-36: a column that is 80% numbers is still plotted; the text row is skipped', () => {
    const r = upload('x,y\n1,1\n2,2\n3,3\n4,4\n5,oops');
    assert.equal(r.points.length, 4);
  });
});

describe('Redraw cost', () => {
  test('EC-37: redrawing (pan, zoom, resize) reuses the parsed numbers instead of re-reading text', {
    todo: 'Performance: draw() converts every text cell to a number on every redraw, and panning redraws on '
      + 'each mouse move. In Chrome, 4.5 ms of a 16.6 ms redraw of 100k rows is this conversion.',
  }, () => {
    let reads = 0;
    const cell = (text) => Object.assign(new String(text), { trim() { reads++; return String(text).trim(); } });
    const rows = Array.from({ length: 100 }, (_, i) => [cell(String(i)), cell(String(i * 2))]);
    chart.draw(rows, ['x', 'y'], 0, 1, 'scatter');
    reads = 0;
    chart.draw(rows, ['x', 'y'], 0, 1, 'scatter'); // what a pan or zoom does
    assert.equal(reads, 0, `the redraw re-read ${reads} text cells`);
  });
});
