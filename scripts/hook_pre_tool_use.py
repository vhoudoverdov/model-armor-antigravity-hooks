#!/usr/bin/env python3
"""PreToolUse Hook in Python - Google Cloud Model Armor Guardrail."""

import sys
import json
from model_armor_client import sanitize_user_prompt, DEFAULT_TEMPLATE


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    tool_call = payload.get("toolCall", {})
    tool_name = tool_call.get("name", "unknown")
    tool_args = tool_call.get("args", {})

    # Extract text content from tool arguments to scan
    if "CommandLine" in tool_args:
        text_to_audit = f"Command to execute: {tool_args['CommandLine']}"
    elif "Content" in tool_args:
        text_to_audit = f"File write payload: {str(tool_args['Content'])[:4000]}"
    elif "Replacement" in tool_args:
        text_to_audit = f"File edit replacement: {str(tool_args['Replacement'])[:4000]}"
    elif "query" in tool_args:
        text_to_audit = f"Search query: {tool_args['query']}"
    else:
        text_to_audit = f"Tool [{tool_name}] arguments: {json.dumps(tool_args)}"

    try:
        is_blocked, summary, violations = sanitize_user_prompt(text_to_audit)
        if is_blocked:
            has_severe = any(
                "Prompt Injection" in v or "Malicious URI" in v for v in violations
            )
            if has_severe:
                print(
                    json.dumps(
                        {
                            "decision": "deny",
                            "reason": f"🚨 Blocked by Model Armor ({DEFAULT_TEMPLATE}): {summary}",
                        }
                    )
                )
            else:
                print(
                    json.dumps(
                        {
                            "decision": "force_ask",
                            "reason": f"⚠️ Model Armor caution: {summary}. Human approval required.",
                        }
                    )
                )
        else:
            print(json.dumps({"decision": "allow", "reason": "Model Armor inspection passed."}))
    except Exception as e:
        print(
            json.dumps(
                {
                    "decision": "ask",
                    "reason": f"Model Armor screening service unavailable ({e}). Please confirm tool execution.",
                }
            )
        )


if __name__ == "__main__":
    main()
