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
  INDEX_UPDATE: "INDEX_UPDATE",
  GROUP_UPDATE: "GROUP_UPDATE",
  FILTER_REGEN: "FILTER_REGEN",
  DEEP_PUBLIC_DATA_MUTATION: "DEEP_PUBLIC_DATA_MUTATION"
};

export function defineConfig(config, defaults) {
  return { ...defaults, ...config };
}

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

export function normalizeMap(map) {
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key }))
    : Object.keys(map).map(key => ({ key, val: map[key] }));
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

export function assert(func, funcName) {
  function warn(message) {
    if (funcName) console.log(`Pulse / ${funcName} / ${message}`);
    else console.warn(`Pulse / ${message}`);
    return false;
  }
  const warnings = {
    NO_PRIMARY_KEY: () => warn("No primary key found!"),
    INVALID_PARAMETER: () => warn("Invalid parameter supplied to function.")
  };
  return func(warnings)();
}

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
