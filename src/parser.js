import { MalformedCSVError } from './errors.js'

/**
 * Parses CSV text into an array of rows.
 * Each row is an array of strings.
 * Handles quoted fields, commas inside quotes, and Windows line endings.
 *
 * @todo Needs fix on edge case where forgetting to end a quoted field causes the parser to hang or produce incorrect results.
 *
 * @param {string} text - The CSV text to parse.
 * @returns {string[][]} An array of rows, each row being an array of strings.
 */
function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // remove BOM
    // Slice off any ending newline to avoid an extra empty row at the end.
    if (text.endsWith('\n')) text = text.slice(0, -1)
    const out = []
    let row = [],
        field = '',
        inQuotes = false,
        start = 0
    const regex = /"(?:[^"\\]|\\.)*"|\n/g

    let m
    let finalLine = false
    let skipLine = false // Flag to indicate if the current line should be skipped due to a malformed CSV error
    while ((m = regex.exec(text)) !== null || !finalLine) {
        if (m === null || m[0] === '\n') {
            if (m === null) m = { index: text.length } // handle final line without newline
            if (m.index === text.length) finalLine = true
            const line = text.slice(start, m.index).replace(/\r$/, '')
            start = m.index + 1
            if (line.trim() === '') continue // skip empty lines
            field = ''
            inQuotes = false
            // Empty string skip
            for (let i = 0; i < line.length; i++) {
                const c = line[i]
                if (inQuotes) {
                    if (i + 1 === line.length && c !== '"') {
                        // If we are at the end of the line and still in quotes, we have an unclosed quote. Treat the CSV as invalid and return an error
                        if (out.length === 0) {
                            // Only throw error for the header row
                            throw new MalformedCSVError(
                                'Unclosed quote in CSV line: ' + line
                            )
                        } else {
                            // Skip this line completely if it's not the first line (header) and just log a warning
                            console.warn(
                                'Warning: Unclosed quote in CSV line: ' + line
                            )
                            skipLine = true
                            break // Skip processing this line
                        }
                    } else if (c === '"') {
                        if (line[i + 1] === '"') {
                            field += '"'
                            i++
                        } // escaped quote
                        else inQuotes = false
                    } else field += c
                } else if (field.trim() === '' && c === '"') inQuotes = true
                else if (c === ',') {
                    row.push(field)
                    field = ''
                } else field += c
            }
            if (skipLine) {
                skipLine = false
            } else {
                row.push(field)
                out.push(row)
            }
            row = []
            field = ''
        }
        if (finalLine) break
    }
    if (field !== '' || row.length) {
        row.push(field)
        out.push(row)
    }
    return out
}

export { parseCSV }
