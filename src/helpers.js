export const protectedNames = [
  "data",
  "indexes",
  "groups",
  "filters",
  "actions",
  "routes"
];

export const jobTypes = {
  PUBLIC_DATA_MUTATION: "PUBLIC_DATA_MUTATION",
  INTERNAL_DATA_MUTATION: "INTERNAL_DATA_MUTATION",
  GROUP_UPDATE: "GROUP_UPDATE",
  FILTER_REGEN: "FILTER_REGEN"
};

export function uuid() {
  return (
    Math.random()
      .toString()
      .split(".")[1] + Date.now()
  );
}

export function log(value, payload) {
  console.log(`Pulse / ${value}`, payload ? payload : " ");
}

export const arrayFunctions = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse"
];

export function isWatchableObject(value) {
  function isHTMLElement(obj) {
    try {
      return obj instanceof HTMLElement;
    } catch (e) {
      return (
        typeof obj === "object" &&
        obj.nodeType === 1 &&
        typeof obj.style === "object" &&
        typeof obj.ownerDocument === "object"
      );
    }
  }
  let type = typeof value;
  return (
    value != null &&
    type == "object" &&
    !isHTMLElement(value) &&
    !Array.isArray(value)
  );
}
