terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "project_id" {
  type        = string
  description = "Google Cloud Project ID"
  default     = "secops-guardrail-prod"
}

variable "region" {
  type        = string
  description = "Google Cloud region for Model Armor"
  default     = "us-central1"
}

variable "template_id" {
  type        = string
  description = "Model Armor template identifier"
  default     = "enterprise-agent-guardrails"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable Model Armor API
resource "google_project_service" "modelarmor" {
  service                    = "modelarmor.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

# IAM Role Binding for Antigravity Agent Service Account / Users
resource "google_project_iam_member" "modelarmor_user" {
  project = var.project_id
  role    = "roles/modelarmor.user"
  member  = "serviceAccount:antigravity-agent@${var.project_id}.iam.gserviceaccount.com"

  depends_on = [google_project_service.modelarmor]
}

# Outputs for configuring .agents/hooks.json
output "user_prompt_endpoint" {
  description = "REST endpoint for user prompt and tool argument sanitization"
  value       = "https://modelarmor.${var.region}.rep.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/templates/${var.template_id}:sanitizeUserPrompt"
}

output "model_response_endpoint" {
  description = "REST endpoint for model output sanitization"
  value       = "https://modelarmor.${var.region}.rep.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/templates/${var.template_id}:sanitizeModelResponse"
}
