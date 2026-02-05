/**
 * WriterService.gs — Document evolution and editing via Gemini.
 *
 * Port of POST /api/write from server/routes.ts.
 * Two-step: 1) evolve document, 2) analyze changes.
 */

// ============================================================
// Main Write Entry Point
// ============================================================

/**
 * Evolve a document based on a user instruction.
 *
 * Called from the sidebar via google.script.run.writeDocument(...)
 *
 * @param {Object} request
 * @param {string} request.document - Current document text
 * @param {string} request.objective - Document goal/purpose
 * @param {string} request.instruction - User instruction (text or voice transcript)
 * @param {string} [request.selectedText] - Specific text selection to focus on
 * @param {Object} [request.provocation] - Provocation being addressed
 * @param {string} [request.activeLens] - Active lens perspective
 * @param {string} [request.tone] - Desired tone
 * @param {string} [request.targetLength] - "shorter" | "same" | "longer"
 * @param {Object[]} [request.referenceDocuments] - Style reference docs
 * @param {Object[]} [request.editHistory] - Previous edits for coherence
 * @return {Object} { document, summary, instructionType, changes, suggestions }
 */
function writeDocument(request) {
  enforceAccess();
  trackUsage('write');

  if (!request || !request.document || !request.instruction) {
    throw new Error('Document and instruction are required');
  }

  var doc = request.document;
  var objective = request.objective || 'Improve the document';
  var instruction = request.instruction;
  var selectedText = request.selectedText || null;
  var provocation = request.provocation || null;
  var activeLens = request.activeLens || null;
  var tone = request.tone || null;
  var targetLength = request.targetLength || null;
  var referenceDocuments = request.referenceDocuments || [];
  var editHistory = request.editHistory || [];

  // Classify the instruction
  var instructionType = classifyInstruction(instruction);
  var strategy = INSTRUCTION_STRATEGIES[instructionType];

  // Build context
  var contextParts = [];

  contextParts.push('INSTRUCTION TYPE: ' + instructionType + '\nSTRATEGY: ' + strategy);

  // Edit history for coherence
  if (editHistory.length > 0) {
    var historyStr = editHistory.slice(-5).map(function(e) {
      var instr = e.instruction.length > 80 ? e.instruction.substring(0, 80) + '...' : e.instruction;
      return '- [' + e.instructionType + '] ' + instr;
    }).join('\n');
    contextParts.push('RECENT EDIT HISTORY (maintain consistency with previous changes):\n' + historyStr);
  }

  // Reference documents
  if (referenceDocuments.length > 0) {
    var refSummaries = referenceDocuments.map(function(d) {
      var typeLabel = d.type === 'style' ? 'STYLE GUIDE' :
                      d.type === 'template' ? 'TEMPLATE' : 'EXAMPLE';
      var content = d.content.substring(0, 1000) + (d.content.length > 1000 ? '...' : '');
      return '[' + typeLabel + ': ' + d.name + ']\n' + content;
    }).join('\n\n---\n\n');

    contextParts.push(
      'REFERENCE DOCUMENTS (use these to guide tone, style, and structure):\n' +
      refSummaries + '\n\n' +
      'Analyze the style, structure, and voice of these references. Match the target document\'s quality where appropriate.'
    );
  }

  // Active lens
  if (activeLens && LENS_DESCRIPTIONS[activeLens]) {
    contextParts.push('PERSPECTIVE: Apply the ' + activeLens + ' lens (' + LENS_DESCRIPTIONS[activeLens] + ')');
  }

  // Provocation context
  if (provocation) {
    contextParts.push(
      'PROVOCATION BEING ADDRESSED:\n' +
      'Type: ' + provocation.type + '\n' +
      'Challenge: ' + provocation.title + '\n' +
      'Details: ' + provocation.content + '\n' +
      'Relevant excerpt: "' + provocation.sourceExcerpt + '"'
    );
  }

  // Tone
  if (tone) {
    contextParts.push('TONE: Write in a ' + tone + ' voice');
  }

  // Target length
  if (targetLength) {
    var lengthInstructions = {
      shorter: 'Make it more concise (60-70% of current length)',
      same: 'Maintain similar length',
      longer: 'Expand with more detail (130-150% of current length)'
    };
    contextParts.push('LENGTH: ' + (lengthInstructions[targetLength] || targetLength));
  }

  var contextSection = contextParts.length > 0
    ? '\n\nCONTEXT:\n' + contextParts.join('\n\n')
    : '';

  var focusInstruction = selectedText
    ? 'The user has selected specific text to focus on. Apply the instruction primarily to this selection, but ensure it integrates well with the rest of the document.'
    : 'Apply the instruction to improve the document holistically.';

  // Step 1: Evolve the document
  var evolvedDocument = evolveDocument_(doc, objective, instruction, selectedText, focusInstruction, contextSection);

  // Step 2: Analyze changes
  var analysis = analyzeChanges_(doc, evolvedDocument, instruction);

  // Save version to storage
  StorageService.saveVersion(evolvedDocument, analysis.summary || 'Document updated');

  return {
    document: evolvedDocument.trim(),
    summary: analysis.summary,
    instructionType: instructionType,
    changes: analysis.changes.length > 0 ? analysis.changes : undefined,
    suggestions: analysis.suggestions.length > 0 ? analysis.suggestions : undefined
  };
}

// ============================================================
// Document Evolution
// ============================================================

/**
 * Generate the evolved document via Gemini.
 * @private
 */
