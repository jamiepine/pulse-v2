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
  FILTER_REGEN: "filterRegen"
};

export function uuid() {
  return (
    Math.random()
      .toString()
      .split(".")[1] + Date.now()
  );
}
