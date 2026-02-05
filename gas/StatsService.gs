/**
 * StatsService.gs — Anonymous usage tracking for admin analytics.
 *
 * Tracks feature usage counts in the "UsageStats" tab of the admin sheet.
 * No PII is stored — only feature names, counts, and timestamps.
 *
 * Features tracked:
 *   analyze, write, voice_input, save_to_drive, save_audio,
 *   save_transcript, load_from_drive, provocation_response,
 *   provocation_dismiss, reanalyze, feedback_submit
 */

var SHEET_USAGE_STATS = 'UsageStats';

// ============================================================
// Usage Tracking
// ============================================================

/**
 * Increment usage count for a feature.
 * Called silently from various server functions — never throws.
 *
 * @param {string} feature - Feature name (e.g. 'analyze', 'voice_input')
 */
function trackUsage(feature) {
  try {
    var adminSheet = getAdminSheet_();
    if (!adminSheet) return;

    var sheet = adminSheet.getSheetByName(SHEET_USAGE_STATS);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var now = new Date().toISOString();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === feature) {
        var count = (parseInt(data[i][1], 10) || 0) + 1;
        sheet.getRange(i + 1, 2).setValue(count);
        sheet.getRange(i + 1, 3).setValue(now);
        return;
      }
    }

    // New feature — insert row
    sheet.appendRow([feature, 1, now, now]);
  } catch (e) {
    Logger.log('trackUsage error: ' + e.message);
  }
}

// ============================================================
// Admin Stats Retrieval
// ============================================================

/**
 * Get aggregated usage stats for the admin dashboard.
 * Admin-only.
 *
 * @return {Object} { users, features, accessSummary }
 */
function getAdminStats() {
  enforceAdmin();

  var adminSheet = getAdminSheet_();
  if (!adminSheet) return { users: {}, features: [], accessSummary: {} };

  var result = {
    users: getUserStats_(adminSheet),
    features: getFeatureStats_(adminSheet),
    accessSummary: getAccessSummary_(adminSheet)
  };

  return result;
}

/**
 * Get user-count stats (no PII — just counts and statuses).
 * @private
 */
function getUserStats_(ss) {
  var usersSheet = ss.getSheetByName(SHEET_INVITED_USERS);
  if (!usersSheet) return { total: 0, active: 0, revoked: 0, neverLoggedIn: 0 };

  var data = usersSheet.getDataRange().getValues();
  var total = 0, active = 0, revoked = 0, neverLoggedIn = 0;
  var admins = 0, regularUsers = 0;
  var headers = data[0];
  var roleIdx = headers.indexOf('role');

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    total++;
    if (data[i][2] === 'active') active++;
    else if (data[i][2] === 'revoked') revoked++;
    if (!data[i][3] || data[i][3] === '') neverLoggedIn++;
    if (roleIdx !== -1 && data[i][roleIdx] === 'admin') admins++;
    else regularUsers++;
  }

  return {
    total: total,
    active: active,
    revoked: revoked,
    neverLoggedIn: neverLoggedIn,
    admins: admins,
    regularUsers: regularUsers
  };
}

/**
 * Get feature usage stats.
 * @private
 */
function getFeatureStats_(ss) {
  var sheet = ss.getSheetByName(SHEET_USAGE_STATS);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var data = sheet.getDataRange().getValues();
  var features = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      features.push({
        feature: data[i][0],
        count: parseInt(data[i][1], 10) || 0,
        lastUsed: data[i][2] || '',
        firstUsed: data[i][3] || ''
      });
    }
  }

  // Sort by count descending
  features.sort(function(a, b) { return b.count - a.count; });
  return features;
}

/**
 * Get access log summary (last 7 days). No PII — just counts.
 * @private
 */
function getAccessSummary_(ss) {
  var sheet = ss.getSheetByName(SHEET_ACCESS_LOG);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { totalAccess: 0, authorized: 0, denied: 0, uniqueUsers: 0, last7days: 0 };
  }

  var data = sheet.getDataRange().getValues();
  var totalAccess = 0, authorized = 0, denied = 0;
  var uniqueEmails = {};
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  var last7days = 0;

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    totalAccess++;
    if (data[i][2] === 'yes') authorized++;
    else denied++;
    if (data[i][1]) uniqueEmails[data[i][1]] = true;

    try {
      var ts = new Date(data[i][0]);
      if (ts >= sevenDaysAgo) last7days++;
    } catch (e) {}
  }

  return {
    totalAccess: totalAccess,
    authorized: authorized,
    denied: denied,
    uniqueUsers: Object.keys(uniqueEmails).length,
    last7days: last7days
  };
}

/**
 * Get error log summary. Admin-only.
 * @return {Object} { total, last24h, byContext }
 */
function getErrorSummary() {
  enforceAdmin();
  var adminSheet = getAdminSheet_();
  if (!adminSheet) return { total: 0, last24h: 0, byContext: {} };

  var sheet = adminSheet.getSheetByName(SHEET_ERROR_LOG);
  if (!sheet || sheet.getLastRow() <= 1) return { total: 0, last24h: 0, byContext: {} };

  var data = sheet.getDataRange().getValues();
  var total = 0, last24h = 0;
  var byContext = {};
  var oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    total++;
    var ctx = data[i][2] || 'unknown';
    byContext[ctx] = (byContext[ctx] || 0) + 1;
    try {
      if (new Date(data[i][0]) >= oneDayAgo) last24h++;
    } catch (e) {}
  }

  return { total: total, last24h: last24h, byContext: byContext };
}
