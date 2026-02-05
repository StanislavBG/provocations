/**
 * StorageService.gs — Per-user data storage in Google Sheets.
 *
 * Each user gets an "AnnotationApp Data" spreadsheet in their Drive.
 * Replaces the in-memory storage from server/storage.ts.
 *
 * Sheet structure:
 *   "Documents"  — id, text, objective, createdAt, updatedAt
 *   "Versions"   — id, documentId, text, description, timestamp
 *   "Analysis"   — id, documentId, lensesJson, provocationsJson, timestamp
 *   "EditHistory" — id, documentId, instruction, instructionType, summary, timestamp
 */

var STORAGE_SHEET_NAME = 'AnnotationApp Data';
var SHEET_DOCUMENTS = 'Documents';
var SHEET_VERSIONS = 'Versions';
var SHEET_ANALYSIS = 'Analysis';
var SHEET_EDIT_HISTORY = 'EditHistory';

// ============================================================
// Sheet Management
// ============================================================

/**
 * Get or create the user's storage spreadsheet.
 * Stores the spreadsheet ID in user properties for fast lookup.
 *
 * @return {Spreadsheet}
 */
function getOrCreateStorageSheet() {
  var userProps = PropertiesService.getUserProperties();
  var sheetId = userProps.getProperty('STORAGE_SHEET_ID');

  // Try to open existing sheet
  if (sheetId) {
    try {
      var ss = SpreadsheetApp.openById(sheetId);
      // Verify it still exists and is accessible
      ss.getName();
      return ss;
    } catch (e) {
      Logger.log('Stored sheet not accessible, creating new one: ' + e.message);
    }
  }

  // Create new spreadsheet
  var ss = SpreadsheetApp.create(STORAGE_SHEET_NAME);

  // Set up sheets with headers
  var docSheet = ss.getSheetByName('Sheet1');
  docSheet.setName(SHEET_DOCUMENTS);
  docSheet.getRange('A1:E1').setValues([['id', 'text', 'objective', 'createdAt', 'updatedAt']]);
  docSheet.setFrozenRows(1);

  var versionsSheet = ss.insertSheet(SHEET_VERSIONS);
  versionsSheet.getRange('A1:E1').setValues([['id', 'documentId', 'text', 'description', 'timestamp']]);
  versionsSheet.setFrozenRows(1);

  var analysisSheet = ss.insertSheet(SHEET_ANALYSIS);
  analysisSheet.getRange('A1:E1').setValues([['id', 'documentId', 'lensesJson', 'provocationsJson', 'timestamp']]);
  analysisSheet.setFrozenRows(1);

  var historySheet = ss.insertSheet(SHEET_EDIT_HISTORY);
  historySheet.getRange('A1:F1').setValues([['id', 'documentId', 'instruction', 'instructionType', 'summary', 'timestamp']]);
  historySheet.setFrozenRows(1);

  // Store sheet ID for future access
  userProps.setProperty('STORAGE_SHEET_ID', ss.getId());

  return ss;
}

/**
 * Get a specific sheet tab, creating it if necessary.
 * @private
 */
function getSheet_(name) {
  var ss = getOrCreateStorageSheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ============================================================
// Document Storage
// ============================================================

/**
 * Save a new document.
 * @param {string} text - Document content
 * @param {string} [objective] - Document objective
 * @return {string} Document ID
 */
function saveDocument(text, objective) {
  var sheet = getSheet_(SHEET_DOCUMENTS);
  var id = generateId('doc');
  var now = new Date().toISOString();

  sheet.appendRow([id, text, objective || '', now, now]);

  // Also save initial version
  saveVersion(text, 'Initial document');

  return id;
}

/**
 * Update an existing document's text.
 * @param {string} docId - Document ID
 * @param {string} text - New text
 */
function updateDocument(docId, text) {
  var sheet = getSheet_(SHEET_DOCUMENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === docId) {
      sheet.getRange(i + 1, 2).setValue(text);
      sheet.getRange(i + 1, 5).setValue(new Date().toISOString());
      return;
    }
  }

  Logger.log('Document not found: ' + docId);
}

/**
 * Get a document by ID.
 * @param {string} docId
 * @return {Object|null}
 */
function getDocument(docId) {
  var sheet = getSheet_(SHEET_DOCUMENTS);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === docId) {
      return {
        id: data[i][0],
        text: data[i][1],
        objective: data[i][2],
        createdAt: data[i][3],
        updatedAt: data[i][4]
      };
    }
  }

  return null;
}

