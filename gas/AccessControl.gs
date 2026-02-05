/**
 * AccessControl.gs — Domain restriction, invite system, and admin controls.
 *
 * Security model:
 *   - Only @salesforce.com domain emails can use the app
 *   - Admin maintains a shared "AnnotationApp Admin" config sheet
 *   - Users must be explicitly invited via hashed invite tokens
 *   - Each user's data lives exclusively in their own Drive
 */

var ALLOWED_DOMAIN = 'salesforce.com';
var ADMIN_SHEET_NAME = 'AnnotationApp Admin';
var SHEET_INVITED_USERS = 'InvitedUsers';
var SHEET_APP_CONFIG = 'AppConfig';
var SHEET_ERROR_LOG = 'ErrorLog';
var SHEET_ACCESS_LOG = 'AccessLog';

// ============================================================
// Domain & Access Checks
// ============================================================

/**
 * Validate the current user has access. Called on every entry point.
 * Checks: 1) @salesforce.com domain, 2) on the invite list.
 *
 * @return {Object} { authorized, email, reason }
 */
function checkAccess() {
  var email = Session.getActiveUser().getEmail().toLowerCase();

  // 1. Domain check
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
    logAccessAttempt_(email, false, 'domain_rejected');
    return {
      authorized: false,
      email: email,
      reason: 'Access restricted to @' + ALLOWED_DOMAIN + ' accounts.'
    };
  }

  // 2. Invite list check
  var adminSheet = getAdminSheet_();
  if (!adminSheet) {
    // If no admin sheet exists yet, allow (first-run bootstrapping)
    // The deployer should run setupAdmin() to create it
    return { authorized: true, email: email, reason: 'ok' };
  }

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  if (!usersSheet) {
    return { authorized: true, email: email, reason: 'ok' };
  }

  var data = usersSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email) {
      var status = data[i][2]; // active, revoked
      if (status === 'revoked') {
        logAccessAttempt_(email, false, 'access_revoked');
        return {
          authorized: false,
          email: email,
          reason: 'Your access has been revoked. Contact the administrator.'
        };
      }

      // Update last access time
      usersSheet.getRange(i + 1, 4).setValue(new Date().toISOString());
      logAccessAttempt_(email, true, 'authorized');
      return { authorized: true, email: email, reason: 'ok' };
    }
  }

  logAccessAttempt_(email, false, 'not_invited');
  return {
    authorized: false,
    email: email,
    reason: 'You have not been invited to use this app. Contact the administrator for access.'
  };
}

/**
 * Enforce access. Throws if unauthorized.
 * Call this at the top of any server function that handles user data.
 */
function enforceAccess() {
  var result = checkAccess();
  if (!result.authorized) {
    throw new Error(result.reason);
  }
  return result;
}

// ============================================================
// Admin Sheet Management
// ============================================================

/**
 * One-time setup: create the admin config sheet.
 * Run this manually as the deployer/admin.
 * The sheet is created in the admin's Drive and the ID stored in Script Properties.
 */
function setupAdmin() {
  var email = Session.getActiveUser().getEmail().toLowerCase();
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
    throw new Error('Admin must be a @' + ALLOWED_DOMAIN + ' user.');
  }

  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('ADMIN_SHEET_ID');

  if (existingId) {
    try {
      var existing = SpreadsheetApp.openById(existingId);
      existing.getName();
      Logger.log('Admin sheet already exists: ' + existingId);
      return { sheetId: existingId, url: existing.getUrl() };
    } catch (e) {
      Logger.log('Existing admin sheet not accessible, creating new one.');
    }
  }

  var ss = SpreadsheetApp.create(ADMIN_SHEET_NAME);

  // InvitedUsers sheet: email, inviteToken, status, lastAccess, invitedBy, invitedAt
  var usersSheet = ss.getSheetByName('Sheet1');
  usersSheet.setName(SHEET_INVITED_USERS);
  usersSheet.getRange('A1:F1').setValues([[
    'email', 'inviteToken', 'status', 'lastAccess', 'invitedBy', 'invitedAt'
  ]]);
  usersSheet.setFrozenRows(1);

  // Add the admin themselves as the first invited user
  usersSheet.appendRow([
    email, generateInviteToken_(email), 'active', new Date().toISOString(), email, new Date().toISOString()
  ]);

  // AppConfig sheet: key, value
  var configSheet = ss.insertSheet(SHEET_APP_CONFIG);
  configSheet.getRange('A1:B1').setValues([['key', 'value']]);
  configSheet.setFrozenRows(1);
  configSheet.appendRow(['admin_email', email]);
  configSheet.appendRow(['allowed_domain', ALLOWED_DOMAIN]);
  configSheet.appendRow(['app_name', 'AnnotationApp']);
  configSheet.appendRow(['created_at', new Date().toISOString()]);

  // ErrorLog sheet: timestamp, email, context, message
  var errorSheet = ss.insertSheet(SHEET_ERROR_LOG);
  errorSheet.getRange('A1:D1').setValues([['timestamp', 'email', 'context', 'message']]);
  errorSheet.setFrozenRows(1);

  // AccessLog sheet: timestamp, email, authorized, reason
  var accessSheet = ss.insertSheet(SHEET_ACCESS_LOG);
  accessSheet.getRange('A1:D1').setValues([['timestamp', 'email', 'authorized', 'reason']]);
  accessSheet.setFrozenRows(1);

  // Store sheet ID in script properties
  props.setProperty('ADMIN_SHEET_ID', ss.getId());

  return { sheetId: ss.getId(), url: ss.getUrl() };
}

