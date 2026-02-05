/**
 * Utils.gs — Shared utilities and cross-dialog communication.
 */

// ============================================================
// Cross-Dialog Communication
// ============================================================

/**
 * Temporary storage for file content loaded from Drive picker.
 * Used to pass data between the picker dialog and the sidebar.
 *
 * @param {Object} fileData - { name, content, mimeType }
 */
function setTempFileContent(fileData) {
  var userProps = PropertiesService.getUserProperties();
  userProps.setProperty('TEMP_FILE_CONTENT', JSON.stringify(fileData));
  userProps.setProperty('TEMP_FILE_TIMESTAMP', String(Date.now()));
}

/**
 * Retrieve and clear temporary file content.
 * Called by sidebar to check if a file was selected from Drive.
 *
 * @return {Object|null}
 */
function getTempFileContent() {
  var userProps = PropertiesService.getUserProperties();
  var content = userProps.getProperty('TEMP_FILE_CONTENT');
  var timestamp = userProps.getProperty('TEMP_FILE_TIMESTAMP');

  if (!content || !timestamp) return null;

  // Only return if recent (within 30 seconds)
  if (Date.now() - parseInt(timestamp, 10) > 30000) {
    userProps.deleteProperty('TEMP_FILE_CONTENT');
    userProps.deleteProperty('TEMP_FILE_TIMESTAMP');
    return null;
  }

  // Clear after reading
  userProps.deleteProperty('TEMP_FILE_CONTENT');
  userProps.deleteProperty('TEMP_FILE_TIMESTAMP');

  try {
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

// ============================================================
// Error Logging
// ============================================================

/**
 * Log an error with context for debugging.
 * Writes to both Logger and a central error log if configured.
 *
 * @param {string} context - Where the error occurred
 * @param {Error|string} error - The error
 * @param {Object} [metadata] - Additional context
 */
function logError(context, error, metadata) {
  var message = typeof error === 'string' ? error : error.message;
  var stack = error.stack || '';

  Logger.log('[ERROR] ' + context + ': ' + message);
  if (stack) Logger.log('Stack: ' + stack);
  if (metadata) Logger.log('Metadata: ' + JSON.stringify(metadata));

  // Could write to a central error log sheet here if needed
}

// ============================================================
// Text Utilities
// ============================================================

/**
 * Truncate text to a maximum length with ellipsis.
 * @param {string} text
 * @param {number} maxLen
 * @return {string}
 */
function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen) + '...';
}

/**
 * Strip markdown formatting from text.
 * @param {string} text
 * @return {string}
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s/g, '')       // Headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/`(.*?)`/g, '$1')       // Code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/^[-*+]\s/gm, '')       // List markers
    .replace(/^\d+\.\s/gm, '');      // Numbered lists
}
