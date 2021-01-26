import {html} from "htl";

const ns = "observablehq-table";

export function Table(
  data,
  {
    columns = data.columns, // array of column names
    rows = 11.5, // maximum number of rows to show
    sort, // name of column to sort by, if any
    reverse = false, // if sorting, true for ascending and false for descending
    format, // object of column name to format function
    align = {}, // object of column name to left, right, or center
    width = {}, // object of column name to width
    layout // "fixed" or "auto"
  } = {}
) {
  data = arrayof(data);
  if (columns === undefined) columns = columnsof(data);
  if (layout === undefined) layout = columns.length >= 12 ? "auto" : "fixed";
  format = formatof(format, data, columns);
  align = alignof(align, data, columns);

  let n = rows * 2;
  let currentSortHeader = null, currentReverse = false;
  let selected = new Set();
  let anchor = null, head = null;
  let index = Uint32Array.from(data, (_, i) => i);

  const tbody = html`<tbody>`;
  const tr = html`<tr><td><input type=checkbox></td>${columns.map(column => html`<td style=${{textAlign: align[column]}}>`)}`;
  const theadr = html`<tr><th><input type=checkbox onclick=${reselectAll}></th>${columns.map((column) => html`<th title=${column} style=${{width: width[column], textAlign: align[column]}} onclick=${event => resort(event, column)}><span></span>${column}</th>`)}</tr>`;
  const root = html`<div class=${ns} style="max-height: ${(rows + 1) * 24 - 1}px;">
  <table style=${{tableLayout: layout}}>
    <thead>${data.length || columns.length ? theadr : null}</thead>
    ${tbody}
  </table>
</div>`;

  function inputof(tr) {
    return tr.firstChild.firstChild;
  }

  function orderof(th) {
    return th.firstChild;
  }

  function render(i, j) {
    return Array.from(index.subarray(i, j), i => {
      const itr = tr.cloneNode(true);
      itr.classList.toggle("selected", selected.has(i));
      const input = inputof(itr);
      input.onclick = reselect;
      input.checked = selected.has(i);
      input.name = i;
      for (let j = 0; j < columns.length; ++j) {
        let column = columns[j];
        let value = data[i][column];
        if (!defined(value)) continue;
        value = format[column](value);
        if (!(value instanceof Node)) value = document.createTextNode(value);
        itr.childNodes[j + 1].appendChild(value);
      }
      return itr;
    });
  }

  function unselect(i) {
    let j = index.indexOf(i);
    if (j < tbody.childNodes.length) {
      const tr = tbody.childNodes[j];
      tr.classList.toggle("selected", false);
      inputof(tr).checked = false;
    }
    selected.delete(i);
  }

  function select(i) {
    let j = index.indexOf(i);
    if (j < tbody.childNodes.length) {
      const tr = tbody.childNodes[j];
      tr.classList.toggle("selected", true);
      inputof(tr).checked = true;
    }
    selected.add(i);
  }

  function* range(i, j) {
    i = index.indexOf(i), j = index.indexOf(j);
    if (i < j) while (i <= j) yield index[i++];
    else while (j <= i) yield index[j++];
  }

  function first(set) {
    return set[Symbol.iterator]().next().value;
  }

  function reselectAll(event) {
    if (selected.size) {
      for (let i of selected) unselect(i);
      anchor = head = null;
      if (event.detail) event.currentTarget.blur();
    } else {
      selected = new Set(index);
      for (const tr of tbody.childNodes) {
        tr.classList.toggle("selected", true);
        inputof(tr).checked = true;
      }
    }
    reinput();
  }

  function reselect(event) {
    let i = +this.name;
    if (event.shiftKey) {
      if (anchor === null) anchor = selected.size ? first(selected) : index[0];
      else for (let i of range(anchor, head)) unselect(i);
      head = i;
      for (let i of range(anchor, head)) select(i);
    } else {
      anchor = head = i;
      if (selected.has(i)) {
        unselect(i);
        anchor = head = null;
        if (event.detail) event.currentTarget.blur();
      } else {
        select(i);
      }
    }
    reinput();
  }

  function resort(event, column) {
    const th = event.currentTarget;
    let compare;
    if (currentSortHeader === th && currentReverse) {
      orderof(currentSortHeader).textContent = "";
      currentSortHeader.classList.toggle("sort", false);
      currentSortHeader = null;
      currentReverse = false;
      compare = ascending;
    } else {
      if (currentSortHeader === th) {
        currentReverse = true;
      } else {
        if (currentSortHeader) {
          orderof(currentSortHeader).textContent = "";
          currentSortHeader.classList.toggle("sort", false);
        }
        currentSortHeader = th, currentReverse = false;
      }
      const order = currentReverse ? descending : ascending;
      compare = (a, b) => order(data[a][column], data[b][column]);
      orderof(th).textContent = currentReverse ? "▾"  : "▴";
      th.classList.toggle("sort", true);
    }
    index.sort(compare);
    selected = new Set(Array.from(selected).sort(compare));
    root.scrollTo(0, 0);
    while (tbody.firstChild) tbody.firstChild.remove();
    tbody.append(...render(0, n = rows * 2));
    anchor = head = null;
    reinput();
  }

  function reinput() {
    theadr.classList.toggle("selected", selected.size);
    inputof(theadr).checked = selected.size;
    revalue();
    root.dispatchEvent(new CustomEvent("input"));
  }

  function revalue() {
    root.value = Array.from(selected.size ? selected : index, i => data[i]);
    root.value.columns = columns;
  }

  root.onscroll = () => {
    if (root.scrollHeight - root.scrollTop < 400 && n < data.length) {
      tbody.append(...render(n, n += rows));
    }
  };

  if (data.length) {
    tbody.append(...render(0, n));
  } else {
    tbody.append(html`<tr>${columns.length ? html`<td>` : null}<td rowspan=${columns.length} style="padding-left: 1em; font-style: oblique;">No results.</td></tr>`);
  }

  revalue();

  if (sort !== undefined) {
    let i = columns.indexOf(sort);
    if (i >= 0) {
      if (reverse) currentSortHeader = theadr.childNodes[i + 1];
      resort({currentTarget: theadr.childNodes[i + 1]}, columns[i]);
    }
  }

  if (!Table.style) Table.style = document.body.appendChild(style());
  return root;
}

