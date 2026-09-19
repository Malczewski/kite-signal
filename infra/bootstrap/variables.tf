variable "aws_region" {
  description = "AWS region for kite-signal infrastructure"
  type        = string
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform remote state, e.g. kite-signal-tfstate-<yourname>"
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking"
  type        = string
  default     = "kite-signal-tf-locks"
}
