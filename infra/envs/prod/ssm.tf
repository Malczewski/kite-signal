# The AWS-managed key backing SecureString parameters that don't specify a custom KMS key.
# Lambdas reading these need kms:Decrypt on this key (see iam.tf).
data "aws_kms_alias" "ssm" {
  name = "alias/aws/ssm"
}

# Values are placeholders set here so Terraform can create the parameters; the real
# secrets are set out-of-band via `aws ssm put-parameter --overwrite` (see
# docs/manual-setup.md) and never enter Terraform state or version control.
resource "aws_ssm_parameter" "telegram_bot_token" {
  name  = "/kite-signal/telegram/bot-token"
  type  = "SecureString"
  value = "REPLACE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "telegram_webhook_secret" {
  name  = "/kite-signal/telegram/webhook-secret"
  type  = "SecureString"
  value = "REPLACE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}
