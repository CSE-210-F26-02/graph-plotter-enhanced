# CSV Edge-Case Tests: Expected vs. Actual

Part of #3. Tested against `main` @ `3792b0b` on 2026-10-19.

**Result: 37 cases. 25 behave as expected, 12 are bugs.** Bugs are automated tests marked `todo`, so they report without failing the build. When a fix lands, its test passes; then remove its `todo` option so it stays fixed.

Each case is a CSV sent through the real upload path (file input → `app.js` → `parseCSV` → `chart.draw`) by [`tests/csv-edge-cases.test.js`](../../tests/csv-edge-cases.test.js). The test IDs match this page. Run them with `npm test`; they also run on GitHub Actions for every push and PR. Results marked † were also checked by hand in Chrome.

## Very large and very small numbers

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-01 | 16-digit IDs (`1000000000000001`) | 3 distinct points | 3 distinct points | Pass |
| EC-02 | Values around `1e20` | Plots | Plots | Pass |
| EC-03 | `1.7e308` (near the largest double) | Plots on a finite axis | Plots on a finite axis | Pass |
| EC-04 | `1e400` (beyond the largest double) | Row skipped, shown in status | Skipped; status "3 rows, 2 points plotted" | Pass |
| EC-05 | 30-digit integers | Plot, or a clear error | Both round to the same double, so the range collapses to 0 and axis positions are NaN. **Blank chart**, while status says "2 points plotted" | **Bug** |
| EC-06 | 1,000 rows of `1e300`-scale values | Loads in under 1 s (no freeze) | Loads in milliseconds | Pass |
| EC-07 | 400 zoom steps in and out on `1e17` IDs | Under 2 s, no freeze | 17 ms; zoom-in is correctly limited | Pass |
| EC-08 | `1e-300` | Plots | Plots | Pass |

The freeze on huge numbers named in the bug-fix task **did not reproduce** on current `main`. The tick cap added in #12 (`MAX_TICKS`) appears to have fixed it. EC-06 and EC-07 now guard against it coming back.

## Negative numbers

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-09 | All negative | Plots | Plots | Pass |
| EC-10 | Crossing zero | Plots | Plots | Pass |
| EC-11 | `-0`, `-1e5` | Read as numbers | Read as numbers | Pass |

## Blank values

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-12 | Blank cells in some rows | Those rows skipped, rest plot | As expected; status "4 rows, 2 points plotted" | Pass |
| EC-13 | Whitespace-only cells | Treated as blank | Treated as blank | Pass |
| EC-14 | Entire column blank | Clear error | "Need at least two numeric columns." | Pass |
| EC-15 | Rows with missing cells | Skipped | Skipped | Pass |

## Missing and malformed headers

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-16 | No header row (`1,10` / `2,20` / `3,30`) | All 3 rows plot, default column names | First row becomes the column names "1" and "10" and **is not plotted**: 2 points, no warning | **Bug** |
| EC-17 | Empty header cells | Named `col1`, `col2` | `col1`, `col2` | Pass |
| EC-18 | Duplicate names (`v,v`) | Both offered | Both offered (identical in the dropdown) | Pass |
| EC-19 | Header row only | Clear error | "No data rows found." | Pass |
| EC-20 | More header names than data columns | Extra names ignored | Ignored | Pass |
| EC-21 | Fewer header names than data columns (`a` / `1,2`) | Unnamed columns get default names and plot | Unnamed columns dropped; "Need at least two numeric columns." | **Bug** |
| EC-22 | Unclosed quote in header (`"x,y`) | Plots, or an error naming the quote | Quote swallows the header line; misleading "Need at least two numeric columns." | **Bug** |

## Quotes and line endings

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-23 | One stray `"` at the start of a data row | Other rows still plot | Row parses as one column, so the x column drops below the 80% numeric threshold and **the whole file is rejected** | **Bug** |
| EC-24 † | File ends with a newline (most saved CSVs do) | 3 rows → 3 points | **First data row added again at the end**: "4 rows, 4 points", (1, 10) plotted twice. The built-in sample shows 201 rows instead of 200 | **Bug** |
| EC-25 | Windows line endings (CRLF) | Plots normally | Plots normally (`\r` stays in the parsed fields, but `app.js` trims it) | Pass |

## Scripts and HTML in labels

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-26 | Header `<script>alert(1)</script>` | Shown as written; nothing runs | Nothing runs, but the label reads `&lt;script&gt;alert(1)&lt;/script&gt;` | **Bug** (display) |
| EC-27 | Header `<img src=x onerror=alert(1)>` | Shown as written; nothing runs | Nothing runs; label shows `&lt;img …&gt;` | **Bug** (display) |
| EC-28 † | Header `R&D` | Shown as `R&D` | Dropdowns and axis show `R&amp;D` | **Bug** (display) |
| EC-29 | File name containing HTML | Shown as plain text | Plain text (status uses `textContent`) | Pass |
| EC-30 | Source scan: any HTML insertion of data | None | None: the only `innerHTML` writes clear the dropdowns | Pass |

