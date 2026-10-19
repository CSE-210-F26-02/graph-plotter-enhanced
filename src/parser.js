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
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // remove BOM
  const out = [];
  let row = [], field = '', inQuotes = false, start = 0;
  const regex = /"(?:[^"\\]|\\.)*"|\n/g;

  let m;
  let finalLine = false;
  while ((m = regex.exec(text)) !== null || !finalLine) {
    if (m === null || m[0] === "\n") {
      if (m === null) m = { index: text.length }; // handle final line without newline
      if( m.index === text.length) finalLine = true;
      const line = text.slice(start, m.index);
      start = m.index + 1;
      if (line.trim() === '') continue; // skip empty lines
      field = '';
      inQuotes = false;
      // Empty string skip
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"') {
            if (line[i + 1] === '"') { field += '"'; i++; } // escaped quote
            else inQuotes = false;
          } else field += c;
        } else if (field.trim() === '' && c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else field += c;
      }
      if (inQuotes) {
        field += '"';
      }
      row.push(field);
      field = '';
      out.push(row);
      row = [];
    }
    if (finalLine) break;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  return out;
}