/**
 * Setup.gs — Idempotent install & migration script for AnnotationApp.
 *
 * Run runSetup() to install or upgrade. Each migration step checks whether
 * it has already been applied and skips if so.  A SCHEMA_VERSION key in
 * the AppConfig sheet tracks the current version so future migrations can
 * branch on it.
 *
 * Safe to run repeatedly ("do no harm").
 */

var CURRENT_SCHEMA_VERSION = 3;

// ============================================================
// Main Entry Point
// ============================================================

/**
 * Run the full setup / migration pipeline.
 * Presents a summary of what was done and any permissions the user
 * should be aware of.
 *
 * @return {Object} { success, steps[], permissionsNeeded[] }
 */
function runSetup() {
  var email = Session.getActiveUser().getEmail().toLowerCase();
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
    throw new Error('Setup can only be run by a @' + ALLOWED_DOMAIN + ' user.');
  }

  var steps = [];
  var props = PropertiesService.getScriptProperties();

  // ----------------------------------------------------------
  // Step 1: Admin sheet bootstrap (from AccessControl.setupAdmin)
  // ----------------------------------------------------------
  var adminSheet = getOrCreateAdminSheet_(props, email, steps);

  // ----------------------------------------------------------
  // Step 2: Ensure all required tabs exist with correct headers
  // ----------------------------------------------------------
  ensureAdminSheetTabs_(adminSheet, steps);

  // ----------------------------------------------------------
  // Step 3: Ensure role column on InvitedUsers (v2 migration)
  // ----------------------------------------------------------
  ensureRoleColumn_(adminSheet, steps);

  // ----------------------------------------------------------
  // Step 4: Ensure Feedback tab (v2)
  // ----------------------------------------------------------
  ensureFeedbackTab_(adminSheet, steps);

  // ----------------------------------------------------------
  // Step 5: Ensure UsageStats tab (v2)
  // ----------------------------------------------------------
  ensureUsageStatsTab_(adminSheet, steps);

  // ----------------------------------------------------------
  // Step 6: Ensure schema_version in AppConfig
  // ----------------------------------------------------------
  setSchemaVersion_(adminSheet, CURRENT_SCHEMA_VERSION, steps);

  // ----------------------------------------------------------
  // Step 7: Ensure INVITE_SALT exists
  // ----------------------------------------------------------
  if (!props.getProperty('INVITE_SALT')) {
    props.setProperty('INVITE_SALT', Utilities.getUuid() + '-' + Date.now());
    steps.push({ action: 'Created INVITE_SALT in Script Properties', status: 'created' });
  } else {
    steps.push({ action: 'INVITE_SALT already exists', status: 'skipped' });
  }

  // ----------------------------------------------------------
  // Permissions summary
  // ----------------------------------------------------------
  var permissionsNeeded = [
    'https://www.googleapis.com/auth/spreadsheets — Read/write Google Sheets (per-user data & admin config)',
    'https://www.googleapis.com/auth/drive — Create folders & save audio/transcript/doc files in user\'s Drive',
    'https://www.googleapis.com/auth/drive.file — Access files created by this app',
    'https://www.googleapis.com/auth/documents — Read/write Google Docs content',
    'https://www.googleapis.com/auth/script.external_request — Call Gemini/Vertex AI API',
    'https://www.googleapis.com/auth/userinfo.email — Identify the current user for access control',
    'https://www.googleapis.com/auth/gmail.send — Send feedback response emails (admin only)'
  ];

  // Show summary in UI if available
  try {
    var ui = DocumentApp.getUi();
    showSetupSummary_(ui, steps, permissionsNeeded);
  } catch (e) {
    try {
      var ui2 = SpreadsheetApp.getUi();
      showSetupSummary_(ui2, steps, permissionsNeeded);
    } catch (e2) {
      Logger.log('Setup completed (no UI available). Steps: ' + JSON.stringify(steps));
    }
  }

  return {
    success: true,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    adminSheetId: adminSheet.getId(),
    adminSheetUrl: adminSheet.getUrl(),
    steps: steps,
    permissionsNeeded: permissionsNeeded
  };
}

// ============================================================
// Migration Helpers
// ============================================================

/**
 * Get or create the admin config spreadsheet.
 * Idempotent: if the sheet ID is already in Script Properties and
 * accessible, it reuses it.
 * @private
 */
