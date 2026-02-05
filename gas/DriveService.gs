/**
 * DriveService.gs — User's Google Drive integration with organized folder structure.
 *
 * Folder structure (per user, in their own Drive):
 *   AnnotationApp/
 *     audio/         — Voice recordings (WebM blobs)
 *     transcripts/   — Cleaned transcripts (text files)
 *     docs/          — Saved document outputs (Google Docs)
 *
 * No user can see another user's files — everything lives in their own Drive.
 */

var APP_FOLDER_NAME = 'AnnotationApp';
var AUDIO_FOLDER = 'audio';
var TRANSCRIPTS_FOLDER = 'transcripts';
var DOCS_FOLDER = 'docs';

// ============================================================
// Folder Management
// ============================================================

/**
 * Get or create the AnnotationApp folder structure in the user's Drive.
 * Returns references to all folders.
 *
 * @return {Object} { root, audio, transcripts, docs }
 */
function getOrCreateAppFolders() {
  var userProps = PropertiesService.getUserProperties();
  var rootId = userProps.getProperty('APP_FOLDER_ID');

  // Try to use cached folder ID
  if (rootId) {
    try {
      var root = DriveApp.getFolderById(rootId);
      root.getName(); // verify accessible
      return resolveSubfolders_(root);
    } catch (e) {
      Logger.log('Cached folder not accessible, recreating: ' + e.message);
    }
  }

  // Search for existing folder
  var folders = DriveApp.getFoldersByName(APP_FOLDER_NAME);
  var root;
  if (folders.hasNext()) {
    root = folders.next();
  } else {
    root = DriveApp.createFolder(APP_FOLDER_NAME);
    root.setDescription('AnnotationApp — AI-augmented document workspace. Auto-created, do not delete.');
  }

  userProps.setProperty('APP_FOLDER_ID', root.getId());
  return resolveSubfolders_(root);
}

/**
 * Resolve or create subfolders inside the root.
 * @private
 */
function resolveSubfolders_(root) {
  return {
    root: root,
    audio: getOrCreateSubfolder_(root, AUDIO_FOLDER),
    transcripts: getOrCreateSubfolder_(root, TRANSCRIPTS_FOLDER),
    docs: getOrCreateSubfolder_(root, DOCS_FOLDER)
  };
}

/**
 * Get or create a subfolder inside a parent.
 * @private
 */
function getOrCreateSubfolder_(parent, name) {
  var subs = parent.getFoldersByName(name);
  if (subs.hasNext()) {
    return subs.next();
  }
  return parent.createFolder(name);
}

// ============================================================
// Audio File Storage
// ============================================================

/**
 * Save an audio recording blob to the user's audio folder.
 * Called from the sidebar after MediaRecorder captures audio.
 *
 * @param {string} base64Data - Base64-encoded audio data
 * @param {string} mimeType - e.g., 'audio/webm'
 * @param {string} [filename] - Optional filename (auto-generated if omitted)
 * @return {Object} { fileId, fileName, url }
 */
function saveAudioFile(base64Data, mimeType, filename) {
  enforceAccess();
  trackUsage('save_audio');
  var folders = getOrCreateAppFolders();

  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType || 'audio/webm');

  if (!filename) {
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    filename = 'recording_' + timestamp + '.webm';
  }
  blob.setName(filename);

  var file = folders.audio.createFile(blob);

  return {
    fileId: file.getId(),
    fileName: file.getName(),
    url: file.getUrl()
  };
}

// ============================================================
// Transcript File Storage
// ============================================================

/**
 * Save a transcript to the user's transcripts folder.
 *
 * @param {string} transcript - The transcript text
 * @param {string} [title] - Optional title for the file
 * @param {Object} [metadata] - Optional metadata (provocationId, etc.)
 * @return {Object} { fileId, fileName, url }
 */
