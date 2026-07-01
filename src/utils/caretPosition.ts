// Minimal mirror-div caret coordinate calculator for <textarea>.
const PROPERTIES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "whiteSpace",
] as const;

export function getCaretCoordinates(el: HTMLTextAreaElement, position: number) {
  const div = document.createElement("div");
  const style = window.getComputedStyle(el);

  PROPERTIES.forEach((prop) => {
    (div.style as unknown as Record<string, string>)[prop] = (style as unknown as Record<string, string>)[prop];
  });

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.height = "auto";

  document.body.appendChild(div);

  const before = el.value.substring(0, position);
  div.textContent = before;

  const span = document.createElement("span");
  span.textContent = el.value.substring(position) || ".";
  div.appendChild(span);

  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft - el.scrollLeft;
  const height = parseInt(style.lineHeight || "20", 10) || 20;

  document.body.removeChild(div);

  return { top, left, height };
}
