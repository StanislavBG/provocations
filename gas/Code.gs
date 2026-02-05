/**
 * Provocations - Google Apps Script Edition
 *
 * AI-augmented document workspace where users iteratively shape ideas
 * into polished documents through thought-provoking AI interactions.
 *
 * Entry point: menu setup, sidebar launch, initialization.
 */

// ============================================================
// Menu & Sidebar
// ============================================================

/**
 * Runs when the document/spreadsheet is opened.
 * Adds the Provocations menu to the UI.
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

  ui.createMenu('Provocations')
    .addItem('Open Workspace', 'showSidebar')
    .addItem('Import from Drive', 'showDrivePicker')
    .addSeparator()
    .addItem('Settings', 'showSettings')
    .addItem('About', 'showAbout')
    .addToUi();
}

/**
 * Google Docs add-on homepage trigger.
 */
function onDocsHomepage(e) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Provocations'))
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
 * Opens the main Provocations sidebar.
 */
function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('Provocations')
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
  var html = HtmlService.createTemplateFromFile('Settings')
    .evaluate()
    .setWidth(450)
    .setHeight(350);

  try {
    DocumentApp.getUi().showModalDialog(html, 'Provocations Settings');
  } catch (e) {
    SpreadsheetApp.getUi().showModalDialog(html, 'Provocations Settings');
  }
}

/**
 * Shows the about dialog.
 */
function showAbout() {
  var ui;
  try { ui = DocumentApp.getUi(); } catch (e) { ui = SpreadsheetApp.getUi(); }
  ui.alert(
    'Provocations',
    'AI-augmented document workspace.\n\n' +
    'The AI doesn\'t write for you — it provokes deeper thinking so you write better.\n\n' +
    'Version 1.0.0',
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
 * First-run setup: creates the user's storage sheet if it doesn't exist.
 */
function initialize() {
  var sheet = StorageService.getOrCreateStorageSheet();
  var config = getConfig();
  return {
    ready: true,
    hasApiKey: !!config.geminiApiKey,
    userEmail: Session.getActiveUser().getEmail(),
    storageSheetId: sheet.getId()
  };
}

/**
 * Get current configuration state (no secrets exposed to client).
 */
function getConfigState() {
  var config = getConfig();
  return {
    hasApiKey: !!config.geminiApiKey,
    model: config.model,
    useVertexAi: config.useVertexAi,
    vertexProject: config.vertexProject ? '(configured)' : null,
    vertexLocation: config.vertexLocation || null
  };
}
