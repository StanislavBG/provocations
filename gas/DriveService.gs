/**
 * DriveService.gs — Read documents from user's Google Drive.
 *
 * Supports Google Docs, plain text, and PDF files.
 * New capability not in the original app — leverages Workspace integration.
 */

// ============================================================
// File Reading
// ============================================================

/**
 * Read content from a Google Drive file.
 *
 * @param {string} fileId - Google Drive file ID
 * @return {Object} { name, content, mimeType, size }
 */
function readDriveFile(fileId) {
  var file = DriveApp.getFileById(fileId);
  var mimeType = file.getMimeType();
  var name = file.getName();
  var content = '';

  if (mimeType === MimeType.GOOGLE_DOCS) {
    // Google Docs — extract as plain text
    var doc = DocumentApp.openById(fileId);
    content = doc.getBody().getText();
  } else if (mimeType === MimeType.PLAIN_TEXT || mimeType === 'text/markdown') {
    // Plain text / markdown
    content = file.getBlob().getDataAsString();
  } else if (mimeType === MimeType.PDF) {
    // PDF — extract text via Drive API export
    // Note: This gets raw text; formatting is lost
    content = extractPdfText_(file);
  } else if (mimeType === MimeType.MICROSOFT_WORD ||
             mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // Word docs — convert to Google Docs first, then extract
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
 *
 * @return {Object} { name, content, documentId }
 */
function getCurrentDocContent() {
  try {
    var doc = DocumentApp.getActiveDocument();
    if (!doc) {
      throw new Error('No active document');
    }

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
 *
 * @param {string} text - The new document text
 * @return {Object} { success: boolean }
 */
function updateCurrentDoc(text) {
  try {
    var doc = DocumentApp.getActiveDocument();
    if (!doc) {
      throw new Error('No active document');
    }

    var body = doc.getBody();
    body.clear();

    // Split text into paragraphs and add them
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
// File Search
// ============================================================

/**
 * Search user's Drive for text-based documents.
 *
 * @param {string} [query] - Search term (optional)
 * @param {number} [maxResults=20] - Maximum results
 * @return {Object[]} Array of { id, name, mimeType, lastUpdated }
 */
function searchDriveFiles(query, maxResults) {
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

  // Sort by most recently updated
  results.sort(function(a, b) {
    return new Date(b.lastUpdated) - new Date(a.lastUpdated);
  });

  return results;
}

// ============================================================
// Private Helpers
// ============================================================

/**
 * Extract text from a PDF file.
 * Uses OCR via Google Drive's built-in conversion.
 * @private
 */
function extractPdfText_(file) {
  try {
    // Create a temporary Google Doc from the PDF (Drive does OCR)
    var resource = {
      title: file.getName() + ' (temp conversion)',
      mimeType: MimeType.GOOGLE_DOCS
    };

    var blob = file.getBlob();
    var tempFile = Drive.Files.insert(resource, blob, { ocr: true, convert: true });
    var tempDoc = DocumentApp.openById(tempFile.id);
    var text = tempDoc.getBody().getText();

    // Clean up temporary file
    DriveApp.getFileById(tempFile.id).setTrashed(true);

    return text;
  } catch (e) {
    Logger.log('PDF extraction failed: ' + e.message);
    return '(Could not extract text from PDF: ' + e.message + ')';
  }
}

/**
 * Extract text from a Word document.
 * Converts to Google Docs format first.
 * @private
 */
function extractWordText_(file) {
  try {
    var resource = {
      title: file.getName() + ' (temp conversion)',
      mimeType: MimeType.GOOGLE_DOCS
    };

    var blob = file.getBlob();
    var tempFile = Drive.Files.insert(resource, blob, { convert: true });
    var tempDoc = DocumentApp.openById(tempFile.id);
    var text = tempDoc.getBody().getText();

    // Clean up
    DriveApp.getFileById(tempFile.id).setTrashed(true);

    return text;
  } catch (e) {
    Logger.log('Word extraction failed: ' + e.message);
    return '(Could not extract text from Word doc: ' + e.message + ')';
  }
}
