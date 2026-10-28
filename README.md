# Graph Plotter

A website that plots scatter and line graphs.

## Team

Roles will be assigned on a rotational basis so everyone can explore and try different things!

| Name          | GitHub               | Role                         |
| ------------- | -------------------- | ---------------------------- |
| Adarsh        | @Adarsh-Shetkar      | Product Owner                |
| James Keys    | @jkqq-0              | Scrum Master & Documentation |
| Ali           | @AliMohammadiasl     | Dev team                     |
| Kenneth Song  | @KennytheMasterCoder | Dev team                     |
| Eddie         | @EdwardLoeber        | Dev team                     |
| Congke Chen   | @CongkeChen          | Dev team                     |
| Keanu Jahncke | @keanujahncke        | UI/UX & Data Modelling       |
| Russel Sofia  | @rusunited2          | Testing                      |
| Welo          | @weloniheu           | Testing                      |

## How to run

Open `src/index.html` directly in any modern browser, or serve it locally:

```bash
# Using Python
python3 -m http.server 8000 --directory src

# Or using npx
npx serve src
```

Then visit `http://localhost:8000` (or the port displayed).

## Running tests

Unit tests live in `tests/` and use Node's built-in test runner, so there is nothing to install. With Node 20 or newer:

```bash
npm test
```

They also run on GitHub Actions for every push and pull request (`.github/workflows/tests.yml`).

- `parser.test.js`: CSV parsing (`src/parser.js`)
- `helpers.test.js`: axis ticks, number formatting, sanitizing, error classes
- `chart.test.js`: `ChartElement` point filtering, axis mapping, zoom, pan, and tooltips, run against a fake DOM (`tests/helpers/fake-dom.js`)
- `csv-edge-cases.test.js`: 37 edge-case CSV files (huge and negative numbers, blank values, missing or malformed headers, quotes, HTML in labels, failed uploads) sent through the real upload path in `app.js`. Expected vs. actual results: [`docs/qa/csv-edge-cases.md`](docs/qa/csv-edge-cases.md)
- `redraw-performance.test.js`: redraw time for 100,000 points, how redraw time grows with more points, hover cost, and redraws per scroll burst. The measured times are printed in the test output.

A test marked `todo` describes a known bug: it runs and is reported, but does not fail the build. When the bug is fixed, the test passes; then remove its `todo` option so it guards the fix.