function getOrCreateAdminSheet_(props, email, steps) {
  var existingId = props.getProperty('ADMIN_SHEET_ID');

  if (existingId) {
    try {
      var ss = SpreadsheetApp.openById(existingId);
      ss.getName(); // verify accessible
      steps.push({ action: 'Admin sheet already exists (ID: ' + existingId + ')', status: 'skipped' });
      return ss;
    } catch (e) {
      steps.push({ action: 'Existing admin sheet not accessible, creating new', status: 'recreated' });
    }
  }

  var ss = SpreadsheetApp.create(ADMIN_SHEET_NAME);
  props.setProperty('ADMIN_SHEET_ID', ss.getId());
  steps.push({ action: 'Created admin sheet: ' + ADMIN_SHEET_NAME, status: 'created' });

  return ss;
}

/**
 * Ensure all core tabs exist with correct headers.
 * @private
 */
function ensureAdminSheetTabs_(ss, steps) {
  // InvitedUsers
  ensureTab_(ss, SHEET_INVITED_USERS,
    ['email', 'inviteToken', 'status', 'lastAccess', 'invitedBy', 'invitedAt', 'role'],
    steps);

  // Seed admin user if InvitedUsers is empty
  var usersSheet = ss.getSheetByName(SHEET_INVITED_USERS);
  if (usersSheet.getLastRow() <= 1) {
    var email = Session.getActiveUser().getEmail().toLowerCase();
    var token = generateInviteToken_(email);
    usersSheet.appendRow([email, token, 'active', new Date().toISOString(), email, new Date().toISOString(), 'admin']);
    steps.push({ action: 'Added deployer as admin user: ' + email, status: 'created' });
  }

  // AppConfig
  ensureTab_(ss, SHEET_APP_CONFIG, ['key', 'value'], steps);
  seedConfigIfMissing_(ss, 'admin_email', Session.getActiveUser().getEmail().toLowerCase(), steps);
  seedConfigIfMissing_(ss, 'allowed_domain', ALLOWED_DOMAIN, steps);
  seedConfigIfMissing_(ss, 'app_name', 'AnnotationApp', steps);
  seedConfigIfMissing_(ss, 'created_at', new Date().toISOString(), steps);

  // ErrorLog
  ensureTab_(ss, SHEET_ERROR_LOG, ['timestamp', 'email', 'context', 'message', 'severity'], steps);

  // AccessLog
  ensureTab_(ss, SHEET_ACCESS_LOG, ['timestamp', 'email', 'authorized', 'reason'], steps);
}

/**
 * Ensure a named tab exists with the given header row.
 * If the tab exists but is missing columns, appends them.
 * @private
 */
function ensureTab_(ss, name, headers, steps) {
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    // Check if there's a default "Sheet1" we can rename
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getName() === 'Sheet1' && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName(name);
    } else {
      sheet = ss.insertSheet(name);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    steps.push({ action: 'Created tab: ' + name + ' (' + headers.length + ' columns)', status: 'created' });
    return;
  }

  // Tab exists — check if we need to add new columns
  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  var added = [];
  headers.forEach(function(h) {
    if (existingHeaders.indexOf(h) === -1) {
      var nextCol = existingHeaders.length + added.length + 1;
      sheet.getRange(1, nextCol).setValue(h);
      added.push(h);
    }
  });

  if (added.length > 0) {
    steps.push({ action: 'Tab ' + name + ': added columns [' + added.join(', ') + ']', status: 'updated' });
  } else {
    steps.push({ action: 'Tab ' + name + ': already up to date', status: 'skipped' });
  }
}

/**
 * Seed a config key if it doesn't already exist.
 * @private
 */
function seedConfigIfMissing_(ss, key, value, steps) {
  var configSheet = ss.getSheetByName(SHEET_APP_CONFIG);
  if (!configSheet) return;

  var data = configSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return; // already exists
  }

  configSheet.appendRow([key, value]);
  steps.push({ action: 'AppConfig: seeded ' + key, status: 'created' });
}

/**
 * Ensure role column on InvitedUsers (v2 migration).
 * @private
 */
function ensureRoleColumn_(ss, steps) {
  var sheet = ss.getSheetByName(SHEET_INVITED_USERS);
  if (!sheet) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var roleIdx = headers.indexOf('role');

  if (roleIdx === -1) {
    // Add role column
    var nextCol = headers.length + 1;
    sheet.getRange(1, nextCol).setValue('role');
    roleIdx = nextCol - 1;

    // Set first user (admin deployer) to 'admin'
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, nextCol).setValue('admin');
    }
    steps.push({ action: 'Added role column to InvitedUsers', status: 'created' });
  } else {
    // Ensure the deployer/admin has role='admin'
    var data = sheet.getDataRange().getValues();
    var adminEmail = '';
    var configSheet = ss.getSheetByName(SHEET_APP_CONFIG);
    if (configSheet) {
      var cfgData = configSheet.getDataRange().getValues();
      for (var i = 1; i < cfgData.length; i++) {
        if (cfgData[i][0] === 'admin_email') { adminEmail = cfgData[i][1]; break; }
      }
    }

    for (var j = 1; j < data.length; j++) {
      if (data[j][0] === adminEmail && data[j][roleIdx] !== 'admin') {
        sheet.getRange(j + 1, roleIdx + 1).setValue('admin');
        steps.push({ action: 'Set admin role for ' + adminEmail, status: 'updated' });
        return;
      }
    }
    steps.push({ action: 'Role column already exists on InvitedUsers', status: 'skipped' });
  }
}

