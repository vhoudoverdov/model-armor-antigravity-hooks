#!/usr/bin/env python3
"""PreInvocation Hook in Python - Google Cloud Model Armor Guardrail."""

import sys
import json
from model_armor_client import sanitize_user_prompt, DEFAULT_TEMPLATE


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    user_input = payload.get("lastUserInput", "").strip()
    if not user_input:
        print(json.dumps({"injectSteps": [], "terminationBehavior": ""}))
        return

    try:
        is_blocked, summary, violations = sanitize_user_prompt(user_input)
        if is_blocked:
            out = {
                "injectSteps": [
                    {
                        "errorMessage": {
                            "userMessage": f'🚨 [Model Armor Security Gate] Prompt rejected by template "{DEFAULT_TEMPLATE}". Reason: {summary}'
                        }
                    }
                ],
                "terminationBehavior": "terminate",
            }
            print(json.dumps(out))
        else:
            print(json.dumps({"injectSteps": [], "terminationBehavior": ""}))
    except Exception as e:
        # Fallback handling
        print(
            json.dumps(
                {
                    "injectSteps": [
                        {
                            "systemMessage": {
                                "systemMessage": f"⚠️ [Model Armor Notice] Security screening degraded: {e}"
                            }
                        }
                    ],
                    "terminationBehavior": "",
                }
            )
        )


if __name__ == "__main__":
    main()
