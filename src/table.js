import {html} from "htl";
import {arrayify} from "./array.js";
import {length} from "./css.js";
import {bubbles} from "./event.js";
import {formatDate, formatNumber, stringify} from "./format.js";
import {newId} from "./id.js";
import {identity} from "./identity.js";
import {defined, ascending, descending} from "./sort.js";

const objectValueOf = Object.prototype.valueOf;
const rowHeight = 22;

export function Table(
  data,
  {
    columns, // array of column names
    value, // initial selection
    rows = 11.5, // maximum number of rows to show
    sort, // name of column to sort by, if any
    reverse = false, // if sorting, true for descending and false for ascending
    format, // object of column name to format function
    align, // object of column name to left, right, or center
    width = {}, // object of column name to width, or overall table width
    layout // "fixed" or "auto"
  } = {}
) {
  columns = columns === undefined ? columnsof(data) : arrayify(columns);
  if (layout === undefined) layout = columns.length >= 12 ? "auto" : "fixed";
  format = formatof(format, data, columns);
  align = alignof(align, data, columns);

  const N = lengthof(data); // total number of rows
  let n = Math.min(N, Math.floor(rows * 2)); // number of currently-shown rows
  let currentSortHeader = null, currentReverse = false;
  let selected = new Set();
  let anchor = null, head = null;

  let array;
  let index;
  let iterator = data[Symbol.iterator]();
  let iterindex = 0;

  // Defer materializing index and data arrays until needed.
  function materialize() {
    if (iterindex >= 0) {
      iterindex = iterator = undefined;
      index = Uint32Array.from(array = arrayify(data), (_, i) => i);
    }
  }

  const height = (rows + 1) * rowHeight - 1;
  const id = newId();
  const tbody = html`<tbody>`;
  const tr = html`<tr><td><input type=checkbox></td>${columns.map(() => html`<td>`)}`;
  const theadr = html`<tr><th><input type=checkbox onclick=${reselectAll}></th>${columns.map((column) => html`<th title=${column} onclick=${event => resort(event, column)}><span></span>${column}</th>`)}</tr>`;
  const root = html`<div class="__ns__ __ns__-table" id=${id} style="max-height: ${height}px;">
  <table style=${{tableLayout: layout, width: typeof width === "string" || typeof width === "number" ? length(width) : undefined}}>
    <thead>${N || columns.length ? theadr : null}</thead>
    ${tbody}
  </table>
  <style>${columns.map((column, i) => {
    const rules = [];
    if (align[column]) rules.push(`text-align:${align[column]}`);
    if (width[column]) rules.push(`width:${length(width[column])}`);
    if (rules.length) return `#${id} tr>:nth-child(${i + 2}){${rules.join(";")}}`;
  }).filter(identity).join("\n")}</style>
