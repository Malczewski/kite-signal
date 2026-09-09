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

variable "tags" {
  type    = map(string)
  default = {}
}