/**
 * Get the admin config sheet. Returns null if not yet set up.
 * @private
 */
function getAdminSheet_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID');
  if (!sheetId) return null;

  try {
    return SpreadsheetApp.openById(sheetId);
  } catch (e) {
    Logger.log('Cannot access admin sheet: ' + e.message);
    return null;
  }
}

// ============================================================
// Invite System
// ============================================================

/**
 * Generate an invite link for a user.
 * Admin-only function.
 *
 * @param {string} targetEmail - The email to invite
 * @return {Object} { success, inviteToken, message }
 */
function inviteUser(targetEmail) {
  enforceAdmin();
  var access = enforceAccess();
  targetEmail = targetEmail.trim().toLowerCase();

  // Validate email domain
  if (!targetEmail.endsWith('@' + ALLOWED_DOMAIN)) {
    return {
      success: false,
      message: 'Can only invite @' + ALLOWED_DOMAIN + ' users.'
    };
  }

  var adminSheet = getAdminSheet_();
  if (!adminSheet) {
    throw new Error('Admin sheet not configured. Run Setup first.');
  }

  // Check if already invited
  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  var userData = usersSheet.getDataRange().getValues();
  for (var j = 1; j < userData.length; j++) {
    if (userData[j][0] && userData[j][0].toString().toLowerCase() === targetEmail) {
      if (userData[j][2] === 'revoked') {
        // Reactivate
        usersSheet.getRange(j + 1, 3).setValue('active');
        usersSheet.getRange(j + 1, 6).setValue(new Date().toISOString());
        return {
          success: true,
          inviteToken: userData[j][1],
          message: 'Reactivated existing invite for ' + targetEmail
        };
      }
      return {
        success: true,
        inviteToken: userData[j][1],
        message: targetEmail + ' is already invited.'
      };
    }
  }

  // Create invite — default role is 'user'
  var token = generateInviteToken_(targetEmail);
  usersSheet.appendRow([
    targetEmail,
    token,
    'active',
    '',
    access.email,
    new Date().toISOString(),
    'user'
  ]);

  return {
    success: true,
    inviteToken: token,
    message: 'Invited ' + targetEmail + ' successfully.'
  };
}

/**
 * Bulk invite: add multiple users at once.
 * @param {string[]} emails
 * @return {Object[]} Array of invite results
 */
function inviteUsers(emails) {
  return emails.map(function(email) {
    return inviteUser(email);
  });
}

/**
 * Revoke a user's access.
 * @param {string} targetEmail
 * @return {Object} { success, message }
 */
function revokeUser(targetEmail) {
  enforceAdmin();
  targetEmail = targetEmail.trim().toLowerCase();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) throw new Error('Admin sheet not configured.');

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  var data = usersSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === targetEmail) {
      usersSheet.getRange(i + 1, 3).setValue('revoked');
      return { success: true, message: 'Revoked access for ' + targetEmail };
    }
  }

  return { success: false, message: 'User not found: ' + targetEmail };
}

/**
 * List all invited users. Admin only.
 * @return {Object[]}
 */
function listInvitedUsers() {
  enforceAdmin();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return [];

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  if (!usersSheet) return [];

  var data = usersSheet.getDataRange().getValues();
  var headers = data[0];
  var roleIdx = headers.indexOf('role');
  var users = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      users.push({
        email: data[i][0],
        status: data[i][2] || 'active',
        lastAccess: data[i][3] || 'never',
        invitedBy: data[i][4] || '',
        invitedAt: data[i][5] || '',
        role: roleIdx !== -1 ? (data[i][roleIdx] || 'user') : 'user'
      });
    }
  }

  return users;
}

// ============================================================
// Token Generation
// ============================================================

/**
 * Generate a hashed invite token tied to an email.
 * Uses SHA-256 via Utilities.computeDigest.
 * @private
 */