**XSS:** no script execution was found. Labels are drawn on a canvas or used as `<option>` text, and the status and tooltip use `textContent`, so none of them is ever parsed as HTML. EC-30 fails the build if someone later adds `insertAdjacentHTML`, `document.write`, `eval`, or a non-empty `innerHTML` assignment. EC-26–28 are a side effect of the current XSS defense: `sanitizeInput` HTML-escapes column names, but because they are never parsed as HTML, the escape codes show up literally. Removing that call fixes all three without adding risk.

## After a failed upload

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-31 | Good file, then a file with no data rows | Status no longer describes the old file | Status still "good.csv: 2 rows, 2 points plotted." | **Bug** |
| EC-32 | Good file, then a `.txt` file | Whole old chart kept, or none of it | Chart cleared, but the old column names and status stay, and **Generate graph redraws the old file** | **Bug** |

This is the "old data only partially saved after a crash" issue from the bug-fix task.

## Unsupported formats

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-33 | Thousands separators (`"1,000"`) | Rejected with an error | "Need at least two numeric columns." | Pass (limitation) |
| EC-34 | Semicolon-separated | Rejected with an error | "Need at least two numeric columns." | Pass (limitation) |
| EC-35 | `.txt` file | Rejected | "Wrong file type. Please upload a CSV file." | Pass |
| EC-36 | Column with 1 text value in 5 | Still plotted, text row skipped | 4 points | Pass |

EC-33 and EC-34 are rejected, but the message doesn't say why. A message naming the delimiter or number format would help users.

## Redraw cost

| ID | Input | Expected | Actual | Result |
|---|---|---|---|---|
| EC-37 † | Redraw the same data (pan, zoom, resize) | Reuse the parsed numbers | Every text cell is converted to a number again on each redraw | **Bug** (performance) |

Measured in Chrome with 100,000 rows: a scatter redraw takes **16.6 ms**, a full 60 fps frame. Of that, **4.5 ms** is reconverting text to numbers. A line-chart redraw takes 7.7 ms. Panning redraws on every mouse move, so this cost repeats continuously while dragging. That matches the "unusually high CPU on every redraw" issue, though the redraws don't freeze.

### Automated redraw-time tests

[`tests/redraw-performance.test.js`](../../tests/redraw-performance.test.js) runs with every build. Node has no GPU, so these tests time the JavaScript side of a redraw (parsing, sorting, scaling, ticks, looping over points), not pixel drawing. The limits are generous, so slower CI machines don't cause false failures, and each run prints its measured times in the log.

| ID | Check | Limit | Measured (Node, M-series Mac) | Result |
|---|---|---|---|---|
| PERF-01 | Scatter / line redraw of 100k points | Under 200 ms | 10.3 ms / 7.4 ms | Pass |
| PERF-02 | 10× more points → redraw time | At most 30× | ~10× for both (linear) | Pass |
| PERF-03 | Hover search over 100k points, per mouse move | Under 50 ms | 0.5 ms (5.2 ms in Chrome, which also moves the tooltip on the page) | Pass |
| PERF-04 | Redraws caused by 4 scroll events in one frame | At most 1 | 4 | **Bug** (performance) |
| PERF-05 | Work for a burst of 4 scroll events (100k points), including any redraw scheduled for the next frame | Under 800 ms | 44 ms | Pass |

PERF-04 is the biggest measured win. In Chrome with 100k points, a fast scroll of 4 events per frame takes **52 ms per frame (~19 fps)**. Redrawing at most once per frame (`requestAnimationFrame`) brings that to **10 ms (~96 fps)**, and zoom still counts every event.

The tests were checked in a scratch copy. A deliberate quadratic slowdown failed PERF-01 (666 ms) and PERF-02 (114×). A once-per-frame redraw fix turned PERF-04 green with no other test broken.

## Bug-fix task checklist

How the issues listed in the bug-fix task map to these tests:

| Issue | Status | Tests |
|---|---|---|
| App freezing on extremely large numbers | Not reproduced on current `main`; guarded | EC-06, EC-07 (pass); EC-05 is a related blank-chart bug |
| Handling of malformed headers | Confirmed | EC-16, EC-21, EC-22 |
| Old data only partially kept after a failure | Confirmed | EC-31, EC-32 |
| Unquoted files break the parser | Confirmed | EC-22, EC-23; also EC-24 |
| Potential XSS risk | No execution found; guarded. Escaping garbles labels | EC-29, EC-30 (pass); EC-26–28 |
| Numbers not kept in a friendly format, high CPU on redraw | Confirmed (4.5 of 16.6 ms per redraw) | EC-37 |

To check that the tests accept real fixes, four sample fixes were applied in a scratch copy (not committed): stop escaping labels, stop the parser after the final line, and clear the status and old data on a failed upload. The tests for EC-24, 26, 27, 28, 31 and 32 all turned green, with no other test broken.
