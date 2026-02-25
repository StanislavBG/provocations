/**
 * Feature flags for the Provocations app.
 *
 * USE_NOTEBOOK_LAYOUT — Notebook layout is now the default experience.
 * Opt OUT to classic via ?classic URL param or localStorage.
 */
export const USE_NOTEBOOK_LAYOUT =
  typeof window === "undefined"
    ? true
    : localStorage.getItem("provoke_notebook_layout") !== "false" &&
      !new URLSearchParams(window.location.search).has("classic");