function style() {
  return html`<style>

.${ns} {
  overflow-y: scroll;
  margin: 0 -14px;
}

.${ns} table {
  max-width: initial;
  min-height: 33px;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.${ns} thead th span {
  display: inline-block;
  width: 0.5em;
  margin-left: -0.5em;
}

.${ns} td,
.${ns} th {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  border-bottom: solid 1px #eee;
}

.${ns} tr > :not(:first-of-type) {
  padding-left: 0.7em;
}

.${ns} tr > :last-of-type {
  padding-right: 1em;
}

.${ns} tr > :first-of-type {
  width: 19px;
}

.${ns} tr,
.${ns} tr:last-child td {
  border-bottom: none;
}

.${ns} tr > :first-of-type input {
  opacity: 0;
  margin: 0 3px 3px 4px;
}

.${ns} tr:hover > :first-of-type input,
.${ns} tr > :first-of-type input:focus,
.${ns} tr > :first-of-type input:checked {
  opacity: inherit;
}

.${ns} thead th {
  position: sticky;
  top: 0;
  background: white;
  border-bottom: solid 1px #ccc;
  cursor: ns-resize;
}

</style>`;
}

function formatof(base = {}, data, columns) {
  const format = Object.create(null);
  for (const column of columns) {
    if (column in base) {
      format[column] = base[column];
      continue;
    }
    switch (type(data, column)) {
      case "number": format[column] = formatNumber; break;
      case "date": format[column] = formatDate; break;
      default: format[column] = formatDefault; break;
    }
  }
  return format;
}

function alignof(base = {}, data, columns) {
  const align = Object.create(null);
  for (const column of columns) {
    if (column in base) {
      align[column] = base[column];
    } else if (type(data, column) === "number") {
      align[column] = "right";
    }
  }
  return align;
}

function type(data, column) {
  for (const d of data) {
    const value = d[column];
    if (value == null) continue;
    if (typeof value === "number") return "number";
    if (value instanceof Date) return "date";
    return;
  }
}

function columnsof(data) {
  const columns = {};
  for (const row of data) {
    for (const name in row) {
      columns[name] = true;
    }
  }
  return Object.keys(columns);
}

function arrayof(x) {
  return typeof x === "object" && "length" in x
    ? x // Array, TypedArray, NodeList, array-like
    : Array.from(x); // Map, Set, iterable, string, or anything else
}

function pad(value, width) {
  return (value + "").padStart(width, "0");
}

function formatDefault(value) {
  return value + "";
}

function formatNumber(value) {
  return value.toLocaleString("en");
}

function formatYear(year) {
  return year < 0 ? "-" + pad(-year, 6) : year > 9999 ? "+" + pad(year, 6) : pad(year, 4);
}

function formatDate(date) {
  var hours = date.getUTCHours(),
      minutes = date.getUTCMinutes(),
      seconds = date.getUTCSeconds(),
      milliseconds = date.getUTCMilliseconds();
  return isNaN(date) ? "Invalid Date"
      : formatYear(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2)
      + (milliseconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(milliseconds, 3) + "Z"
      : seconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "Z"
      : minutes || hours ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + "Z"
      : "");
}

function ascending(a, b) {
  return defined(b) - defined(a) || (a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN);
}

function descending(b, a) {
  return defined(a) - defined(b) || (a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN);
}

function defined(d) {
  return d != null && !Number.isNaN(d);
}