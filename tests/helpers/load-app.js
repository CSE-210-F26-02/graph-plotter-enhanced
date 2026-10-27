/**
 * Starts the real src/app.js on the fake page and returns an `upload` function
 * that sends a CSV through the same path as a user picking a file:
 * #file change → validateCSVFile → FileReader → load() → parseCSV → chart.draw().
 *
 * Nothing from app.js is copied here, so these tests can't drift from the app.
 * Note: app.js loads its built-in sample data on start-up, like the real page.
 */
import { setElement, errorBox } from './fake-dom.js'
import { ChartElement } from '../../src/chart.js'

const chart = new ChartElement()
setElement('demo-chart', chart)
await import('../../src/app.js')

const $ = (id) => document.getElementById(id)

/**
 * @param {string} text - CSV contents
 * @param {string} [name] - file name (the extension decides whether it is accepted)
 * @returns {{status: string, error: string, columns: string[], points: number[][], ms: number}}
 *   columns = the column names offered in the X/Y dropdowns; points = what the chart plotted.
 */
export function upload(text, name = 'test.csv') {
    const event = { target: { files: [{ name, text }], value: name } }
    const start = performance.now()
    $('file').onchange(event)
    const ms = performance.now() - start
    return {
        status: $('status').textContent,
        error: errorBox.textContent,
        columns: $('xs').options.map((option) => option.text),
        points: chart.cachedPlot ? chart.cachedPlot.pts.map((p) => [...p]) : [],
        ms,
    }
}

export { chart }
