// Redraw cost of ChartElement, measured in Node.
//
// What this can and can't see: Node has no GPU or real canvas (canvas calls are
// no-ops, see helpers/fake-dom.js), so these tests time the JavaScript work of a
// redraw — reading numbers, sorting, scaling, ticks, looping over points — not
// pixel drawing. That is where repeated parsing and repeated redraws cost time.
//
// To stay reliable on slow, shared CI machines:
// - time budgets are generous (they catch freezes and big slowdowns, not noise),
//   and every measurement is printed to the log so trends are visible;
// - the scaling test compares 10x more points, which is machine-independent;
// - the redraw-count test counts calls instead of timing them.
// IDs match docs/qa/csv-edge-cases.md.
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import './helpers/fake-dom.js'
import { ChartElement } from '../src/chart.js'

const chart = new ChartElement()
after(() => clearTimeout(chart.zoomCursorTimeout))

/** n rows of [x, y] as text, like parsed CSV. Deterministic. */
const makeRows = (n) =>
    Array.from({ length: n }, (_, i) => [String(i), String((i * 7919) % 1000)])

/** Median time of fn over several runs, after warm-up runs. */
function medianMs(fn, runs = 7) {
    fn()
    fn()
    const times = []
    for (let i = 0; i < runs; i++) {
        const start = performance.now()
        fn()
        times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    return times[Math.floor(runs / 2)]
}

const redraw = (rows, type) => () => chart.draw(rows, ['x', 'y'], 0, 1, type)
const ms = (value) => `${value.toFixed(1)} ms`

describe('Redraw time', () => {
    const rows = makeRows(100_000)

    for (const type of ['scatter', 'line']) {
        test(`PERF-01: a ${type} redraw of 100,000 points takes under 200 ms`, (t) => {
            const time = medianMs(redraw(rows, type))
            t.diagnostic(
                `${type} redraw, 100k points: ${ms(time)} (median of 7)`
            )
            assert.ok(time < 200, `took ${ms(time)}`)
        })
    }

    for (const type of ['scatter', 'line']) {
        test(`PERF-02: ${type} redraw time grows in step with the number of points (10x points ≤ 30x time)`, (t) => {
            const small = medianMs(redraw(makeRows(10_000), type), 9)
            const large = medianMs(redraw(rows, type), 9)
            const ratio = large / small
            t.diagnostic(
                `${type}: 10k points ${ms(small)}, 100k points ${ms(large)}, ratio ${ratio.toFixed(1)}x`
            )
            // Linear work gives ~10x and sorting a little more; an accidental O(n²) loop gives ~100x.
            assert.ok(
                ratio < 30,
                `10x more points took ${ratio.toFixed(1)}x longer`
            )
        })
    }

    test('PERF-03: hovering over 100,000 points takes under 50 ms per mouse move', (t) => {
        chart.draw(rows, ['x', 'y'], 0, 1, 'scatter')
        const { L, T, pw, ph } = chart.cachedPlot
        const time = medianMs(() =>
            chart.onMouseMove({ clientX: L + pw / 2, clientY: T + ph / 2 })
        )
        t.diagnostic(`hover search, 100k points: ${ms(time)} per mouse move`)
        assert.ok(time < 50, `took ${ms(time)}`)
    })
})

describe('Scroll burst cost', () => {
    test('PERF-05: a burst of 4 scroll events on 100,000 points costs under 800 ms of work', async (t) => {
        chart.draw(makeRows(100_000), ['x', 'y'], 0, 1, 'scatter')
        const { L, T, pw, ph } = chart.cachedPlot
        const event = (deltaY) => ({
            clientX: L + pw / 2,
            clientY: T + ph / 2,
            deltaY,
            preventDefault() {},
        })

        // Time spent in the scroll handlers, plus any redraw they schedule for the next frame.
        let drawMs = 0
        const realDraw = chart.draw
        chart.draw = function (...args) {
            const start = performance.now()
            try {
                return realDraw.apply(this, args)
            } finally {
                drawMs += performance.now() - start
            }
        }
        const bursts = []
        try {
            for (let burst = 0; burst < 7; burst++) {
                drawMs = 0
                const start = performance.now()
                for (const deltaY of [-1, 1, -1, 1])
                    chart.onScrollWheel(event(deltaY)) // in/out: view stays put
                const handlerMs = performance.now() - start
                const drawnDuringHandlers = drawMs
                await new Promise((resolve) => setTimeout(resolve, 50)) // let a scheduled frame run
                bursts.push(handlerMs + (drawMs - drawnDuringHandlers))
            }
        } finally {
            chart.draw = realDraw
            chart.resetView()
        }
        bursts.sort((a, b) => a - b)
        const time = bursts[3]
        t.diagnostic(
            `scroll burst (4 events), 100k points: ${ms(time)} of work (median of 7)`
        )
        assert.ok(time < 800, `took ${ms(time)}`)
    })
})

describe('Redraw count', () => {
    test(
        'PERF-04: a burst of 4 scroll events in one frame causes at most 1 redraw',
        {
            todo:
                'Performance: every wheel event redraws immediately, so a fast trackpad scroll redraws 4 times per frame. ' +
                'In Chrome with 100k points that is 52 ms per frame (~19 fps) instead of 10 ms with one redraw per frame.',
        },
        async () => {
            chart.draw(makeRows(1000), ['x', 'y'], 0, 1, 'scatter')
            const { L, T, pw, ph } = chart.cachedPlot
            const event = (deltaY) => ({
                clientX: L + pw / 2,
                clientY: T + ph / 2,
                deltaY,
                preventDefault() {},
            })

            let redraws = 0
            const realDraw = chart.draw
            chart.draw = function (...args) {
                redraws++
                return realDraw.apply(this, args)
            }
            try {
                for (let i = 0; i < 4; i++) chart.onScrollWheel(event(-1))
                await new Promise((resolve) => setTimeout(resolve, 50)) // let any pending frame run
                assert.ok(
                    Math.abs(chart.zoomParameters.xScale - 0.9 ** 4) < 1e-9,
                    'every scroll event should still count toward the zoom'
                )
                assert.ok(
                    redraws <= 1,
                    `${redraws} redraws for 4 scroll events`
                )
            } finally {
                chart.draw = realDraw
            }
        }
    )
})
