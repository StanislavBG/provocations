/**
 * GeminiService.gs — Wrapper around Gemini API calls.
 *
 * Supports two auth modes:
 *   1. Google AI Studio: API key + generativelanguage.googleapis.com
 *   2. Vertex AI: OAuth token + {region}-aiplatform.googleapis.com
 *
 * Replaces all OpenAI calls from the original app.
 */

// ============================================================
// Core API Call
// ============================================================

/**
 * Call the Gemini API with the given parameters.
 *
 * @param {Object} options
 * @param {string} options.systemPrompt - System instruction text
 * @param {string} options.userPrompt - User message text
 * @param {number} [options.maxOutputTokens=4096] - Max tokens in response
 * @param {number} [options.temperature=0.7] - Temperature for generation
 * @param {boolean} [options.jsonMode=false] - Request JSON output
 * @param {string} [options.modelOverride] - Override the configured model
 * @return {Object} { content: string, raw: Object }
 */
function callGemini(options) {
  var config = getConfig();
  var model = options.modelOverride || config.model;

  var payload = buildPayload_(options);

  var url, fetchOptions;

  if (config.useVertexAi && config.vertexProject) {
    // Vertex AI endpoint (enterprise)
    url = buildVertexUrl_(config, model);
    fetchOptions = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
  } else if (config.geminiApiKey) {
    // Google AI Studio endpoint (API key)
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
          model + ':generateContent?key=' + config.geminiApiKey;
    fetchOptions = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
  } else {
    throw new Error('No Gemini API key or Vertex AI project configured. Go to Provocations > Settings.');
  }

  var response = UrlFetchApp.fetch(url, fetchOptions);
  var statusCode = response.getResponseCode();
  var body = response.getContentText();

  if (statusCode !== 200) {
    Logger.log('Gemini API error (' + statusCode + '): ' + body);
    throw new Error('Gemini API error (' + statusCode + '): ' + extractErrorMessage_(body));
  }

  var parsed = JSON.parse(body);
  var content = extractContent_(parsed);

  return {
    content: content,
    raw: parsed
  };
}

// ============================================================
// Payload Construction
// ============================================================

/**
 * Build the Gemini API request payload.
 * @private
 */
function buildPayload_(options) {
  var payload = {
    contents: [{
      role: 'user',
      parts: [{ text: options.userPrompt }]
    }],
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || 4096,
      temperature: options.temperature !== undefined ? options.temperature : 0.7
    }
  };

  // System instruction
  if (options.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: options.systemPrompt }]
    };
  }

  // JSON mode
  if (options.jsonMode) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  return payload;
}

/**
 * Build the Vertex AI endpoint URL.
 * @private
 */
function buildVertexUrl_(config, model) {
  return 'https://' + config.vertexLocation +
         '-aiplatform.googleapis.com/v1/projects/' +
         config.vertexProject + '/locations/' +
         config.vertexLocation + '/publishers/google/models/' +
         model + ':generateContent';
}

// ============================================================
// Response Parsing
// ============================================================

/**
 * Extract text content from Gemini response.
 * @private
 */
function extractContent_(response) {
  try {
    var candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      var blockReason = response.promptFeedback && response.promptFeedback.blockReason;
      if (blockReason) {
        throw new Error('Request blocked by safety filter: ' + blockReason);
      }
      return '';
    }

    var parts = candidates[0].content && candidates[0].content.parts;
    if (!parts || parts.length === 0) return '';

    // Concatenate all text parts
    var text = '';
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].text) {
        text += parts[i].text;
      }
    }

    return text.trim();
  } catch (e) {
    Logger.log('Error extracting Gemini content: ' + e.message);
    Logger.log('Raw response: ' + JSON.stringify(response).substring(0, 500));
    throw e;
  }
}

/**
 * Extract error message from API error response.
 * @private
 */
function extractErrorMessage_(body) {
  try {
    var parsed = JSON.parse(body);
    if (parsed.error && parsed.error.message) {
      return parsed.error.message;
    }
    return body.substring(0, 200);
  } catch (e) {
    return body.substring(0, 200);
  }
}

// ============================================================
// JSON Parsing Helper
// ============================================================

/**
 * Call Gemini expecting a JSON response, with retry on parse failure.
 *
 * @param {Object} options - Same as callGemini, but jsonMode is forced true
 * @return {Object} Parsed JSON object
 */
function callGeminiJson(options) {
  options.jsonMode = true;

  var result = callGemini(options);
  var content = result.content;

  // Strip markdown code fences if present
  content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(content);
  } catch (e) {
    Logger.log('JSON parse failed, retrying with explicit instruction...');
    Logger.log('Raw content: ' + content.substring(0, 500));

    // Retry with stronger JSON instruction
    options.userPrompt += '\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no code fences, no explanation.';
    result = callGemini(options);
    content = result.content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');

    try {
      return JSON.parse(content);
    } catch (e2) {
      Logger.log('JSON parse failed on retry: ' + content.substring(0, 500));
      throw new Error('Failed to get valid JSON from Gemini after retry');
    }
  }
}
