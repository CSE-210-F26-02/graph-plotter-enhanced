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
  let row = [], field = '', inQuotes = false;
  const lines = text.split(/\r\n|\n|\r/);
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    field = '';
    inQuotes = false;
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
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  return out;
}