#!/usr/bin/env node
/**
 * PostInvocation Hook - Google Cloud Model Armor Guardrail
 * 
 * Inspects model-generated completions before they are finalized or shown to the user.
 * Calls Model Armor endpoint:
 * https://modelarmor.us-central1.rep.googleapis.com/v1/projects/secops-guardrail-prod/locations/us-central1/templates/enterprise-agent-guardrails:sanitizeModelResponse
 * 
 * Protects against accidental leakage of sensitive corporate data (PII/secrets),
 * toxic hallucinations, or malicious generated links.
 */

const fs = require('fs');
const { sanitizeModelResponse, DEFAULT_TEMPLATE } = require('./model_armor_client');

async function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    console.error('[ModelArmor-PostInvocation] Error parsing stdin JSON:', err.message);
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  const transcriptPath = payload.transcriptPath;
  let modelOutput = '';

  // Extract model completion from transcript if present
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i]) continue;
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'PLANNER_RESPONSE' || entry.source === 'MODEL') {
          modelOutput = entry.content || '';
          break;
        }
      }
    } catch (e) {
      console.error('[ModelArmor-PostInvocation] Could not read transcript:', e.message);
    }
  }

  // If no output found to scan, allow through
  if (!modelOutput.trim()) {
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  try {
    const verdict = await sanitizeModelResponse(modelOutput);

    if (verdict.isBlocked) {
      // Hard block: terminate and suppress response
      const response = {
        injectSteps: [
          {
            "errorMessage": {
              "userMessage": `🚨 [Model Armor Output Gate] Agent completion suppressed by template "${DEFAULT_TEMPLATE}". Reason: ${verdict.summary}`
            }
          }
        ],
        "terminationBehavior": "terminate"
      };
      console.log(JSON.stringify(response));
    } else {
      console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    }
  } catch (apiError) {
    console.error('[ModelArmor-PostInvocation] API Error:', apiError.message);
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
  }
}

main();
