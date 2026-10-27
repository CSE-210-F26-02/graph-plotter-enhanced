# Chart Documentation

## chart.js

### Functions Overview

<!-- <dl>
<dt><a href="###ChartData">ChartData</a> : <code>HTMLCanvasElement</code></dt>
<dd></dd>
<dt><a href="##">ZoomParameters</a> : <code>Object</code></dt>
<dd></dd>
</dl> -->

[ChartData](#chartdata--htmlcanvaselement) : <code>HTMLCanvasElement</code>

[ZoomParameters](#zoomparameters--object) : <code>Object</code>

<a name="ChartData"></a>

### ChartData : <code>HTMLCanvasElement</code>

| Name | Type                                            | Description                                                                                                            |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| pts  | <code>Array.&lt;Array.&lt;number&gt;&gt;</code> | All points represented by the chart.                                                                                   |
| sx   | <code>function</code>                           | Function for scaling plot-space x-coordinates to element-relative screen space.                                        |
| sy   | <code>function</code>                           | Function for scaling plot-space y-coordinates to element-relative screen space.                                        |
| xi   | <code>number</code>                             | Index of the x-axis header                                                                                             |
| yi   | <code>number</code>                             | Index of the y-axis header                                                                                             |
| type | <code>string</code>                             | Type of chart to be depicted. Can be either 'scatter' or 'line'.                                                       |
| L    | <code>number</code>                             | Left margin extent of the plot relative to the canvas element, in pixels. Functions as base x-offset for graph region. |
| T    | <code>number</code>                             | Top margin extent of the plot relative to the canvas element, in pixels. Functions as base y-offset for graph region.  |
| pw   | <code>number</code>                             | Plot width, in pixels.                                                                                                 |
| ph   | <code>number</code>                             | Plot height, in pixels.                                                                                                |
| W    | <code>number</code>                             | Width of the canvas element depicting the chart, in pixels.                                                            |
| H    | <code>number</code>                             | Width of the canvas element depicting the chart, in pixels.                                                            |

<a name="ZoomParameters"></a>

### ZoomParameters : <code>Object</code>

**Kind**: global typedef  
**Properties**

| Name       | Type                | Description                                                                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| xScale     | <code>Number</code> | The x scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.                                     |
| yScale     | <code>Number</code> | The y scale factor of the chart. Ranges from MIN_ZOOM_SCALE to MAX_ZOOM_SCALE.                                     |
| xTranslate | <code>Number</code> | The x translation factor of the chart. Ranges from 0.0 to 1.0, representing the left and right edges respectively. |
| yTranslate | <code>Number</code> | The y translation factor of the chart. Ranges from 0.0 to 1.0, representing the bottom and top edges respectively. |

## parser.js

<a name="parseCSV"></a>

### parseCSV(text) ⇒ <code>Array.&lt;Array.&lt;string&gt;&gt;</code>

Parses CSV text into an array of rows.
Each row is an array of strings.
Handles quoted fields, commas inside quotes, and Windows line endings.

**Kind**: global function  
**Returns**: <code>Array.&lt;Array.&lt;string&gt;&gt;</code> - An array of rows, each row being an array of strings.  
**Todo**

- [ ] Needs fix on edge case where forgetting to end a quoted field causes the parser to hang or produce incorrect results.

| Param | Type                | Description            |
| ----- | ------------------- | ---------------------- |
| text  | <code>string</code> | The CSV text to parse. |

## helper.js

### Functions Overview

<dl>
<dt><a href="#nicestepmin-max-count--number">niceStep(min, max, count)</a> ⇒ <code>number</code></dt>
<dd><p>Picks a &quot;nice&quot; (1, 2 or 5 times a power of ten) step for a numeric range.</p>
</dd>
<dt><a href="#niceticksmin-max-count--arraynumber">niceTicks(min, max, count)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Generates a &quot;nice&quot; set of tick values for a given numeric range.
Works for any magnitude: each tick is computed as index * step (no running sum),
values are rounded relative to the step, and the count is capped at MAX_TICKS.</p>
</dd>
<dt><a href="#tickformattermin-max-count--function">tickFormatter(min, max, count)</a> ⇒ <code>function</code></dt>
<dd><p>Builds a label formatter for ticks of a given range so that every label on an
axis uses the same notation and number of digits. Small/typical magnitudes use
fixed notation; very large or very small ones share one exponent (e.g. 1.25e9).</p>
</dd>
<dt><a href="#fmtv--string">fmt(v)</a> ⇒ <code>string</code></dt>
<dd><p>Formats a number to a string with a precision of 5 significant digits.</p>
</dd>
<dt><a href="#sanitizeinputstr--string">sanitizeInput(str)</a> ⇒ <code>string</code></dt>
<dd><p>Sanitize any string and remove potentially harmful characters or attacks</p>
</dd>
</dl>

<a name="niceStep"></a>

### niceStep(min, max, count) ⇒ <code>number</code>

Picks a "nice" (1, 2 or 5 times a power of ten) step for a numeric range.

**Kind**: global function  
**Returns**: <code>number</code> - The step, or NaN if the range is empty or not finite.

| Param | Type                | Default        | Description                         |
| ----- | ------------------- | -------------- | ----------------------------------- |
| min   | <code>number</code> |                |                                     |
| max   | <code>number</code> |                |                                     |
| count | <code>number</code> | <code>6</code> | Approximate number of ticks wanted. |

<a name="niceTicks"></a>

### niceTicks(min, max, count) ⇒ <code>Array.&lt;number&gt;</code>

Generates a "nice" set of tick values for a given numeric range.
Works for any magnitude: each tick is computed as index \* step (no running sum),
values are rounded relative to the step, and the count is capped at MAX_TICKS.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - An array of "nice" tick values within the specified range.

| Param | Type                | Default        | Description                         |
| ----- | ------------------- | -------------- | ----------------------------------- |
| min   | <code>number</code> |                |                                     |
| max   | <code>number</code> |                |                                     |
| count | <code>number</code> | <code>6</code> | Approximate number of ticks wanted. |

<a name="tickFormatter"></a>

### tickFormatter(min, max, count) ⇒ <code>function</code>

Builds a label formatter for ticks of a given range so that every label on an
axis uses the same notation and number of digits. Small/typical magnitudes use
fixed notation; very large or very small ones share one exponent (e.g. 1.25e9).

**Kind**: global function

| Param | Type                | Default        | Description                               |
| ----- | ------------------- | -------------- | ----------------------------------------- |
| min   | <code>number</code> |                |                                           |
| max   | <code>number</code> |                |                                           |
| count | <code>number</code> | <code>6</code> | Must match the count passed to niceTicks. |

<a name="fmt"></a>

### fmt(v) ⇒ <code>string</code>

Formats a number to a string with a precision of 5 significant digits.

**Kind**: global function

| Param | Type                |
| ----- | ------------------- |
| v     | <code>number</code> |

<a name="sanitizeInput"></a>

### sanitizeInput(str) ⇒ <code>string</code>

Sanitize any string and remove potentially harmful characters or attacks

**Kind**: global function

| Param | Type                |
| ----- | ------------------- |
| str   | <code>string</code> |

## errors.js

### Classes Overview

<dl>
<dt><a href="#invalidfileerror">InvalidFileError</a></dt>
<dd><p>Represents an error that occurs when an invalid file is encountered.</p>
</dd>
<dt><a href="#nodatafounderror">NoDataFoundError</a></dt>
<dd><p>Represents an error that occurs when no data is found.</p>
</dd>
<dt><a href="#nodatafounderror">NotEnoughColumnsError</a></dt>
<dd><p>Represents an error that occurs when there are not enough columns in the data.</p>
</dd>
<dt><a href="#invalidfileerror">InvalidFileTypeError</a></dt>
<dd><p>Represents an error that occurs when an invalid file type is encountered.</p>
</dd>
</dl>

<a name="InvalidFileError"></a>

### InvalidFileError

Represents an error that occurs when an invalid file is encountered.

**Kind**: global class  
<a name="NoDataFoundError"></a>

### NoDataFoundError

Represents an error that occurs when no data is found.

**Kind**: global class  
<a name="NotEnoughColumnsError"></a>

### NotEnoughColumnsError

Represents an error that occurs when there are not enough columns in the data.

**Kind**: global class  
<a name="InvalidFileTypeError"></a>

### InvalidFileTypeError

Represents an error that occurs when an invalid file type is encountered.

**Kind**: global class
