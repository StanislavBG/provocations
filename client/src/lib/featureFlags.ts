/**
 * Feature flags for the Provocations app.
 *
 * USE_NOTEBOOK_LAYOUT — When true, routes to the new NotebookLM-style workspace
 * instead of the classic multi-panel Workspace. Enable via:
 *   - URL param: ?notebook
 *   - localStorage: provoke_notebook_layout = "true"
 */
export const USE_NOTEBOOK_LAYOUT =
  typeof window !== "undefined" &&
  (localStorage.getItem("provoke_notebook_layout") === "true" ||
    new URLSearchParams(window.location.search).has("notebook"));
