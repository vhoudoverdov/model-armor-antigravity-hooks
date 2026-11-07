#!/usr/bin/env python3
"""PostToolUse Hook in Python - Google Cloud Model Armor Guardrail."""

import sys
import json
import os
from model_armor_client import sanitize_user_prompt


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}

    transcript_path = payload.get("transcriptPath")
    tool_call = payload.get("toolCall", {})
    tool_name = tool_call.get("name", "unknown")

    if transcript_path and os.path.exists(transcript_path):
        try:
            with open(transcript_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
            if lines:
                last_step = json.loads(lines[-1])
                content = last_step.get("content") or json.dumps(last_step.get("tool_calls", ""))
                if content and len(content) > 20:
                    is_blocked, summary, _ = sanitize_user_prompt(content[:4000])
                    if is_blocked:
                        sys.stderr.write(
                            f"🚨 [Model Armor Alert] Indirect injection/leak detected in tool result ({tool_name}): {summary}\n"
                        )
        except Exception:
            pass

    # PostToolUse contract expects an empty JSON object
    print(json.dumps({}))


if __name__ == "__main__":
    main()
