/**
 * FeedbackService.gs — User feedback collection and admin management.
 *
 * Users can submit feedback (bugs, feature requests, general comments).
 * Admin can search, filter, update status/type, add comments, and
 * email the user with a response.
 *
 * Feedback is stored in the "Feedback" tab of the admin config sheet.
 */

var SHEET_FEEDBACK = 'Feedback';

var FEEDBACK_TYPES = ['bug', 'feature_request', 'improvement', 'question', 'general'];
var FEEDBACK_STATUSES = ['new', 'in_progress', 'backlog', 'fixed', 'closed', 'wont_fix'];

// ============================================================
// User-Facing
// ============================================================

/**
 * Submit feedback from a user.
 *
 * @param {Object} data
 * @param {string} data.type - bug, feature_request, improvement, question, general
 * @param {string} data.title - Short summary
 * @param {string} data.body - Detailed description
 * @return {Object} { success, feedbackId, message }
 */
function submitFeedback(data) {
  enforceAccess();

  if (!data || !data.title || !data.body) {
    return { success: false, message: 'Title and description are required.' };
  }

  var type = FEEDBACK_TYPES.indexOf(data.type) !== -1 ? data.type : 'general';
  var email = Session.getActiveUser().getEmail();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) throw new Error('Admin sheet not configured. Contact your administrator.');

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet) throw new Error('Feedback tab not found. Run Setup first.');

  var id = 'fb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  var now = new Date().toISOString();

  sheet.appendRow([
    id,
    now,
    email,
    type,
    data.title.substring(0, 200),
    data.body.substring(0, 5000),
    'new',     // status
    '',        // adminComments
    '',        // updatedAt
    ''         // updatedBy
  ]);

  trackUsage('feedback_submit');

  return {
    success: true,
    feedbackId: id,
    message: 'Thank you! Your feedback has been submitted.'
  };
}

/**
 * Get the current user's own feedback history.
 * @return {Object[]}
 */
function getMyFeedback() {
  enforceAccess();
  var email = Session.getActiveUser().getEmail().toLowerCase();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return [];

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var data = sheet.getDataRange().getValues();
  var items = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString().toLowerCase() === email) {
      items.push({
        id: data[i][0],
        timestamp: data[i][1],
        type: data[i][3],
        title: data[i][4],
        body: data[i][5],
        status: data[i][6],
        adminComments: data[i][7] || '',
        updatedAt: data[i][8] || ''
      });
    }
  }

  return items.reverse();
}

// ============================================================
// Admin Feedback Management
// ============================================================

/**
 * List all feedback with optional filtering. Admin-only.
 *
 * @param {Object} [filters]
 * @param {string} [filters.type] - Filter by type
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.search] - Search in title/body
 * @param {number} [filters.limit] - Max results (default 100)
 * @param {number} [filters.offset] - Skip first N results
 * @return {Object} { items[], totalCount }
 */
function listAllFeedback(filters) {
  enforceAdmin();
  filters = filters || {};

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return { items: [], totalCount: 0 };

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet || sheet.getLastRow() <= 1) return { items: [], totalCount: 0 };

  var data = sheet.getDataRange().getValues();
  var items = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;

    // Apply filters
    if (filters.type && data[i][3] !== filters.type) continue;
    if (filters.status && data[i][6] !== filters.status) continue;
    if (filters.search) {
      var searchLower = filters.search.toLowerCase();
      var titleLower = (data[i][4] || '').toLowerCase();
      var bodyLower = (data[i][5] || '').toLowerCase();
      if (titleLower.indexOf(searchLower) === -1 && bodyLower.indexOf(searchLower) === -1) continue;
    }

    items.push({
      id: data[i][0],
      timestamp: data[i][1],
      userEmail: data[i][2],
      type: data[i][3],
      title: data[i][4],
      body: data[i][5],
      status: data[i][6],
      adminComments: data[i][7] || '',
      updatedAt: data[i][8] || '',
      updatedBy: data[i][9] || ''
    });
  }

  // Sort by timestamp descending (newest first)
  items.reverse();

  var totalCount = items.length;
  var offset = parseInt(filters.offset, 10) || 0;
  var limit = parseInt(filters.limit, 10) || 100;
  items = items.slice(offset, offset + limit);

  return { items: items, totalCount: totalCount };
}