function saveTranscript(transcript, title, metadata) {
  enforceAccess();
  trackUsage('save_transcript');
  var folders = getOrCreateAppFolders();

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  var filename = (title ? sanitizeFilename_(title) + '_' : 'transcript_') + timestamp + '.txt';

  var content = '';
  if (metadata) {
    content += '--- Metadata ---\n';
    content += 'Date: ' + new Date().toISOString() + '\n';
    if (metadata.provocationTitle) content += 'Provocation: ' + metadata.provocationTitle + '\n';
    if (metadata.provocationId) content += 'Provocation ID: ' + metadata.provocationId + '\n';
    if (metadata.documentObjective) content += 'Objective: ' + metadata.documentObjective + '\n';
    content += '--- Transcript ---\n\n';
  }
  content += transcript;

  var file = folders.transcripts.createFile(filename, content, MimeType.PLAIN_TEXT);

  return {
    fileId: file.getId(),
    fileName: file.getName(),
    url: file.getUrl()
  };
}

// ============================================================
// Document File Storage
// ============================================================

/**
 * Save a document to the user's docs folder as a Google Doc.
 *
 * @param {string} text - Document content (markdown)
 * @param {string} title - Document title
 * @param {string} [objective] - Document objective (added as a header comment)
 * @return {Object} { fileId, fileName, url }
 */
