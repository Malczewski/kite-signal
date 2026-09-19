variable "queue_name" {
  type = string
}

variable "visibility_timeout_seconds" {
  description = "Should be >= the consuming Lambda's timeout"
  type        = number
  default     = 60
}

variable "message_retention_seconds" {
  type    = number
  default = 345600 # 4 days
}

variable "max_receive_count" {
  description = "Deliveries before a message moves to the DLQ"
  type        = number
  default     = 5
}

variable "enable_alarm" {
  description = "Whether to create the DLQ/oldest-message-age alarms (requires alarm_sns_topic_arn)"
  type        = bool
  default     = false
}

variable "alarm_sns_topic_arn" {
  description = "If set, alarms when the DLQ is non-empty or the queue's oldest message age exceeds max_message_age_alarm_seconds"
  type        = string
  default     = null
}

variable "max_message_age_alarm_seconds" {
  description = "Threshold for the oldest-message-age alarm (a stuck pipeline signal)"
  type        = number
  default     = 3600
}

variable "tags" {
  type    = map(string)
  default = {}
}
