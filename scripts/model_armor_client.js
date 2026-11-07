/**
 * Google Cloud Model Armor Client for Antigravity Lifecycle Hooks
 * 
 * Provides unified sanitization methods for user prompts and model responses
 * by interfacing with Google Cloud Model Armor REST endpoints.
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Configuration constants - realistic production settings
const DEFAULT_LOCATION = process.env.MODEL_ARMOR_LOCATION || 'us-central1';
const DEFAULT_PROJECT = process.env.MODEL_ARMOR_PROJECT_ID || 'secops-guardrail-prod';
const DEFAULT_TEMPLATE = process.env.MODEL_ARMOR_TEMPLATE_ID || 'enterprise-agent-guardrails';

// Target REST endpoints
const DEFAULT_USER_PROMPT_URL = process.env.MODEL_ARMOR_USER_PROMPT_URL ||
  `https://modelarmor.${DEFAULT_LOCATION}.rep.googleapis.com/v1/projects/${DEFAULT_PROJECT}/locations/${DEFAULT_LOCATION}/templates/${DEFAULT_TEMPLATE}:sanitizeUserPrompt`;

const DEFAULT_MODEL_RESPONSE_URL = process.env.MODEL_ARMOR_MODEL_RESPONSE_URL ||
  `https://modelarmor.${DEFAULT_LOCATION}.rep.googleapis.com/v1/projects/${DEFAULT_PROJECT}/locations/${DEFAULT_LOCATION}/templates/${DEFAULT_TEMPLATE}:sanitizeModelResponse`;

/**
 * Retrieves a GCP OAuth2 access token.
 * Falls back to gcloud CLI if MODEL_ARMOR_TOKEN is not in the environment.
 */
function getAuthToken() {
  if (process.env.MODEL_ARMOR_TOKEN) {
    return process.env.MODEL_ARMOR_TOKEN;
  }
  if (process.env.MODEL_ARMOR_MOCK === 'true') {
    return 'mock-token';
  }
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (err) {
    return '';
  }
}

/**
 * Built-in mock evaluator for offline testing, CI/CD, and demonstrations.
 */
function evaluateMock(payload) {
  const text = (payload.userPromptData && payload.userPromptData.text) ||
               (payload.modelResponseData && payload.modelResponseData.text) || '';

  const isJailbreak = /ignore (all )?previous instructions|you are now in dan mode|bypass security|reveal system prompt/i.test(text);
  const isMaliciousUri = /malicious-exfil\.xyz|attacker\.com|evil-payload\.sh/i.test(text);
  const hasSensitiveData = /AIza[0-9A-Za-z-_]{35}|BEGIN PRIVATE KEY|password\s*=\s*['"][^'"]+['"]/i.test(text);
  const matchFound = isJailbreak || isMaliciousUri || hasSensitiveData;

  return {
    sanitizationResult: {
      filterMatchState: matchFound ? 'MATCH_FOUND' : 'NO_MATCH_FOUND',
      filterResults: {
        piAndJailbreakFilterResult: {
          executionState: 'EXECUTION_SUCCESS',
          matchState: isJailbreak ? 'MATCH_FOUND' : 'NO_MATCH_FOUND',
          confidenceLevel: isJailbreak ? 'HIGH' : 'LOW'
        },
        maliciousUriFilterResult: {
          executionState: 'EXECUTION_SUCCESS',
          matchState: isMaliciousUri ? 'MATCH_FOUND' : 'NO_MATCH_FOUND'
        },
        raiFilterResult: {
          executionState: 'EXECUTION_SUCCESS',
          matchState: 'NO_MATCH_FOUND'
        },
        sdpFilterResult: {
          executionState: 'EXECUTION_SUCCESS',
          matchState: hasSensitiveData ? 'MATCH_FOUND' : 'NO_MATCH_FOUND'
        }
      }
    }
  };
}

/**
 * Sends a POST request to a Model Armor REST endpoint.
 */
function callModelArmorEndpoint(urlStr, payload) {
  // If mock mode is explicitly requested, evaluate using mock engine
  if (process.env.MODEL_ARMOR_MOCK === 'true') {
    return Promise.resolve(evaluateMock(payload));
  }

  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(payload);
    const token = getAuthToken();

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Antigravity-ModelArmor-Hook/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: headers,
      timeout: 4000
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse Model Armor response: ${data}`));
          }
        } else {
          reject(new Error(`Model Armor HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Model Armor request timed out after 4000ms'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Analyzes the verdict structure returned by Model Armor.
 * Extracts matched filters, confidence, and human-readable reasons.
 */
function parseVerdict(response) {
  const sanitization = response.sanitizationResult || {};
  const matchState = sanitization.filterMatchState || 'NO_MATCH_FOUND';
  const filterResults = sanitization.filterResults || {};
  
  const violations = [];

  if (filterResults.piAndJailbreakFilterResult && filterResults.piAndJailbreakFilterResult.matchState === 'MATCH_FOUND') {
    const conf = filterResults.piAndJailbreakFilterResult.confidenceLevel || 'HIGH';
    violations.push(`Prompt Injection / Jailbreak detected (Confidence: ${conf})`);
  }

  if (filterResults.maliciousUriFilterResult && filterResults.maliciousUriFilterResult.matchState === 'MATCH_FOUND') {
    violations.push('Malicious URI or exploit payload link detected');
  }

  if (filterResults.raiFilterResult && filterResults.raiFilterResult.matchState === 'MATCH_FOUND') {
    violations.push('Responsible AI policy violation (Hate, Harassment, or Dangerous Content)');
  }

  if (filterResults.sdpFilterResult && filterResults.sdpFilterResult.matchState === 'MATCH_FOUND') {
    violations.push('Sensitive Data Protection alert (Confidential data or PII exposed)');
  }

  const isBlocked = matchState === 'MATCH_FOUND' || violations.length > 0;

  return {
    isBlocked,
    matchState,
    violations,
    summary: violations.length > 0 ? violations.join('; ') : 'Content passed security filters.',
    raw: response
  };
}

/**
 * Sanitizes input text using the sanitizeUserPrompt endpoint.
 * Evaluates for prompt injections, jailbreaks, malicious URLs, and abuse.
 */
async function sanitizeUserPrompt(text, customUrl = null) {
  const url = customUrl || DEFAULT_USER_PROMPT_URL;
  const payload = {
    userPromptData: {
      text: String(text || '')
    }
  };
  const response = await callModelArmorEndpoint(url, payload);
  return parseVerdict(response);
}

/**
 * Sanitizes output text using the sanitizeModelResponse endpoint.
 * Evaluates for PII leakage, harmful generation, or unsafe links.
 */
async function sanitizeModelResponse(text, customUrl = null) {
  const url = customUrl || DEFAULT_MODEL_RESPONSE_URL;
  const payload = {
    modelResponseData: {
      text: String(text || '')
    }
  };
  const response = await callModelArmorEndpoint(url, payload);
  return parseVerdict(response);
}

module.exports = {
  DEFAULT_USER_PROMPT_URL,
  DEFAULT_MODEL_RESPONSE_URL,
  DEFAULT_LOCATION,
  DEFAULT_PROJECT,
  DEFAULT_TEMPLATE,
  sanitizeUserPrompt,
  sanitizeModelResponse,
  parseVerdict,
  evaluateMock
};
