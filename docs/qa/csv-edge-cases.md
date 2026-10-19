# CSV Edge-Case Tests: Expected vs. Actual

Part of #3. Tested against `main` @ `3792b0b` on 2026-10-19.

**Result: 37 cases. 26 behave as expected, 11 are bugs.** EC-37 was fixed by the redraw performance fix (see Redraw cost). Bugs are automated tests marked `todo`, so they report without failing the build. When a fix lands, its test passes; then remove its `todo` option so it stays fixed.

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
| EC-37 † | Redraw the same data (pan, zoom, resize) | Reuse the parsed numbers | Before the fix: every text cell was converted to a number again on each redraw. Now: parsed points are cached until the rows, columns or chart type change | **Fixed** |

Before the fix, in Chrome with 100,000 rows: a scatter redraw took **16.6 ms**, a full 60 fps frame, and **4.5 ms** of that was reconverting text to numbers. Panning and scroll-zoom also redrew on every input event, several times per frame. That matched the "unusually high CPU on every redraw" issue, though the redraws didn't freeze.

### The fix

In `src/chart.js`:

1. **Parse once (F2):** `draw()` caches the parsed points (sorted, for line charts) keyed by the rows array, the X/Y columns and the chart type. Pan, zoom and resize reuse them; loading a file, changing a column or changing the chart type re-parses.
2. **Redraw at most once per frame (F1):** panning and scroll-zoom call the new `requestRedraw()`, which schedules one `draw()` with `requestAnimationFrame`. Every event still updates the zoom/pan; only the redraw is shared.

### Automated redraw-time tests

[`tests/redraw-performance.test.js`](../../tests/redraw-performance.test.js) runs with every build. Node has no GPU, so these tests time the JavaScript side of a redraw (parsing, sorting, scaling, ticks, looping over points), not pixel drawing. The limits are generous, so slower CI machines don't cause false failures, and each run prints its measured times in the log.

| ID | Check | Limit | Before the fix (Node, M-series Mac) | After the fix | Result |
|---|---|---|---|---|---|
| PERF-01 | Scatter / line redraw of 100k points | Under 200 ms | 10.3 ms / 7.4 ms | 8.2 ms / 3.7 ms | Pass |
| PERF-02 | 10× more points → redraw time | At most 30× | ~10× for both (linear) | ~10× | Pass |
| PERF-03 | Hover search over 100k points, per mouse move | Under 50 ms | 0.5 ms | 0.5 ms | Pass |
| PERF-04 | Redraws caused by 4 scroll events in one frame | At most 1 | 4 (bug) | **1** | **Pass** (was TODO) |
| PERF-05 | Work for a burst of 4 scroll events (100k points), including any redraw scheduled for the next frame | Under 800 ms | 44 ms | **10.9 ms (−75%)** | Pass |

The timing tests were checked in a scratch copy. A deliberate quadratic slowdown failed PERF-01 (666 ms) and PERF-02 (114×). Hover is not a bottleneck: Chrome measured 0.1–0.5 ms per move. An earlier note in this doc said 5.2 ms, but that didn't reproduce in repeated runs.

### How the fix was chosen: measured effect of each candidate

Each candidate fix was applied alone to a scratch copy of `src/chart.js`, then timed with the tests above in Node and with real frame times in Chrome. All 100,000 points, scatter chart unless noted. Every variant passed the full test suite.

- **F1, redraw at most once per frame:** pan and zoom call `requestAnimationFrame` instead of redrawing on every event; zoom still counts every event.
- **F2, parse numbers once:** cache the parsed (and, for line charts, sorted) points until the data, column or chart type changes.
- **F3, grid for hover search:** bucket points into 10 px cells, built on the first hover after each redraw.
- **F4, squares instead of circles:** draw dots with `fillRect` when there are more than 1,000 points.

| Fix | Node: scatter redraw | Node: line redraw | Node: scroll burst (PERF-05) | Chrome: fast-scroll frame | Chrome: pan frame | Chrome: JS per redraw |
|---|---|---|---|---|---|---|
| Before | 10.3 ms | 6.5 ms | 43.5 ms | 41.6 ms (~24 fps) | 26–33 ms | 13.3 ms |
| F1 | no change | no change | **13.6 ms (−69%)** | **16.6 ms** | **16.7 ms** | no change |
| F2 | 8.3 ms (−19%) | **3.5 ms (−46%)** | 34.3 ms (−21%) | 25 ms | 24.5 ms | 10 ms (−25%) |
| F3 | no change | no change | no change | no change | no change | no change; first hover after each redraw costs 1.7 ms more |
| F4 | 6.1 ms (−41%, see below) | no change | 27.5 ms | **no better (41.7 ms)** | no better | **17.7–19.5 ms (worse)** |
| **F1 + F2** | 8.2 ms (−20%) | 3.7 ms (−43%) | **10.9 ms (−75%)** | **8.4–9.2 ms (~110 fps)** | **16.7 ms** | 10 ms (−25%) |

