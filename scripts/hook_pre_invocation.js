#!/usr/bin/env node
/**
 * PreInvocation Hook - Google Cloud Model Armor Guardrail
 * 
 * Intercepts the user's prompt before Antigravity sends it to the LLM.
 * Evaluates the prompt against the Model Armor template:
 * https://modelarmor.us-central1.rep.googleapis.com/v1/projects/secops-guardrail-prod/locations/us-central1/templates/enterprise-agent-guardrails:sanitizeUserPrompt
 * 
 * If a jailbreak, injection, or policy violation is detected, terminates the invocation
 * and displays an error message to the user.
 */

const fs = require('fs');
const { sanitizeUserPrompt, DEFAULT_TEMPLATE } = require('./model_armor_client');

async function main() {
  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    // If no stdin, fail-open or exit safely
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    console.error('[ModelArmor-PreInvocation] Error parsing stdin JSON:', err.message);
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  const userInput = payload.lastUserInput || '';
  if (!userInput.trim()) {
    console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    return;
  }

  try {
    const verdict = await sanitizeUserPrompt(userInput);

    if (verdict.isBlocked) {
      // Hard block: terminate turn and show alert to user
      const response = {
        injectSteps: [
          {
            "errorMessage": {
              "userMessage": `🚨 [Model Armor Security Gate] Prompt rejected by template "${DEFAULT_TEMPLATE}". Reason: ${verdict.summary}`
            }
          }
        ],
        "terminationBehavior": "terminate"
      };
      console.log(JSON.stringify(response));
    } else {
      // Passed security audit
      console.log(JSON.stringify({ injectSteps: [], terminationBehavior: "" }));
    }
  } catch (apiError) {
    // Fail-closed or fail-open based on policy. In enterprise guardrails, we log and alert:
    console.error('[ModelArmor-PreInvocation] API Error:', apiError.message);
    // Allow or force user review on error
    console.log(JSON.stringify({
      injectSteps: [
        {
          "systemMessage": {
            "systemMessage": `⚠️ [Model Armor Notice] Security screening degraded: ${apiError.message}`
          }
        }
      ],
      "terminationBehavior": ""
    }));
  }
}

main();
