variable "name" {
  type = string
}

variable "schedule_expression" {
  description = "e.g. rate(3 hours) or cron(0 */3 * * ? *)"
  type        = string
  default     = "rate(3 hours)"
}

variable "target_lambda_arn" {
  type = string
}

variable "input" {
  description = "JSON string passed as the Lambda event payload"
  type        = string
  default     = "{}"
}

variable "tags" {
  type    = map(string)
  default = {}
}
