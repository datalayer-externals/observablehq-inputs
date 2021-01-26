import {html} from "htl";
import {defaultStyle, marginRight} from "./style.js";

export function Range([min, max] = [0, 1], {
  format = d => d.toLocaleString("en"),
  label = "",
  width = 180,
  value,
  step,
  style
} = {}) {
  if (typeof format !==  "function") throw new TypeError("format is not a function");
  const form = html`<form style=${{...defaultStyle, ...style}}>
    <input name=input oninput=${oninput} type=range style=${{...marginRight, width: `${+width}px`}}><output name=output style=${marginRight}></output>${label}
  </form>`;
  const {input, output} = form.elements;
  input.min = min = +min;
  input.max = max = +max;
  input.step = step === undefined ? "any" : +step;
  input.value = value === undefined ? (min + max) / 2 : +value;
  function oninput() { output.value = format(form.value = input.valueAsNumber); }
  oninput();
  return form;
}