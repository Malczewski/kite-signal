variable "api_name" {
  type = string
}

variable "route_key" {
  description = "e.g. \"POST /telegram/webhook\""
  type        = string
}

variable "lambda_invoke_arn" {
  type = string
}

variable "lambda_function_name" {
  type = string
}

variable "throttling_rate_limit" {
  description = "Steady-state requests/second allowed before API Gateway starts throttling"
  type        = number
  default     = 10
}

variable "throttling_burst_limit" {
  description = "Concurrent request burst allowed above the steady-state rate"
  type        = number
  default     = 20
}

variable "enable_alarm" {
  description = "Whether to create the high-4xx-rate alarm (requires alarm_sns_topic_arn)"
  type        = bool
  default     = false
}

variable "alarm_sns_topic_arn" {
  description = "If set, alarms when the API's 4xx count is elevated (possible abuse)"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
