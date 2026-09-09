variable "aws_region" {
  description = "AWS region for kite-signal infrastructure"
  type        = string
  default     = "eu-central-1"
}

variable "alert_email" {
  description = "Email for ops alarms + budget alerts. Set via terraform.tfvars (gitignored) or -var, never committed. Leave unset to skip email subscriptions (the SNS topic/alarms/budget still get created either way)."
  type        = string
  default     = null
}

variable "monthly_budget_usd" {
  description = "AWS Budgets monthly cost threshold"
  type        = number
  default     = 15
}
