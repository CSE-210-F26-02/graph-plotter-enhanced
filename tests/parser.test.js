import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// A test marked { todo: '...' } describes behaviour we want but the code does
// not have yet: it runs and is reported, but does not fail CI. Once the bug is
// fixed the test passes; then delete the todo option so it guards the fix.

import { parseCSV } from '../src/parser.js'

describe('parseCSV', () => {
    test('splits rows and fields', () => {
        assert.deepEqual(parseCSV('x,y\n1,2\n3,4'), [
            ['x', 'y'],
            ['1', '2'],
            ['3', '4'],
        ])
    })

    test('returns no rows for empty or blank input', () => {
        assert.deepEqual(parseCSV(''), [])
        assert.deepEqual(parseCSV('\n\n'), [])
    })

    test('skips blank lines between rows', () => {
        assert.deepEqual(parseCSV('x,y\n\n1,2\n\n\n3,4'), [
            ['x', 'y'],
            ['1', '2'],
            ['3', '4'],
        ])
    })

    test('handles a single column', () => {
        assert.deepEqual(parseCSV('x\n1\n2'), [['x'], ['1'], ['2']])
    })

    test('keeps empty fields so columns stay aligned', () => {
        assert.deepEqual(parseCSV('a,b,c\n1,,3'), [
            ['a', 'b', 'c'],
            ['1', '', '3'],
        ])
    })

    test('keeps surrounding spaces (app.js trims headers itself)', () => {
        assert.deepEqual(parseCSV('x , y\n 1 , 2 '), [
            ['x ', ' y'],
            [' 1 ', ' 2 '],
        ])
    })

    test('strips a UTF-8 byte order mark (Excel exports)', () => {
        assert.deepEqual(parseCSV('﻿x,y\n1,2'), [
            ['x', 'y'],
            ['1', '2'],
        ])
    })

    test('keeps commas inside quoted fields', () => {
        assert.deepEqual(parseCSV('name,v\n"a,b",1'), [
            ['name', 'v'],
            ['a,b', '1'],
        ])
    })

    test('turns doubled quotes inside a quoted field into one quote', () => {
        assert.deepEqual(parseCSV('name,v\n"say ""hi""",1'), [
            ['name', 'v'],
            ['say "hi"', '1'],
        ])
    })

    test('keeps newlines inside quoted fields', () => {
        assert.deepEqual(parseCSV('name,v\n"line1\nline2",1'), [
            ['name', 'v'],
            ['line1\nline2', '1'],
        ])
    })

    test('an unclosed quote does not hang, and later rows still parse', () => {
        const rows = parseCSV('name,v\n"oops,1\n2,3')
        assert.deepEqual(rows.at(-1), ['2', '3'])
    })

    test('parses 100,000 rows quickly', () => {
        const text =
            'x,y\n' +
            Array.from({ length: 100_000 }, (_, i) => `${i},${i * 2}`).join(
                '\n'
            )
        const start = performance.now()
        const rows = parseCSV(text)
        assert.equal(rows.length, 100_001)
        assert.ok(performance.now() - start < 2000, 'took more than 2 seconds')
    })

    test(
        'a trailing newline does not add a duplicate row',
        {
            todo:
                'Bug: when the file ends with "\\n", the first data row is appended again at the end. ' +
                'Most saved CSVs end with a newline, and so does the built-in sample data (200 rows → 201).',
        },
        () => {
            assert.deepEqual(parseCSV('x,y\n1,10\n2,20\n3,30\n'), [
                ['x', 'y'],
                ['1', '10'],
                ['2', '20'],
                ['3', '30'],
            ])
        }
    )

    test(
        'handles Windows line endings without leaving \\r in the last field',
        {
            todo: 'Bug: the doc comment says Windows line endings are handled, but "\\r" stays on the last field of every row.',
        },
        () => {
            assert.deepEqual(parseCSV('x,y\r\n1,2'), [
                ['x', 'y'],
                ['1', '2'],
            ])
        }
    )
})
