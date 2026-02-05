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
// Menu & Sidebar
// ============================================================

/**
 * Runs when the document/spreadsheet is opened.
 * Adds the AnnotationApp menu to the UI.
 */
function onOpen() {
  var ui;
  try {
    ui = DocumentApp.getUi();
  } catch (e) {
    try {
      ui = SpreadsheetApp.getUi();
    } catch (e2) {
      Logger.log('Could not get UI — running outside Docs/Sheets');
      return;
    }
  }

  var menu = ui.createMenu('AnnotationApp')
    .addItem('Open Workspace', 'showSidebar')
    .addItem('Import from Drive', 'showDrivePicker')
    .addItem('Send Feedback', 'showFeedback')
    .addSeparator()
    .addItem('Settings', 'showSettings');

  // Admin submenu — shown to all but enforced server-side
  menu.addSeparator()
    .addSubMenu(ui.createMenu('Admin')
      .addItem('Run Setup / Migrate', 'runSetup')
      .addItem('User Management', 'showAdminPanel')
      .addItem('Dashboard', 'showAdminDashboard')
      .addItem('Feedback Manager', 'showFeedbackManager')
      .addItem('Log Viewer', 'showLogViewer')
    )
    .addItem('About', 'showAbout')
    .addToUi();
}

/**
 * Google Docs add-on homepage trigger.
 */
function onDocsHomepage(e) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('AnnotationApp'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(
          'AI-augmented document workspace for iterative thinking.'
        ))
        .addWidget(CardService.newTextButton()
          .setText('Open Workspace')
          .setOnClickAction(CardService.newAction().setFunctionName('showSidebar'))
        )
    )
    .build();
}

/**
 * Opens the main sidebar. Enforces access control.
 */
function showSidebar() {
  var access = checkAccess();
  if (!access.authorized) {
    showAccessDenied_(access.reason);
    return;
  }

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

/**
 * Opens a Drive file picker dialog.
 */
function showDrivePicker() {
  enforceAccess();

  var html = HtmlService.createTemplateFromFile('DrivePicker')
    .evaluate()
    .setWidth(600)
    .setHeight(400);

  try {
    DocumentApp.getUi().showModalDialog(html, 'Select a Document');
  } catch (e) {
    SpreadsheetApp.getUi().showModalDialog(html, 'Select a Document');
  }
}

/**
 * Opens the settings dialog.
 */
function showSettings() {
  enforceAccess();

  var html = HtmlService.createTemplateFromFile('Settings')
    .evaluate()
    .setWidth(450)
    .setHeight(350);

  try {
    DocumentApp.getUi().showModalDialog(html, 'AnnotationApp Settings');
  } catch (e) {
    SpreadsheetApp.getUi().showModalDialog(html, 'AnnotationApp Settings');
  }
}

/**
 * Opens the admin panel dialog.
 */
function showAdminPanel() {
  enforceAdmin();

  var html = HtmlService.createTemplateFromFile('AdminPanel')
    .evaluate()
    .setWidth(550)
    .setHeight(500);

  try {
    DocumentApp.getUi().showModalDialog(html, 'AnnotationApp Admin');
  } catch (e) {
    SpreadsheetApp.getUi().showModalDialog(html, 'AnnotationApp Admin');
  }
}

/**
 * Opens the feedback submission dialog.
 */
function showFeedback() {
  enforceAccess();

  var html = HtmlService.createTemplateFromFile('FeedbackModal')
    .evaluate()
    .setWidth(480)
    .setHeight(520);

  showDialog_(html, 'Send Feedback');
}

/**
 * Opens the admin dashboard.
 */
function showAdminDashboard() {
  enforceAdmin();

  var html = HtmlService.createTemplateFromFile('AdminDashboard')
    .evaluate()
    .setWidth(580)
    .setHeight(560);

  showDialog_(html, 'Admin Dashboard');
}

/**
 * Opens the feedback manager (admin-only).
 */
function showFeedbackManager() {
  enforceAdmin();

  var html = HtmlService.createTemplateFromFile('FeedbackManager')
    .evaluate()
    .setWidth(680)
    .setHeight(560);

  showDialog_(html, 'Feedback Manager');
}

/**
 * Opens the log viewer (admin-only).
 */
function showLogViewer() {
  enforceAdmin();

  var html = HtmlService.createTemplateFromFile('LogViewer')
    .evaluate()
    .setWidth(650)
    .setHeight(520);

  showDialog_(html, 'Log Viewer');
}

/**
 * Helper to show a modal dialog in either Docs or Sheets.
 * @private
 */
function showDialog_(html, title) {
  try {
    DocumentApp.getUi().showModalDialog(html, title);
  } catch (e) {
    try {
      SpreadsheetApp.getUi().showModalDialog(html, title);
    } catch (e2) {
      Logger.log('Cannot show dialog outside Docs/Sheets');
    }
  }
}

/**
 * Shows access denied message.
 * @private
 */
function showAccessDenied_(reason) {
  var ui;
  try { ui = DocumentApp.getUi(); } catch (e) { ui = SpreadsheetApp.getUi(); }
  ui.alert(
    'Access Denied',
    reason + '\n\nThis app is restricted to invited @salesforce.com users.',
    ui.ButtonSet.OK
  );
}

/**
 * Shows the about dialog.
 */
function showAbout() {
  var ui;
  try { ui = DocumentApp.getUi(); } catch (e) { ui = SpreadsheetApp.getUi(); }
  ui.alert(
    'AnnotationApp',
    'AI-augmented document workspace.\n\n' +
    'The AI doesn\'t write for you — it provokes deeper thinking so you write better.\n\n' +
    'Restricted to @salesforce.com users.\n' +
    'Version 2.0.0',
    ui.ButtonSet.OK
  );
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
