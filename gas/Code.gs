/**
 * AnnotationApp (Provocations) - Google Apps Script Edition
 *
 * AI-augmented document workspace where users iteratively shape ideas
 * into polished documents through thought-provoking AI interactions.
 *
 * Entry point: menu setup, sidebar launch, initialization.
 * All entry points enforce @salesforce.com domain + invite list access.
 */

// ============================================================
// Web App Entry Point
// ============================================================

/**
 * Serves the app as a standalone web app.
 * Deployed via: Deploy > New deployment > Web app
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('AnnotationApp')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// Add-on Menu (only works when bound to Docs/Sheets, ignored in web app)
// ============================================================

/**
 * Runs when the document/spreadsheet is opened (add-on context only).
 * Silently does nothing when running as a web app.
 */
function onOpen() {
  var ui;
  try {
    ui = DocumentApp.getUi();
  } catch (e) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e2) {
      // Running as web app — no menu needed
      return;
    }
  }

  ui.createMenu('AnnotationApp')
    .addItem('Open Workspace', 'openSidebarAddon_')
    .addSeparator()
    .addItem('Run Setup / Migrate', 'runSetup')
    .addToUi();
}

/**
 * Opens the sidebar in add-on context only.
 * @private
 */
function openSidebarAddon_() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('AnnotationApp')
    .setWidth(420);

  try {
    DocumentApp.getUi().showSidebar(html);
  } catch (e) {
    try {
      SpreadsheetApp.getUi().showSidebar(html);
    } catch (e2) {
      Logger.log('Cannot show sidebar outside Docs/Sheets');
    }
  }
}

// ============================================================
// HTML Template Helpers
// ============================================================

/**
 * Include partial HTML files (for CSS/JS separation).
 * Usage in HTML: <?!= include('SidebarCSS') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// Initialization
// ============================================================

/**
 * First-run setup: validates access, creates user's storage and Drive folders.
 */
function initialize() {
  var access = enforceAccess();
  var folders = DriveService.getOrCreateAppFolders();
  var config = getConfig();

  return {
    ready: true,
    hasApiKey: !!config.geminiApiKey || config.useVertexAi,
    userEmail: access.email,
    appFolderId: folders.root.getId()
  };
}

/**
 * Get current configuration state (no secrets exposed to client).
 */
function getConfigState() {
  enforceAccess();
  var config = getConfig();
  return {
    hasApiKey: !!config.geminiApiKey || config.useVertexAi,
    model: config.model,
    useVertexAi: config.useVertexAi,
    vertexProject: config.vertexProject ? '(configured)' : null,
    vertexLocation: config.vertexLocation || null,
    userRole: getUserRole(),
    userEmail: Session.getActiveUser().getEmail()
  };
}

// ============================================================
// Log Data Retrieval (for LogViewer)
// ============================================================

/**
 * Get log data for the LogViewer. Admin-only.
 *
 * @param {string} logType - 'access' or 'error'
 * @return {Object} { headers: string[], rows: any[][] }
 */
function getLogData(logType) {
  enforceAdmin();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return { headers: [], rows: [] };

  var sheetName = logType === 'error' ? SHEET_ERROR_LOG : SHEET_ACCESS_LOG;
  var sheet = adminSheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return { headers: [], rows: [] };

  var data = sheet.getDataRange().getValues();
  return {
    headers: data[0].map(function(h) { return String(h); }),
    rows: data.slice(1)
  };
}
