#!/usr/bin/env python3
"""PostInvocation Hook in Python - Google Cloud Model Armor Guardrail."""

import sys
import json
import os
from model_armor_client import sanitize_model_response, DEFAULT_TEMPLATE


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    transcript_path = payload.get("transcriptPath")
    model_output = ""

    if transcript_path and os.path.exists(transcript_path):
        try:
            with open(transcript_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
            for line in reversed(lines):
                entry = json.loads(line)
                if entry.get("type") == "PLANNER_RESPONSE" or entry.get("source") == "MODEL":
                    model_output = entry.get("content", "")
                    break
        except Exception:
            pass

    if not model_output.strip():
        print(json.dumps({"injectSteps": [], "terminationBehavior": ""}))
        return

    try:
        is_blocked, summary, _ = sanitize_model_response(model_output)
        if is_blocked:
            out = {
                "injectSteps": [
                    {
                        "errorMessage": {
                            "userMessage": f'🚨 [Model Armor Output Gate] Agent completion suppressed by template "{DEFAULT_TEMPLATE}". Reason: {summary}'
                        }
                    }
                ],
                "terminationBehavior": "terminate",
            }
            print(json.dumps(out))
        else:
            print(json.dumps({"injectSteps": [], "terminationBehavior": ""}))
    except Exception:
        print(json.dumps({"injectSteps": [], "terminationBehavior": ""}))


if __name__ == "__main__":
    main()
