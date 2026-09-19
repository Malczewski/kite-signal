terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Bucket/region/dynamodb_table are supplied via `terraform init -backend-config=backend.hcl`
  # (see backend.hcl.example) so account-specific values stay out of version control.
  backend "s3" {
    key     = "prod/terraform.tfstate"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "kite-signal"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}
