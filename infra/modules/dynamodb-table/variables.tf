variable "table_name" {
  type = string
}

variable "hash_key" {
  description = "Partition key attribute name"
  type        = string
  default     = "PK"
}

variable "range_key" {
  description = "Sort key attribute name"
  type        = string
  default     = "SK"
}

variable "billing_mode" {
  type    = string
  default = "PAY_PER_REQUEST"
}

variable "attributes" {
  description = "Extra attribute definitions beyond hash_key/range_key, needed for any GSIs"
  type = list(object({
    name = string
    type = string
  }))
  default = []
}

variable "global_secondary_indexes" {
  type = list(object({
    name            = string
    hash_key        = string
    range_key       = optional(string)
    projection_type = optional(string, "ALL")
  }))
  default = []
}

variable "ttl_attribute_name" {
  description = "Attribute name holding a TTL epoch-seconds value. Null disables TTL."
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
