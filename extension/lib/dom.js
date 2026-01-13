export function $(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

export function setText(selector, text) {
  const el = $(selector);
  el.textContent = text;
}

export function setValue(selector, value) {
  const el = $(selector);
  el.value = value;
}

export function on(selector, event, handler) {
  const el = $(selector);
  el.addEventListener(event, handler);
  return el;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

