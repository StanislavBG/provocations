/**
 * Config.gs — Configuration, constants, and domain definitions.
 *
 * Ported from shared/schema.ts and server/routes.ts constants.
 */

// ============================================================
// Script Properties Management
// ============================================================

/**
 * Get all configuration from Script Properties.
 * API keys stored here, not in code.
 */
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    // Gemini API (Google AI Studio endpoint)
    geminiApiKey: props.getProperty('GEMINI_API_KEY') || '',
    model: props.getProperty('GEMINI_MODEL') || 'gemini-2.0-flash',

    // Vertex AI (enterprise endpoint — alternative to API key)
    useVertexAi: props.getProperty('USE_VERTEX_AI') === 'true',
    vertexProject: props.getProperty('VERTEX_PROJECT') || '',
    vertexLocation: props.getProperty('VERTEX_LOCATION') || 'us-central1',

    // App settings
    maxAnalysisLength: parseInt(props.getProperty('MAX_ANALYSIS_LENGTH') || '8000', 10),
    maxOutputTokens: parseInt(props.getProperty('MAX_OUTPUT_TOKENS') || '8192', 10),
  };
}

/**
 * Save configuration. Called from Settings dialog.
 * @param {Object} settings
 */
function saveConfig(settings) {
  var props = PropertiesService.getScriptProperties();

  if (settings.geminiApiKey !== undefined) {
    props.setProperty('GEMINI_API_KEY', settings.geminiApiKey);
  }
  if (settings.model !== undefined) {
    props.setProperty('GEMINI_MODEL', settings.model);
  }
  if (settings.useVertexAi !== undefined) {
    props.setProperty('USE_VERTEX_AI', String(settings.useVertexAi));
  }
  if (settings.vertexProject !== undefined) {
    props.setProperty('VERTEX_PROJECT', settings.vertexProject);
  }
  if (settings.vertexLocation !== undefined) {
    props.setProperty('VERTEX_LOCATION', settings.vertexLocation);
  }

  return { success: true };
}

// ============================================================
// Lens Definitions
// ============================================================

var LENS_TYPES = ['consumer', 'executive', 'technical', 'financial', 'strategic', 'skeptic'];

var LENS_PROMPTS = {
  consumer: 'Analyze from a consumer/end-user perspective. What matters to customers? What pain points or delights exist?',
  executive: 'Analyze from a leadership/executive perspective. What are the strategic implications, risks, and opportunities?',
  technical: 'Analyze from a technical implementation perspective. What\'s feasible, what are the constraints, what technical debt exists?',
  financial: 'Analyze from a financial perspective. What are the costs, revenues, ROI implications, and budget considerations?',
  strategic: 'Analyze from a long-term strategic perspective. How does this affect competitive positioning and market presence?',
  skeptic: 'Analyze with healthy skepticism. What assumptions are being made? What could go wrong? What\'s being overlooked?',
};

var LENS_DESCRIPTIONS = {
  consumer: 'end-user/customer perspective - focusing on user needs and experience',
  executive: 'strategic leadership perspective - focusing on business impact',
  technical: 'technical implementation perspective - focusing on feasibility',
  financial: 'financial perspective - focusing on costs and ROI',
  strategic: 'competitive positioning perspective - focusing on market advantage',
  skeptic: 'critical perspective - questioning assumptions and risks',
};

// ============================================================
// Provocation Definitions
// ============================================================

var PROVOCATION_TYPES = ['opportunity', 'fallacy', 'alternative'];

var PROVOCATION_PROMPTS = {
  opportunity: 'Identify potential opportunities for growth, innovation, or improvement that might be missed.',
  fallacy: 'Identify logical fallacies, weak arguments, unsupported claims, or gaps in reasoning.',
  alternative: 'Suggest alternative approaches, different perspectives, or lateral thinking opportunities.',
};

// ============================================================
// Instruction Classification
// ============================================================

var INSTRUCTION_TYPES = ['expand', 'condense', 'restructure', 'clarify', 'style', 'correct', 'general'];

var INSTRUCTION_PATTERNS = {
  expand: ['expand', 'elaborate', 'add detail', 'develop', 'flesh out', 'more about', 'tell me more', 'explain further'],
  condense: ['condense', 'shorten', 'shorter', 'summarize', 'brief', 'concise', 'cut', 'reduce', 'tighten', 'trim'],
  restructure: ['restructure', 'reorganize', 'reorder', 'move', 'rearrange', 'add section', 'add heading', 'split', 'merge section'],
  clarify: ['clarify', 'simplify', 'clearer', 'easier to understand', 'plain', 'straightforward', 'confus'],
  style: ['tone', 'voice', 'formal', 'informal', 'professional', 'casual', 'friendly', 'academic', 'style'],
  correct: ['fix', 'correct', 'error', 'mistake', 'typo', 'grammar', 'spelling', 'wrong', 'inaccurate'],
};

var INSTRUCTION_STRATEGIES = {
  expand: 'Add depth, examples, supporting details, and elaboration. Develop ideas more fully while maintaining coherence.',
  condense: 'Remove redundancy, tighten prose, eliminate filler words. Preserve core meaning while reducing length.',
  restructure: 'Reorganize content for better flow. Add or modify headings, reorder sections, improve logical progression.',
  clarify: 'Simplify language, add transitions, break down complex ideas. Make the text more accessible without losing meaning.',
  style: 'Adjust the voice and tone. Maintain the content while shifting the register, formality, or emotional quality.',
  correct: 'Fix errors in grammar, spelling, facts, or logic. Make precise corrections without unnecessary changes.',
  general: 'Make targeted improvements based on the specific instruction. Balance multiple considerations appropriately.',
};

// ============================================================
// Tone Options
// ============================================================

var TONE_OPTIONS = ['inspirational', 'practical', 'analytical', 'persuasive', 'cautious'];

// ============================================================
// Utility Functions
// ============================================================

/**
 * Classify a user instruction into a type.
 * @param {string} instruction
 * @return {string} instruction type
 */
function classifyInstruction(instruction) {
  var lower = instruction.toLowerCase();

  for (var type in INSTRUCTION_PATTERNS) {
    if (type === 'general') continue;
    var patterns = INSTRUCTION_PATTERNS[type];
    for (var i = 0; i < patterns.length; i++) {
      if (lower.indexOf(patterns[i]) !== -1) {
        return type;
      }
    }
  }

  return 'general';
}

/**
 * Generate a unique ID.
 * @param {string} prefix
 * @return {string}
 */
function generateId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}