function saveDocumentToDrive(text, title, objective) {
  enforceAccess();
  trackUsage('save_to_drive');
  var folders = getOrCreateAppFolders();

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  var docName = (title ? sanitizeFilename_(title) : 'Document') + ' — ' + timestamp;

  var doc = DocumentApp.create(docName);
  var body = doc.getBody();

  // Add objective as a subtitle if present
  if (objective) {
    body.appendParagraph('Objective: ' + objective)
      .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
    body.appendParagraph('');
  }

  // Parse markdown into the doc
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (line.match(/^# /)) {
      body.appendParagraph(line.replace(/^# /, ''))
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    } else if (line.match(/^## /)) {
      body.appendParagraph(line.replace(/^## /, ''))
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    } else if (line.match(/^### /)) {
      body.appendParagraph(line.replace(/^### /, ''))
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
    } else if (line.match(/^- /)) {
      body.appendListItem(line.replace(/^- /, ''))
        .setGlyphType(DocumentApp.GlyphType.BULLET);
    } else if (line.match(/^\d+\. /)) {
      body.appendListItem(line.replace(/^\d+\. /, ''))
        .setGlyphType(DocumentApp.GlyphType.NUMBER);
    } else if (line.trim() !== '') {
      body.appendParagraph(line);
    }
  }

  doc.saveAndClose();

  // Move to the docs folder
  var file = DriveApp.getFileById(doc.getId());
  folders.docs.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  return {
    fileId: doc.getId(),
    fileName: docName,
    url: doc.getUrl()
  };
}

// ============================================================
// File Reading (user's own Drive only)
// ============================================================

/**
 * Read content from a Google Drive file.
 * Only accesses files the running user owns or has access to.
 *
 * @param {string} fileId - Google Drive file ID
 * @return {Object} { name, content, mimeType, size }
 */
function readDriveFile(fileId) {
  enforceAccess();

  var file = DriveApp.getFileById(fileId);
  var mimeType = file.getMimeType();
  var name = file.getName();
  var content = '';

  if (mimeType === MimeType.GOOGLE_DOCS) {
    var doc = DocumentApp.openById(fileId);
    content = doc.getBody().getText();
  } else if (mimeType === MimeType.PLAIN_TEXT || mimeType === 'text/markdown') {
    content = file.getBlob().getDataAsString();
  } else if (mimeType === MimeType.PDF) {
    content = extractPdfText_(file);
  } else if (mimeType === MimeType.MICROSOFT_WORD ||
             mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    content = extractWordText_(file);
  } else {
    throw new Error('Unsupported file type: ' + mimeType + '. Supported: Google Docs, .txt, .md, .pdf, .docx');
  }

  return {
    name: name,
    content: content,
    mimeType: mimeType,
    size: file.getSize()
  };
}

/**
 * Get the text content of the currently open Google Doc.
 * @return {Object} { name, content, documentId }
 */
function getCurrentDocContent() {
  // No enforceAccess here — called speculatively on load, may fail silently
  try {
    var doc = DocumentApp.getActiveDocument();
    if (!doc) throw new Error('No active document');
    return {
      name: doc.getName(),
      content: doc.getBody().getText(),
      documentId: doc.getId()
    };
  } catch (e) {
    throw new Error('Could not read current document: ' + e.message);
  }
}

/**
 * Write evolved text back to the currently open Google Doc.
 * @param {string} text - The new document text
 * @return {Object} { success: boolean }
 */
function updateCurrentDoc(text) {
  enforceAccess();

  try {
    var doc = DocumentApp.getActiveDocument();
    if (!doc) throw new Error('No active document');

    var body = doc.getBody();
    body.clear();

    var paragraphs = text.split('\n');
    for (var i = 0; i < paragraphs.length; i++) {
      var line = paragraphs[i];
      if (line.match(/^# /)) {
        body.appendParagraph(line.replace(/^# /, '')).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else if (line.match(/^## /)) {
        body.appendParagraph(line.replace(/^## /, '')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (line.match(/^### /)) {
        body.appendParagraph(line.replace(/^### /, '')).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      } else if (line.match(/^- /)) {
        body.appendListItem(line.replace(/^- /, '')).setGlyphType(DocumentApp.GlyphType.BULLET);
      } else if (line.match(/^\d+\. /)) {
        body.appendListItem(line.replace(/^\d+\. /, '')).setGlyphType(DocumentApp.GlyphType.NUMBER);
      } else if (line.trim() !== '') {
        body.appendParagraph(line);
      }
    }

    return { success: true };
  } catch (e) {
    throw new Error('Could not update document: ' + e.message);
  }
}

// ============================================================
// File Search (user's own Drive only)
// ============================================================

/**
 * Search user's Drive for text-based documents.
 * @param {string} [query] - Search term (optional)
 * @param {number} [maxResults=20]
 * @return {Object[]}
 */
function searchDriveFiles(query, maxResults) {
  enforceAccess();
  maxResults = maxResults || 20;

  var searchQuery = "(mimeType='application/vnd.google-apps.document'" +
    " or mimeType='text/plain'" +
    " or mimeType='text/markdown'" +
    " or mimeType='application/pdf'" +
    " or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')";

  if (query && query.trim()) {
    searchQuery += " and fullText contains '" + query.replace(/'/g, "\\'") + "'";
  }

  searchQuery += " and trashed = false";

  var files = DriveApp.searchFiles(searchQuery);
  var results = [];

  while (files.hasNext() && results.length < maxResults) {
    var file = files.next();
    results.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      lastUpdated: file.getLastUpdated().toISOString()
    });
  }

  results.sort(function(a, b) {
    return new Date(b.lastUpdated) - new Date(a.lastUpdated);
  });

  return results;
}

// ============================================================
// Private Helpers
// ============================================================

function extractPdfText_(file) {
  try {
    var resource = { title: file.getName() + ' (temp)', mimeType: MimeType.GOOGLE_DOCS };
    var blob = file.getBlob();
    var tempFile = Drive.Files.insert(resource, blob, { ocr: true, convert: true });
    var tempDoc = DocumentApp.openById(tempFile.id);
    var text = tempDoc.getBody().getText();
    DriveApp.getFileById(tempFile.id).setTrashed(true);
    return text;
  } catch (e) {
    Logger.log('PDF extraction failed: ' + e.message);
    return '(Could not extract text from PDF: ' + e.message + ')';
  }
}

function extractWordText_(file) {
  try {
    var resource = { title: file.getName() + ' (temp)', mimeType: MimeType.GOOGLE_DOCS };
    var blob = file.getBlob();
    var tempFile = Drive.Files.insert(resource, blob, { convert: true });
    var tempDoc = DocumentApp.openById(tempFile.id);
    var text = tempDoc.getBody().getText();
    DriveApp.getFileById(tempFile.id).setTrashed(true);
    return text;
  } catch (e) {
    Logger.log('Word extraction failed: ' + e.message);
    return '(Could not extract text from Word doc: ' + e.message + ')';
  }
}

function sanitizeFilename_(name) {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 50).trim();
}

// Namespace
var DriveService = {
  getOrCreateAppFolders: getOrCreateAppFolders,
  saveAudioFile: saveAudioFile,
  saveTranscript: saveTranscript,
  saveDocumentToDrive: saveDocumentToDrive,
  readDriveFile: readDriveFile,
  getCurrentDocContent: getCurrentDocContent,
  updateCurrentDoc: updateCurrentDoc,
  searchDriveFiles: searchDriveFiles
};