/**
 * Get all documents (most recent first).
 * @param {number} [limit=20]
 * @return {Object[]}
 */
function listDocuments(limit) {
  limit = limit || 20;
  var sheet = getSheet_(SHEET_DOCUMENTS);
  var data = sheet.getDataRange().getValues();

  var docs = [];
  for (var i = 1; i < data.length; i++) {
    docs.push({
      id: data[i][0],
      text: data[i][1].substring(0, 200) + (data[i][1].length > 200 ? '...' : ''),
      objective: data[i][2],
      createdAt: data[i][3],
      updatedAt: data[i][4]
    });
  }

  // Sort by createdAt descending
  docs.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return docs.slice(0, limit);
}

// ============================================================
// Version Storage
// ============================================================

/**
 * Save a document version.
 * @param {string} text - Version text
 * @param {string} description - What changed
 * @return {string} Version ID
 */
function saveVersion(text, description) {
  var sheet = getSheet_(SHEET_VERSIONS);
  var id = generateId('v');
  var now = Date.now();

  // Get current document ID from user properties (set during analysis)
  var currentDocId = PropertiesService.getUserProperties().getProperty('CURRENT_DOC_ID') || '';

  sheet.appendRow([id, currentDocId, text, description, now]);

  return id;
}

/**
 * Get all versions for a document.
 * @param {string} docId
 * @return {Object[]}
 */
function getVersions(docId) {
  var sheet = getSheet_(SHEET_VERSIONS);
  var data = sheet.getDataRange().getValues();

  var versions = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === docId) {
      versions.push({
        id: data[i][0],
        documentId: data[i][1],
        text: data[i][2],
        description: data[i][3],
        timestamp: data[i][4]
      });
    }
  }

  return versions;
}

// ============================================================
// Analysis Storage
// ============================================================

/**
 * Save analysis results (lenses + provocations).
 * @param {string} docId
 * @param {Object[]} lenses
 * @param {Object[]} provocations
 */
function saveAnalysis(docId, lenses, provocations) {
  var sheet = getSheet_(SHEET_ANALYSIS);
  var id = generateId('analysis');

  sheet.appendRow([
    id,
    docId,
    JSON.stringify(lenses),
    JSON.stringify(provocations),
    Date.now()
  ]);

  // Store current doc ID for version tracking
  PropertiesService.getUserProperties().setProperty('CURRENT_DOC_ID', docId);
}

/**
 * Get latest analysis for a document.
 * @param {string} docId
 * @return {Object|null}
 */
function getLatestAnalysis(docId) {
  var sheet = getSheet_(SHEET_ANALYSIS);
  var data = sheet.getDataRange().getValues();

  var latest = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === docId) {
      latest = {
        id: data[i][0],
        documentId: data[i][1],
        lenses: JSON.parse(data[i][2] || '[]'),
        provocations: JSON.parse(data[i][3] || '[]'),
        timestamp: data[i][4]
      };
    }
  }

  return latest;
}

// ============================================================
// Edit History Storage
// ============================================================

/**
 * Save an edit history entry.
 * @param {string} docId
 * @param {Object} entry - { instruction, instructionType, summary }
 */
function saveEditHistory(docId, entry) {
  var sheet = getSheet_(SHEET_EDIT_HISTORY);

  sheet.appendRow([
    generateId('edit'),
    docId,
    entry.instruction,
    entry.instructionType,
    entry.summary,
    Date.now()
  ]);
}

/**
 * Get edit history for a document (most recent N entries).
 * @param {string} docId
 * @param {number} [limit=10]
 * @return {Object[]}
 */
function getEditHistory(docId, limit) {
  limit = limit || 10;
  var sheet = getSheet_(SHEET_EDIT_HISTORY);
  var data = sheet.getDataRange().getValues();

  var history = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === docId) {
      history.push({
        instruction: data[i][2],
        instructionType: data[i][3],
        summary: data[i][4],
        timestamp: data[i][5]
      });
    }
  }

  // Return most recent entries
  return history.slice(-limit);
}

// ============================================================
// Namespace for external calls
// ============================================================

var StorageService = {
  getOrCreateStorageSheet: getOrCreateStorageSheet,
  saveDocument: saveDocument,
  updateDocument: updateDocument,
  getDocument: getDocument,
  listDocuments: listDocuments,
  saveVersion: saveVersion,
  getVersions: getVersions,
  saveAnalysis: saveAnalysis,
  getLatestAnalysis: getLatestAnalysis,
  saveEditHistory: saveEditHistory,
  getEditHistory: getEditHistory
};