function evolveDocument_(document, objective, instruction, selectedText, focusInstruction, contextSection) {
  var config = getConfig();

  var systemPrompt =
    'You are an expert document editor helping a user iteratively shape their document.\n\n' +
    'DOCUMENT OBJECTIVE: ' + objective + '\n\n' +
    'Your role is to evolve the document based on the user\'s instruction while always keeping the objective in mind. ' +
    'The document should get better with each iteration - clearer, more compelling, better structured.\n\n' +
    'Guidelines:\n' +
    '1. ' + focusInstruction + '\n' +
    '2. Preserve the document\'s voice and structure unless explicitly asked to change it\n' +
    '3. Make targeted improvements, not wholesale rewrites\n' +
    '4. The output should be the complete evolved document (not just the changed parts)\n' +
    '5. Use markdown formatting for structure (headers, lists, emphasis) where appropriate' +
    contextSection + '\n\n' +
    'Output only the evolved document text. No explanations or meta-commentary.';

  var userPrompt = 'CURRENT DOCUMENT:\n' + document;
  if (selectedText) {
    userPrompt += '\n\nSELECTED TEXT (focus area):\n"' + selectedText + '"';
  }
  userPrompt += '\n\nINSTRUCTION: ' + instruction +
    '\n\nPlease evolve the document according to this instruction.';

  var result = callGemini({
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
    maxOutputTokens: config.maxOutputTokens,
    temperature: 0.7
  });

  return result.content || document;
}

// ============================================================
// Change Analysis
// ============================================================

/**
 * Analyze what changed between original and evolved document.
 * @private
 */
function analyzeChanges_(original, evolved, instruction) {
  var defaultResult = {
    summary: 'Applied: ' + instruction.substring(0, 100) + (instruction.length > 100 ? '...' : ''),
    changes: [],
    suggestions: []
  };

  try {
    var systemPrompt =
      'You are a document change analyzer. Compare the original and evolved documents and provide a brief structured analysis.\n\n' +
      'Respond with a JSON object containing:\n' +
      '- summary: A one-sentence summary of what changed (max 100 chars)\n' +
      '- changes: An array of 1-3 change objects, each with:\n' +
      '  - type: "added" | "modified" | "removed" | "restructured"\n' +
      '  - description: What changed (max 60 chars)\n' +
      '  - location: Where in the document (e.g., "Introduction", "Second paragraph") (optional)\n' +
      '- suggestions: An array of 0-2 strings with potential next improvements (max 60 chars each)';

    var origTruncated = original.substring(0, 2000) + (original.length > 2000 ? '...' : '');
    var evolvedTruncated = evolved.substring(0, 2000) + (evolved.length > 2000 ? '...' : '');

    var userPrompt = 'ORIGINAL DOCUMENT:\n' + origTruncated +
      '\n\nEVOLVED DOCUMENT:\n' + evolvedTruncated +
      '\n\nINSTRUCTION APPLIED: ' + instruction;

    var result = callGeminiJson({
      systemPrompt: systemPrompt,
      userPrompt: userPrompt,
      maxOutputTokens: 1024,
      temperature: 0.3
    });

    var validTypes = ['added', 'modified', 'removed', 'restructured'];

    return {
      summary: result.summary || defaultResult.summary,
      changes: Array.isArray(result.changes)
        ? result.changes.slice(0, 3).map(function(c) {
            return {
              type: validTypes.indexOf(c.type) !== -1 ? c.type : 'modified',
              description: c.description || 'Document updated',
              location: c.location || undefined
            };
          })
        : [],
      suggestions: Array.isArray(result.suggestions)
        ? result.suggestions.filter(function(s) { return typeof s === 'string'; }).slice(0, 2)
        : []
    };
  } catch (e) {
    Logger.log('Change analysis failed: ' + e.message);
    return defaultResult;
  }
}

// ============================================================
// Voice Transcript Summarization
// ============================================================

/**
 * Clean up a voice transcript into clear intent.
 *
 * Port of POST /api/summarize-intent from server/routes.ts.
 *
 * @param {string} transcript - Raw voice transcript
 * @param {string} [context] - "objective" | "source" | "general"
 * @return {Object} { summary, originalLength, summaryLength }
 */
function summarizeIntent(transcript, context) {
  enforceAccess();
  trackUsage('voice_input');

  if (!transcript || typeof transcript !== 'string') {
    throw new Error('Transcript is required');
  }

  var contextLabel = context === 'objective' ? 'document objective/goal'
    : context === 'source' ? 'source material for a document'
    : 'general content';

  var systemPrompt =
    'You are an expert at extracting clear intent from spoken transcripts. ' +
    'The user has spoken a ' + contextLabel + '. Your job is to:\n\n' +
    '1. Clean up speech artifacts (um, uh, repeated words, false starts)\n' +
    '2. Extract the core intent/meaning\n' +
    '3. Present it as a clear, concise statement\n\n' +
    'For objectives: Output a single clear sentence describing what they want to create.\n' +
    'For source material: Clean up and organize the spoken content into readable paragraphs.\n\n' +
    'Be faithful to their intent - don\'t add information they didn\'t mention.';

  var maxTokens = context === 'source' ? 4000 : 500;

  var result = callGemini({
    systemPrompt: systemPrompt,
    userPrompt: 'Raw transcript:\n\n' + transcript,
    maxOutputTokens: maxTokens,
    temperature: 0.3
  });

  var summary = result.content || transcript;

  return {
    summary: summary,
    originalLength: transcript.length,
    summaryLength: summary.length
  };
}
