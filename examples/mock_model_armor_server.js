/**
 * Local Mock Server for Google Cloud Model Armor
 * 
 * Simulates the Model Armor REST endpoints for offline testing, CI/CD,
 * and local demonstration of the Antigravity lifecycle hooks tutorial.
 */

const http = require('http');

const PORT = process.env.MOCK_PORT || 8085;

// Attack patterns simulated by the mock server
const JAILBREAK_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /you are now in dan mode/i,
  /bypass security/i,
  /reveal system prompt/i
];

const MALICIOUS_URI_PATTERNS = [
  /malicious-exfil\.xyz/i,
  /attacker\.com/i,
  /evil-payload\.sh/i
];

const SENSITIVE_DATA_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/i, // Google API key
  /BEGIN PRIVATE KEY/i,
  /password\s*=\s*['"][^'"]+['"]/i
];

const server = http.createServer((req, res) => {
  const url = req.url || '';
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');
      const text = (data.userPromptData && data.userPromptData.text) ||
                   (data.modelResponseData && data.modelResponseData.text) || '';

      const isJailbreak = JAILBREAK_PATTERNS.some(p => p.test(text));
      const isMaliciousUri = MALICIOUS_URI_PATTERNS.some(p => p.test(text));
      const hasSensitiveData = SENSITIVE_DATA_PATTERNS.some(p => p.test(text));

      const matchFound = isJailbreak || isMaliciousUri || hasSensitiveData;

      const responsePayload = {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload, null, 2));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request payload', details: e.message }));
    }
  });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Mock Model Armor] Server listening on http://127.0.0.1:${PORT}`);
    console.log(`Endpoint pattern: http://127.0.0.1:${PORT}/v1/projects/:proj/locations/:loc/templates/:tpl:sanitizeUserPrompt`);
  });
}

module.exports = server;