/**
 * Update a feedback item (type, status, admin comments). Admin-only.
 *
 * @param {string} feedbackId
 * @param {Object} updates
 * @param {string} [updates.type]
 * @param {string} [updates.status]
 * @param {string} [updates.adminComments]
 * @return {Object} { success, message }
 */
function updateFeedback(feedbackId, updates) {
  enforceAdmin();
  updates = updates || {};

  var adminSheet = getAdminSheet_();
  if (!adminSheet) throw new Error('Admin sheet not configured.');

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet) throw new Error('Feedback tab not found.');

  var data = sheet.getDataRange().getValues();
  var adminEmail = Session.getActiveUser().getEmail();
  var now = new Date().toISOString();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === feedbackId) {
      if (updates.type && FEEDBACK_TYPES.indexOf(updates.type) !== -1) {
        sheet.getRange(i + 1, 4).setValue(updates.type);
      }
      if (updates.status && FEEDBACK_STATUSES.indexOf(updates.status) !== -1) {
        sheet.getRange(i + 1, 7).setValue(updates.status);
      }
      if (typeof updates.adminComments === 'string') {
        sheet.getRange(i + 1, 8).setValue(updates.adminComments.substring(0, 5000));
      }
      sheet.getRange(i + 1, 9).setValue(now);
      sheet.getRange(i + 1, 10).setValue(adminEmail);

      return { success: true, message: 'Feedback updated.' };
    }
  }

  return { success: false, message: 'Feedback item not found.' };
}

/**
 * Send an email response to the feedback submitter. Admin-only.
 *
 * @param {string} feedbackId
 * @param {string} responseMessage - Message to send to the user
 * @return {Object} { success, message }
 */
function sendFeedbackResponse(feedbackId, responseMessage) {
  enforceAdmin();

  if (!responseMessage || !responseMessage.trim()) {
    return { success: false, message: 'Response message is required.' };
  }

  var adminSheet = getAdminSheet_();
  if (!adminSheet) throw new Error('Admin sheet not configured.');

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet) throw new Error('Feedback tab not found.');

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === feedbackId) {
      var userEmail = data[i][2];
      var feedbackTitle = data[i][4];
      var feedbackBody = data[i][5];
      var feedbackType = data[i][3];
      var currentStatus = data[i][6];

      var subject = 'AnnotationApp Feedback Update: ' + feedbackTitle;
      var body =
        'Hi,\n\n' +
        'Thank you for your feedback on AnnotationApp. Here is an update regarding your submission:\n\n' +
        '--- Your Original Feedback ---\n' +
        'Type: ' + feedbackType + '\n' +
        'Title: ' + feedbackTitle + '\n' +
        'Details: ' + feedbackBody + '\n\n' +
        '--- Admin Response ---\n' +
        responseMessage.trim() + '\n\n' +
        'Current Status: ' + currentStatus + '\n\n' +
        'Best regards,\n' +
        'AnnotationApp Team';

      try {
        MailApp.sendEmail(userEmail, subject, body);

        // Append to admin comments
        var existingComments = data[i][7] || '';
        var newComment = '[' + new Date().toISOString() + ' — emailed] ' + responseMessage.trim();
        var combined = existingComments ? existingComments + '\n\n' + newComment : newComment;
        sheet.getRange(i + 1, 8).setValue(combined.substring(0, 5000));
        sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 10).setValue(Session.getActiveUser().getEmail());

        return { success: true, message: 'Response emailed to ' + userEmail };
      } catch (e) {
        return { success: false, message: 'Email failed: ' + e.message };
      }
    }
  }

  return { success: false, message: 'Feedback item not found.' };
}

/**
 * Get feedback stats for admin dashboard. Admin-only.
 * @return {Object}
 */
function getFeedbackStats() {
  enforceAdmin();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return { total: 0, byStatus: {}, byType: {} };

  var sheet = adminSheet.getSheetByName(SHEET_FEEDBACK);
  if (!sheet || sheet.getLastRow() <= 1) return { total: 0, byStatus: {}, byType: {} };

  var data = sheet.getDataRange().getValues();
  var total = 0;
  var byStatus = {};
  var byType = {};

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    total++;
    var status = data[i][6] || 'new';
    var type = data[i][3] || 'general';
    byStatus[status] = (byStatus[status] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  return { total: total, byStatus: byStatus, byType: byType };
}
