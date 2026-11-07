"""Google Cloud Model Armor Client for Antigravity Lifecycle Hooks

Provides unified sanitization methods for user prompts and model responses
by interfacing directly with Google Cloud Model Armor REST endpoints.
"""

import json
import os
import subprocess
import urllib.request
import urllib.error
from typing import Dict, Any, Tuple

# Configuration defaults - realistic production settings
DEFAULT_LOCATION = os.getenv("MODEL_ARMOR_LOCATION", "us-central1")
DEFAULT_PROJECT = os.getenv("MODEL_ARMOR_PROJECT_ID", "secops-guardrail-prod")
DEFAULT_TEMPLATE = os.getenv("MODEL_ARMOR_TEMPLATE_ID", "enterprise-agent-guardrails")

DEFAULT_USER_PROMPT_URL = os.getenv(
    "MODEL_ARMOR_USER_PROMPT_URL",
    f"https://modelarmor.{DEFAULT_LOCATION}.rep.googleapis.com/v1/projects/{DEFAULT_PROJECT}/locations/{DEFAULT_LOCATION}/templates/{DEFAULT_TEMPLATE}:sanitizeUserPrompt",
)

DEFAULT_MODEL_RESPONSE_URL = os.getenv(
    "MODEL_ARMOR_MODEL_RESPONSE_URL",
    f"https://modelarmor.{DEFAULT_LOCATION}.rep.googleapis.com/v1/projects/{DEFAULT_PROJECT}/locations/{DEFAULT_LOCATION}/templates/{DEFAULT_TEMPLATE}:sanitizeModelResponse",
)


def get_auth_token() -> str:
    """Retrieves GCP OAuth2 access token via env var or gcloud CLI."""
    token = os.getenv("MODEL_ARMOR_TOKEN", "")
    if token:
        return token
    try:
        res = subprocess.run(
            ["gcloud", "auth", "print-access-token"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return res.stdout.strip()
    except Exception:
        return ""


def call_model_armor(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Posts JSON payload to the specified Model Armor REST endpoint."""
    data_bytes = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Antigravity-ModelArmor-Hook/1.0",
    }
    token = get_auth_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Model Armor HTTP {e.code}: {body}") from e
    except Exception as e:
        raise RuntimeError(f"Model Armor call failed: {e}") from e


def parse_verdict(response: Dict[str, Any]) -> Tuple[bool, str, list]:
    """Parses Model Armor verdict into (is_blocked, summary, violations)."""
    sanitization = response.get("sanitizationResult", {})
    match_state = sanitization.get("filterMatchState", "NO_MATCH_FOUND")
    filter_results = sanitization.get("filterResults", {})

    violations = []
    pi_res = filter_results.get("piAndJailbreakFilterResult", {})
    if pi_res.get("matchState") == "MATCH_FOUND":
        conf = pi_res.get("confidenceLevel", "HIGH")
        violations.push if hasattr(violations, "push") else violations.append(
            f"Prompt Injection / Jailbreak detected (Confidence: {conf})"
        )

    uri_res = filter_results.get("maliciousUriFilterResult", {})
    if uri_res.get("matchState") == "MATCH_FOUND":
        violations.append("Malicious URI or exploit payload link detected")

    rai_res = filter_results.get("raiFilterResult", {})
    if rai_res.get("matchState") == "MATCH_FOUND":
        violations.append("Responsible AI policy violation (Hate, Harassment, or Dangerous Content)")

    sdp_res = filter_results.get("sdpFilterResult", {})
    if sdp_res.get("matchState") == "MATCH_FOUND":
        violations.append("Sensitive Data Protection alert (Confidential data or PII exposed)")

    is_blocked = match_state == "MATCH_FOUND" or len(violations) > 0
    summary = "; ".join(violations) if violations else "Content passed security filters."
    return is_blocked, summary, violations


def sanitize_user_prompt(text: str, custom_url: str = None) -> Tuple[bool, str, list]:
    """Calls sanitizeUserPrompt endpoint."""
    url = custom_url or DEFAULT_USER_PROMPT_URL
    payload = {"userPromptData": {"text": str(text or "")}}
    resp = call_model_armor(url, payload)
    return parse_verdict(resp)


def sanitize_model_response(text: str, custom_url: str = None) -> Tuple[bool, str, list]:
    """Calls sanitizeModelResponse endpoint."""
    url = custom_url or DEFAULT_MODEL_RESPONSE_URL
    payload = {"modelResponseData": {"text": str(text or "")}}
    resp = call_model_armor(url, payload)
    return parse_verdict(resp)