The display ran at 60 Hz for some measurements and 120 Hz for others, so 16.7 ms frames are "full speed" at 60 Hz. Node results are medians of 3 runs (line redraw: 21 runs). Chrome results come from 2–3 rounds.

**Chosen: F1 + F2** (implemented in `src/chart.js`). F1 fixes fast scrolling and panning on its own. F2 cuts every redraw's cost and halves line-chart redraws. Together, a fast scroll goes from ~24 fps to ~110 fps, and both make PERF-04 and EC-37 pass.

**Not recommended:**
- **F3:** hover search is not a bottleneck. Scanning all 100k points took 0.1–0.5 ms per mouse move, so the grid only adds a 1.7 ms build cost after each redraw.
- **F4:** in real Chrome, `fillRect` per point was slower than `arc` (17.7–19.5 ms vs 13.3 ms of JS per redraw), and frame times did not improve. Its −41% in Node is an artifact of the fake canvas (3 calls per dot vs 1), which is why canvas changes must be checked in a real browser.

### Final code, checked in Chrome

After implementing F1 + F2 in `src/chart.js`, the real page was measured again with 100,000 points (3 rounds, 120 Hz display):

| | Before | After |
|---|---|---|
| Fast scroll, 4 wheel events per frame | 41.6 ms per frame (~24 fps) | **8.4 ms** (full speed at 120 Hz) after the first round warmed up (16.5 ms) |
| Panning, 2 mouse moves per frame | 26–33 ms (~30–38 fps) | **16.7 ms** (60 fps) |
| JavaScript per redraw | 13.3 ms | 11 ms |

The page was also checked by hand: changing the Y column re-reads the data; switching to a line chart sorts by X while scatter keeps file order; loading a new file replaces the cached points; zoom redraws on the next frame; and a 40 px drag pans exactly 40 px.

**Remaining limit:** one redraw of 100k points still takes about 11 ms of JavaScript, which is more than a 120 Hz frame (8.3 ms) allows, so panning large files runs at 60 fps rather than 120. Going further would need cheaper drawing, such as downsampling to a few points per pixel. That is out of scope here.

### How it was measured

1. **Timing tests:** `npm test`, whose redraw tests print their times; medians of 3 runs, 21 for the line redraw.
2. **Candidates in isolation:** each candidate fix was applied alone to its own scratch copy, plus one copy with all of them. Every copy passed the full test suite before it was timed.
3. **Real frame times in Chrome:** each copy was loaded with a 100k-row CSV, and frame-to-frame times were recorded with `requestAnimationFrame` (median of 30 frames) while simulating fast scrolling (4 wheel events per frame) and panning (2 mouse moves per frame). Redraw CPU time was the average of 10 `draw()` calls.
4. **Final check:** the chosen fixes were written into `src/chart.js`, retested with the full suite, and re-measured in Chrome (table above).

## Bug-fix task checklist

How the issues listed in the bug-fix task map to these tests:

| Issue | Status | Tests |
|---|---|---|
| App freezing on extremely large numbers | Not reproduced on current `main`; guarded | EC-06, EC-07 (pass); EC-05 is a related blank-chart bug |
| Handling of malformed headers | Confirmed | EC-16, EC-21, EC-22 |
| Old data only partially kept after a failure | Confirmed | EC-31, EC-32 |
| Unquoted files break the parser | Confirmed | EC-22, EC-23; also EC-24 |
| Potential XSS risk | No execution found; guarded. Escaping garbles labels | EC-29, EC-30 (pass); EC-26–28 |
| Numbers not kept in a friendly format, high CPU on redraw | **Fixed**: parse once, redraw once per frame | EC-37, PERF-04, PERF-05 |

To check that the tests accept real fixes, four sample fixes were applied in a scratch copy (not committed): stop escaping labels, stop the parser after the final line, and clear the status and old data on a failed upload. The tests for EC-24, 26, 27, 28, 31 and 32 all turned green, with no other test broken.
