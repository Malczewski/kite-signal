variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "description" {
  description = "Lambda function description"
  type        = string
  default     = ""
}

variable "source_dir" {
  description = "Directory containing the bundled JS output (e.g. an esbuild dist/ dir) to zip and deploy"
  type        = string
}

variable "handler" {
  description = "Lambda handler, e.g. index.handler"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 256
}

variable "timeout_seconds" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days (kept short deliberately to control cost)"
  type        = number
  default     = 14
}

variable "enable_xray" {
  description = "Enable AWS X-Ray active tracing"
  type        = bool
  default     = false
}

variable "extra_policy_arns" {
  description = "Additional IAM policy ARNs to attach to the Lambda execution role"
  type        = list(string)
  default     = []
}

variable "alarm_sns_topic_arn" {
  description = "If set, alarms when this function's Errors metric is > 0 in a 5-minute period"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to all resources created by this module"
  type        = map(string)
  default     = {}
}
