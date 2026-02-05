/**
 * AnalysisService.gs — Generates lenses and provocations from document text.
 *
 * Port of POST /api/analyze from server/routes.ts.
 * Two batched Gemini calls run sequentially (Apps Script is synchronous).
 */

// ============================================================
// Main Analysis Entry Point
// ============================================================

/**
 * Analyze text through multiple lenses and generate provocations.
 *
 * Called from the sidebar via google.script.run.analyzeText(...)
 *
 * @param {Object} request
 * @param {string} request.text - The document text to analyze
 * @param {string[]} [request.selectedLenses] - Specific lenses to use (default: all)
 * @param {Object[]} [request.referenceDocuments] - Reference docs for comparison
 * @return {Object} { documentId, lenses, provocations, warnings }
 */
function analyzeText(request) {
  enforceAccess();
  trackUsage('analyze');

  if (!request || !request.text || typeof request.text !== 'string') {
    throw new Error('Text is required for analysis');
  }

  var text = request.text;
  var selectedLenses = request.selectedLenses || LENS_TYPES;
  var referenceDocuments = request.referenceDocuments || [];

  // Truncate for analysis (full text stored separately)
  var config = getConfig();
  var maxLen = config.maxAnalysisLength;
  var wasTruncated = text.length > maxLen;
  var analysisText = text.substring(0, maxLen);

  // Reference document summary
  var refDocSummary = null;
  if (referenceDocuments.length > 0) {
    refDocSummary = referenceDocuments.map(function(d) {
      var content = d.content.substring(0, 500) + (d.content.length > 500 ? '...' : '');
      return '[' + (d.type || 'REFERENCE').toUpperCase() + ': ' + d.name + ']\n' + content;
    }).join('\n\n');
  }

  // Save document to storage
  var docId = StorageService.saveDocument(text);

  // Generate lenses and provocations
  var lenses = generateLenses_(analysisText, selectedLenses);
  var provocations = generateProvocations_(analysisText, refDocSummary);

  // Save analysis results
  StorageService.saveAnalysis(docId, lenses, provocations);

  var result = {
    documentId: docId,
    lenses: lenses,
    provocations: provocations
  };

  if (wasTruncated) {
    result.warnings = [{
      type: 'text_truncated',
      message: 'Your text (' + text.length.toLocaleString() + ' characters) was truncated to ' +
               maxLen.toLocaleString() + ' characters for analysis. The full document is preserved.'
    }];
  }

  return result;
}

// ============================================================
// Lens Generation
// ============================================================

/**
 * Generate all lens analyses in a single Gemini call.
 * @private
 */
function generateLenses_(analysisText, lensTypes) {
  var lensDescriptions = lensTypes.map(function(t) {
    return '- ' + t + ': ' + LENS_PROMPTS[t];
  }).join('\n');

  var systemPrompt =
    'You are an analytical assistant helping users understand text through multiple perspectives.\n\n' +
    'Analyze the given text through each of these lenses:\n' +
    lensDescriptions + '\n\n' +
    'Respond with a JSON object containing a "lenses" array. For each lens, provide:\n' +
    '- type: The lens type (' + lensTypes.join(', ') + ')\n' +
    '- title: A brief title for this lens analysis (max 50 chars)\n' +
    '- summary: A 2-3 sentence summary from this perspective\n' +
    '- keyPoints: An array of 3-5 key observations (each max 30 chars)';

  var userPrompt = 'Analyze this text through the following lenses (' +
    lensTypes.join(', ') + '):\n\n' + analysisText;

  try {
    var result = callGeminiJson({
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      maxOutputTokens: 4096
    });

    var lensesArray = Array.isArray(result.lenses) ? result.lenses : [];

    return lensTypes.map(function(lensType, idx) {
      var lensData = null;
      for (var i = 0; i < lensesArray.length; i++) {
        if (lensesArray[i] && lensesArray[i].type === lensType) {
          lensData = lensesArray[i];
          break;
        }
      }
      if (!lensData) lensData = lensesArray[idx] || {};

      return {
        id: generateId(lensType),
        type: lensType,
        title: lensData.title || (lensType + ' Analysis'),
        summary: lensData.summary || 'Analysis not available',
        keyPoints: Array.isArray(lensData.keyPoints) ? lensData.keyPoints : [],
        isActive: false
      };
    });
  } catch (e) {
    Logger.log('Error generating lenses: ' + e.message);
    return lensTypes.map(function(lensType, idx) {
      return {
        id: generateId(lensType),
        type: lensType,
        title: lensType + ' Analysis',
        summary: 'Analysis could not be generated: ' + e.message,
        keyPoints: [],
        isActive: false
      };
    });
  }
}

// ============================================================
// Provocation Generation
// ============================================================

/**
 * Generate all provocations in a single Gemini call.
 * @private
 */
function generateProvocations_(analysisText, refDocSummary) {
  var provDescriptions = PROVOCATION_TYPES.map(function(t) {
    return '- ' + t + ': ' + PROVOCATION_PROMPTS[t];
  }).join('\n');

  var refContext = refDocSummary
    ? '\n\nThe user has provided reference documents that represent their target quality:\n' +
      refDocSummary + '\n\nCompare the source text against these references to identify gaps.'
    : '';

  var systemPrompt =
    'You are a critical thinking partner. Challenge assumptions and push thinking deeper.\n\n' +
    'Generate provocations in these categories:\n' +
    provDescriptions + refContext + '\n\n' +
    'Respond with a JSON object containing a "provocations" array. Generate 2-3 provocations per category (6-9 total).\n' +
    'For each provocation:\n' +
    '- type: The category (opportunity, fallacy, or alternative)\n' +
    '- title: A punchy headline (max 60 chars)\n' +
    '- content: A 2-3 sentence explanation\n' +
    '- sourceExcerpt: A relevant quote from the source text (max 150 chars)';

  var userPrompt = 'Generate provocations (opportunities, fallacies, and alternatives) for this text:\n\n' +
    analysisText;

  try {
    var result = callGeminiJson({
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      maxOutputTokens: 4096
    });

    var provocationsArray = Array.isArray(result.provocations) ? result.provocations : [];

    return provocationsArray.map(function(p, idx) {
      var provType = PROVOCATION_TYPES.indexOf(p.type) !== -1
        ? p.type
        : PROVOCATION_TYPES[idx % 3];

      return {
        id: generateId(provType),
        type: provType,
        title: p.title || 'Untitled Provocation',
        content: p.content || '',
        sourceExcerpt: p.sourceExcerpt || '',
        status: 'pending'
      };
    });
  } catch (e) {
    Logger.log('Error generating provocations: ' + e.message);
    return [];
  }
}