function generateInviteToken_(email) {
  var salt = PropertiesService.getScriptProperties().getProperty('INVITE_SALT');
  if (!salt) {
    // Generate a random salt on first use
    salt = Utilities.getUuid() + '-' + Date.now();
    PropertiesService.getScriptProperties().setProperty('INVITE_SALT', salt);
  }

  var input = email.toLowerCase() + ':' + salt + ':' + Date.now();
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);

  // Convert byte array to hex string
  return hash.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Validate an invite token for an email.
 * Since tokens are stored alongside emails, we just verify the pair exists.
 *
 * @param {string} email
 * @param {string} token
 * @return {boolean}
 */
function validateInviteToken(email, token) {
  var adminSheet = getAdminSheet_();
  if (!adminSheet) return false;

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  if (!usersSheet) return false;

  var data = usersSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase() &&
        data[i][1] === token && data[i][2] === 'active') {
      return true;
    }
  }

  return false;
}

// ============================================================
// Role-Based Permissions
// ============================================================

/**
 * Check if the current user has the admin role.
 * Admins are marked with role='admin' in the InvitedUsers sheet.
 *
 * @return {boolean}
 */
function isAdmin() {
  var email = Session.getActiveUser().getEmail().toLowerCase();
  var adminSheet = getAdminSheet_();
  if (!adminSheet) return false;

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  if (!usersSheet) return false;

  var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
  var roleIdx = headers.indexOf('role');
  if (roleIdx === -1) return false;

  var data = usersSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email) {
      return data[i][roleIdx] === 'admin';
    }
  }
  return false;
}

/**
 * Enforce admin-only access. Throws if the current user is not an admin.
 */
function enforceAdmin() {
  enforceAccess();
  if (!isAdmin()) {
    throw new Error('This action requires administrator privileges.');
  }
}

/**
 * Get the current user's role.
 * @return {string} 'admin' or 'user'
 */
function getUserRole() {
  return isAdmin() ? 'admin' : 'user';
}

/**
 * Set a user's role.  Admin-only.
 * @param {string} targetEmail
 * @param {string} role - 'admin' or 'user'
 * @return {Object} { success, message }
 */
function setUserRole(targetEmail, role) {
  enforceAdmin();
  targetEmail = targetEmail.trim().toLowerCase();

  if (role !== 'admin' && role !== 'user') {
    return { success: false, message: 'Role must be "admin" or "user".' };
  }

  var adminSheet = getAdminSheet_();
  if (!adminSheet) throw new Error('Admin sheet not configured.');

  var usersSheet = adminSheet.getSheetByName(SHEET_INVITED_USERS);
  var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
  var roleIdx = headers.indexOf('role');
  if (roleIdx === -1) throw new Error('Role column missing. Run Setup first.');

  var data = usersSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === targetEmail) {
      usersSheet.getRange(i + 1, roleIdx + 1).setValue(role);
      return { success: true, message: 'Set ' + targetEmail + ' to role: ' + role };
    }
  }

  return { success: false, message: 'User not found: ' + targetEmail };
}

// ============================================================
// Logging
// ============================================================

/**
 * Log an access attempt to the admin sheet.
 * @private
 */
function logAccessAttempt_(email, authorized, reason) {
  try {
    var adminSheet = getAdminSheet_();
    if (!adminSheet) return;

    var logSheet = adminSheet.getSheetByName(SHEET_ACCESS_LOG);
    if (!logSheet) return;

    logSheet.appendRow([
      new Date().toISOString(),
      email,
      authorized ? 'yes' : 'no',
      reason
    ]);

    // Keep log manageable: trim to last 1000 rows
    var lastRow = logSheet.getLastRow();
    if (lastRow > 1001) {
      logSheet.deleteRows(2, lastRow - 1001);
    }
  } catch (e) {
    Logger.log('Failed to log access attempt: ' + e.message);
  }
}

/**
 * Log an error to the central admin sheet.
 * Replaces the placeholder in Utils.gs logError.
 *
 * @param {string} context
 * @param {string} message
 */
function logErrorToAdmin(context, message) {
  try {
    var email = Session.getActiveUser().getEmail();
    var adminSheet = getAdminSheet_();
    if (!adminSheet) return;

    var errorSheet = adminSheet.getSheetByName(SHEET_ERROR_LOG);
    if (!errorSheet) return;

    errorSheet.appendRow([
      new Date().toISOString(),
      email,
      context,
      message
    ]);

    // Trim to last 500 rows
    var lastRow = errorSheet.getLastRow();
    if (lastRow > 501) {
      errorSheet.deleteRows(2, lastRow - 501);
    }
  } catch (e) {
    Logger.log('Failed to log error to admin: ' + e.message);
  }
}