/**
 * Ensure Feedback tab.
 * @private
 */
function ensureFeedbackTab_(ss, steps) {
  ensureTab_(ss, 'Feedback', [
    'id', 'timestamp', 'userEmail', 'type', 'title', 'body',
    'status', 'adminComments', 'updatedAt', 'updatedBy'
  ], steps);
}

/**
 * Ensure UsageStats tab.
 * @private
 */
function ensureUsageStatsTab_(ss, steps) {
  ensureTab_(ss, 'UsageStats', [
    'feature', 'count', 'lastUsed', 'firstUsed'
  ], steps);
}

/**
 * Write schema_version to AppConfig.
 * @private
 */
function setSchemaVersion_(ss, version, steps) {
  var configSheet = ss.getSheetByName(SHEET_APP_CONFIG);
  if (!configSheet) return;

  var data = configSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'schema_version') {
      var currentVer = parseInt(data[i][1], 10) || 0;
      if (currentVer >= version) {
        steps.push({ action: 'Schema version already at v' + currentVer, status: 'skipped' });
        return;
      }
      configSheet.getRange(i + 1, 2).setValue(version);
      steps.push({ action: 'Upgraded schema_version from v' + currentVer + ' to v' + version, status: 'updated' });
      return;
    }
  }

  configSheet.appendRow(['schema_version', version]);
  steps.push({ action: 'Set schema_version to v' + version, status: 'created' });
}

// ============================================================
// UI Summary
// ============================================================

/**
 * Show the setup summary in a modal dialog.
 * @private
 */
function showSetupSummary_(ui, steps, permissions) {
  var html = '<html><head><base target="_top"><style>' +
    'body{font-family:"Salesforce Sans",-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;padding:16px;color:#181818;background:#f4f6f9}' +
    'h2{font-size:16px;color:#0176d3;margin-bottom:12px}' +
    'h3{font-size:13px;color:#444;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px}' +
    '.card{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.06)}' +
    '.step{padding:4px 0;display:flex;justify-content:space-between;border-bottom:1px solid #f0f0f0;font-size:12px}' +
    '.badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase}' +
    '.badge-created{background:#e6f6ec;color:#2e844a}.badge-updated{background:#eef4ff;color:#0176d3}' +
    '.badge-skipped{background:#f0f0f0;color:#706e6b}.badge-recreated{background:#fff3e0;color:#fe9339}' +
    '.perm{font-size:11px;color:#444;padding:3px 0;border-bottom:1px solid #f8f8f8}' +
    '.perm code{background:#eef4ff;padding:1px 4px;border-radius:3px;font-size:10px}' +
    '.ok-btn{padding:8px 24px;background:#0176d3;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;margin-top:12px}' +
    '</style></head><body>' +
    '<h2>&#x2705; Setup Complete</h2>' +
    '<div class="card"><h3>Migration Steps</h3>';

  steps.forEach(function(s) {
    html += '<div class="step"><span>' + s.action + '</span>' +
      '<span class="badge badge-' + s.status + '">' + s.status + '</span></div>';
  });

  html += '</div><div class="card"><h3>Required Google Permissions</h3>' +
    '<p style="font-size:11px;color:#706e6b;margin-bottom:8px">' +
    'Users will be prompted to grant these scopes on first use. ' +
    'Ensure your Workspace admin has approved these for the organization.</p>';

  permissions.forEach(function(p) {
    var parts = p.split(' — ');
    html += '<div class="perm"><code>' + parts[0] + '</code> ' + (parts[1] || '') + '</div>';
  });

  html += '</div><div style="text-align:center"><button class="ok-btn" onclick="google.script.host.close()">OK</button></div>' +
    '</body></html>';

  var output = HtmlService.createHtmlOutput(html)
    .setWidth(550)
    .setHeight(520);
  ui.showModalDialog(output, 'AnnotationApp Setup');
}
