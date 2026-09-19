# Resource-scoped permissions for each Lambda, defined here (rather than in the generic
# lambda-function module) since only this env root knows the concrete resource ARNs.

resource "aws_iam_role_policy" "forecast_fetcher" {
  name = "forecast-fetcher-access"
  role = module.forecast_fetcher_lambda.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan"]
        Resource = module.spots_table.table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = module.forecast_scoring_queue.queue_arn
      },
    ]
  })
}

resource "aws_iam_role_policy" "forecast_scorer" {
  name = "forecast-scorer-access"
  role = module.forecast_scorer_lambda.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:PutEvents"]
      Resource = aws_cloudwatch_event_bus.kite_signal_events.arn
    }]
  })
}

resource "aws_iam_role_policy" "telegram_webhook" {
  name = "telegram-webhook-access"
  role = module.telegram_webhook_lambda.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Scan"]
        Resource = module.spots_table.table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:Query"]
        Resource = module.users_table.table_arn
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [
          module.subscriptions_table.table_arn,
          "${module.subscriptions_table.table_arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [
          aws_ssm_parameter.telegram_bot_token.arn,
          aws_ssm_parameter.telegram_webhook_secret.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = data.aws_kms_alias.ssm.target_key_arn
      },
    ]
  })
}

resource "aws_iam_role_policy" "preference_matcher" {
  name = "preference-matcher-access"
  role = module.preference_matcher_lambda.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:Query"]
        Resource = [
          module.subscriptions_table.table_arn,
          "${module.subscriptions_table.table_arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = module.users_table.table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = module.notification_dedup_table.table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = module.notification_queue.queue_arn
      },
    ]
  })
}

resource "aws_iam_role_policy" "notifier" {
  name = "notifier-access"
  role = module.notifier_lambda.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.telegram_bot_token.arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = data.aws_kms_alias.ssm.target_key_arn
      },
    ]
  })
}