</div>`;

  function appendRows(i, j) {
    if (iterindex === i) {
      for (; i < j; ++i) {
        appendRow(iterator.next().value, i);
      }
      iterindex = j;
    } else {
      for (let k; i < j; ++i) {
        k = index[i];
        appendRow(array[k], k);
      }
    }
  }

  function appendRow(d, i) {
    const itr = tr.cloneNode(true);
    const input = inputof(itr);
    input.onclick = reselect;
    input.checked = selected.has(i);
    input.name = i;
    for (let j = 0; j < columns.length; ++j) {
      let column = columns[j];
      let value = d[column];
      if (!defined(value)) continue;
      value = format[column](value, i, data);
      if (!(value instanceof Node)) value = document.createTextNode(value);
      itr.childNodes[j + 1].appendChild(value);
    }
    tbody.append(itr);
  }

  function unselect(i) {
    materialize();
    let j = index.indexOf(i);
    if (j < tbody.childNodes.length) {
      const tr = tbody.childNodes[j];
      inputof(tr).checked = false;
    }
    selected.delete(i);
  }

  function select(i) {
    materialize();
    let j = index.indexOf(i);
    if (j < tbody.childNodes.length) {
      const tr = tbody.childNodes[j];
      inputof(tr).checked = true;
    }
    selected.add(i);
  }

  function* range(i, j) {
    materialize();
    i = index.indexOf(i), j = index.indexOf(j);
    if (i < j) while (i <= j) yield index[i++];
    else while (j <= i) yield index[j++];
  }

  function first(set) {
    return set[Symbol.iterator]().next().value;
  }

  function reselectAll(event) {
    materialize();
    if (this.checked) {
      selected = new Set(index);
      for (const tr of tbody.childNodes) {
        inputof(tr).checked = true;
      }
    } else {
      for (let i of selected) unselect(i);
      anchor = head = null;
      if (event.detail) event.currentTarget.blur();
    }
    reinput();
  }

  function reselect(event) {
    materialize();
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
    materialize();
    const th = event.currentTarget;
    let compare;
    if (currentSortHeader === th && event.metaKey) {
      sorterof(currentSortHeader).textContent = "";
      currentSortHeader = null;
      currentReverse = false;
      compare = ascending;
    } else {
      if (currentSortHeader === th) {
        currentReverse = !currentReverse;
      } else {
        if (currentSortHeader) {
          sorterof(currentSortHeader).textContent = "";
        }
        currentSortHeader = th;
        currentReverse = event.altKey;
      }
      const order = currentReverse ? descending : ascending;
      compare = (a, b) => {
        const va = array[a][column];
        const vb = array[b][column];
        return defined(vb) - defined(va) || order(va, vb);
      };
      sorterof(th).textContent = currentReverse ? "▾"  : "▴";
    }
    index.sort(compare);
    selected = new Set(Array.from(selected).sort(compare));
    root.scrollTo(root.scrollLeft, 0);
    while (tbody.firstChild) tbody.firstChild.remove();
    appendRows(0, n = Math.min(N, Math.floor(rows * 2)));
    anchor = head = null;
    reinput();
  }

  function reinput() {
    const check = inputof(theadr);
    check.indeterminate = selected.size && selected.size !== N;
    check.checked = selected.size;
    value = undefined; // lazily computed
    root.dispatchEvent(new Event("input", bubbles));
  }

  root.onscroll = () => {
    if (root.scrollHeight - root.scrollTop < height * 1.5 && n < N) {
      appendRows(n, n = Math.min(N, n + Math.floor(rows)));
    }
  };

  if (sort === undefined && reverse) {
    materialize();
    index.reverse();
  }

  if (value !== undefined) {
    materialize();
    const values = new Set(value);
    selected = new Set(index.filter(i => values.has(array[i])));
    reinput();
  }

  if (N) {
    appendRows(0, n);
  } else {
    tbody.append(html`<tr>${columns.length ? html`<td>` : null}<td rowspan=${columns.length} style="padding-left: var(--length3); font-style: italic;">No results.</td></tr>`);
  }

  if (sort !== undefined) {
    let i = columns.indexOf(sort);
    if (i >= 0) {
      if (reverse) currentSortHeader = theadr.childNodes[i + 1];
      resort({currentTarget: theadr.childNodes[i + 1]}, columns[i]);
    }
  }

  return Object.defineProperty(root, "value", {
    get() {
      if (value === undefined) {
        materialize();
        value = Array.from(selected.size ? selected : index, i => array[i]);
        value.columns = columns;
      }
      return value;
    },
    set(v) {
      materialize();
      const values = new Set(v);
      const selection = new Set(index.filter(i => values.has(array[i])));
      for (const i of selected) if (!selection.has(i)) unselect(i);
      for (const i of selection) if (!selected.has(i)) select(i);
      value = undefined; // lazily computed
    }
  });
}

function inputof(tr) {
  return tr.firstChild.firstChild;
}

function sorterof(th) {
  return th.firstChild;
}

function orderof(base = {}, data, columns) {
  const order = Object.create(null);
  for (const column of columns) {
    if (column in base) {
      if (typeof base[column] !== "function") throw new Error("order is not a function");
      order[column] = base[column];
      continue;
    }
    for (const d of data) {
      const value = d[column];
      if (value == null) continue;
      if (value.valueOf !== objectValueOf) order[column] = ascending;
      break;
    }
  }
  return order;
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
      default: format[column] = stringify; break;
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

function lengthof(data) {
  if (typeof data.length === "number") return data.length; // array or array-like
  if (typeof data.size === "number") return data.size; // map, set
  if (typeof data.numRows === "function") return data.numRows(); // arquero
  let size = 0;
  for (const d of data) ++size; // eslint-disable-line no-unused-vars
  return size;
}

function columnsof(data) {
  if (Array.isArray(data.columns)) return data.columns; // d3-dsv, FileAttachment
  if (typeof data.columnNames === "function") return data.columnNames(); // arquero
  const columns = new Set();
  for (const row of data) {
    for (const name in row) {
      columns.add(name);
    }
  }
  return Array.from(columns);
}
