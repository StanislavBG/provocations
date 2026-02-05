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

  ui.createMenu('AnnotationApp')
    .addItem('Open Workspace', 'showSidebar')
    .addItem('Import from Drive', 'showDrivePicker')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addItem('Admin Panel', 'showAdminPanel')
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
  enforceAccess();

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
    vertexLocation: config.vertexLocation || null
  };
}
