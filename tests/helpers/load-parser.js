/**
 * Loads src/parser.js for testing.
 *
 * parser.js is a classic browser script (index.html loads it with a plain
 * <script> tag, so parseCSV becomes a global) and has no export. We run the
 * real file in a node:vm sandbox and read the function off the sandbox, so the
 * source stays untouched. If parser.js ever becomes a module, replace this
 * with a normal import.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadParseCSV() {
  const sandbox = vm.createContext({});
  const source = readFileSync(new URL('../../src/parser.js', import.meta.url), 'utf8');
  vm.runInContext(source, sandbox, { filename: 'parser.js' });
  // Values from the sandbox use another realm's Array; copy to plain data for deepEqual.
  return (text) => JSON.parse(JSON.stringify(sandbox.parseCSV(text)));
}
