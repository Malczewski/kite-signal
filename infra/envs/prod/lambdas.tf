locals {
  xray_policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
  sqs_policy_arn  = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

# Milestone 7: fetches forecasts for active spots, enqueues one message per spot.
module "forecast_fetcher_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-forecast-fetcher"
  description     = "Fetches forecasts for active spots and enqueues them for scoring."
  source_dir      = "${path.module}/../../../services/forecast-fetcher/dist"
  memory_size     = 256
  timeout_seconds = 60

  enable_xray         = true
  extra_policy_arns   = [local.xray_policy_arn]
  enable_alarm        = true
  alarm_sns_topic_arn = aws_sns_topic.ops_alerts.arn

  environment_variables = {
    SPOTS_TABLE_NAME           = module.spots_table.table_name
    FORECAST_SCORING_QUEUE_URL = module.forecast_scoring_queue.queue_url
    FORECAST_DAYS              = "5"
  }
}

module "forecast_fetcher_schedule" {
  source = "../../modules/eventbridge-scheduler"

  name                = "kite-signal-forecast-fetcher"
  schedule_expression = "rate(3 hours)"
  target_lambda_arn   = module.forecast_fetcher_lambda.function_arn
}

# Milestone 7-8: scores each spot's forecast, publishes GoodForecastDetected events.
module "forecast_scorer_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-forecast-scorer"
  description     = "Scores each spot's forecast and publishes GoodForecastDetected events."
  source_dir      = "${path.module}/../../../services/forecast-scorer/dist"
  memory_size     = 256
  timeout_seconds = 30

  enable_xray         = true
  extra_policy_arns   = [local.sqs_policy_arn, local.xray_policy_arn]
  enable_alarm        = true
  alarm_sns_topic_arn = aws_sns_topic.ops_alerts.arn

  environment_variables = {
    EVENT_BUS_NAME      = aws_cloudwatch_event_bus.kite_signal_events.name
    MIN_SCORE_THRESHOLD = "65"
    MIN_DURATION_HOURS  = "3"
  }
}

resource "aws_lambda_event_source_mapping" "forecast_scorer_from_scoring_queue" {
  event_source_arn = module.forecast_scoring_queue.queue_arn
  function_name    = module.forecast_scorer_lambda.function_name
  batch_size       = 5
}

# Milestone 10: Telegram bot webhook (subscribe/unsubscribe/etc via chat commands).
module "telegram_webhook_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-telegram-webhook"
  description     = "Handles Telegram bot webhook updates (subscribe/unsubscribe/etc)."
  source_dir      = "${path.module}/../../../services/telegram-webhook/dist"
  memory_size     = 256
  timeout_seconds = 15

  enable_xray         = true
  extra_policy_arns   = [local.xray_policy_arn]
  enable_alarm        = true
  alarm_sns_topic_arn = aws_sns_topic.ops_alerts.arn

  environment_variables = {
    SPOTS_TABLE_NAME              = module.spots_table.table_name
    USERS_TABLE_NAME              = module.users_table.table_name
    SUBSCRIPTIONS_TABLE_NAME      = module.subscriptions_table.table_name
    TELEGRAM_BOT_TOKEN_PARAM      = aws_ssm_parameter.telegram_bot_token.name
    TELEGRAM_WEBHOOK_SECRET_PARAM = aws_ssm_parameter.telegram_webhook_secret.name
  }
}

module "telegram_webhook_api" {
  source = "../../modules/api-gateway-http"

  api_name             = "kite-signal-telegram-webhook"
  route_key            = "POST /telegram/webhook"
  lambda_invoke_arn    = module.telegram_webhook_lambda.invoke_arn
  lambda_function_name = module.telegram_webhook_lambda.function_name
  enable_alarm         = true
  alarm_sns_topic_arn  = aws_sns_topic.ops_alerts.arn
}

# Milestone 9/11: matches GoodForecastDetected events against subscriber preferences,
# dedups, and fans out one notify job per linked channel.
module "preference_matcher_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-preference-matcher"
  description     = "Matches GoodForecastDetected events against subscriber preferences."
  source_dir      = "${path.module}/../../../services/preference-matcher/dist"
  memory_size     = 256
  timeout_seconds = 30

  enable_xray         = true
  extra_policy_arns   = [local.sqs_policy_arn, local.xray_policy_arn]
  enable_alarm        = true
  alarm_sns_topic_arn = aws_sns_topic.ops_alerts.arn

  environment_variables = {
    SUBSCRIPTIONS_TABLE_NAME      = module.subscriptions_table.table_name
    USERS_TABLE_NAME              = module.users_table.table_name
    NOTIFICATION_DEDUP_TABLE_NAME = module.notification_dedup_table.table_name
    NOTIFICATION_QUEUE_URL        = module.notification_queue.queue_url
  }
}

resource "aws_lambda_event_source_mapping" "preference_matcher_from_matching_queue" {
  event_source_arn = module.preference_matching_queue.queue_arn
  function_name    = module.preference_matcher_lambda.function_name
  batch_size       = 5
}

# Milestone 11: dispatches a notify job to the right channel (Telegram today).
module "notifier_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-notifier"
  description     = "Sends a notification via the channel a notify job targets."
  source_dir      = "${path.module}/../../../services/notifier/dist"
  memory_size     = 128
  timeout_seconds = 15

  enable_xray         = true
  extra_policy_arns   = [local.sqs_policy_arn, local.xray_policy_arn]
  enable_alarm        = true
  alarm_sns_topic_arn = aws_sns_topic.ops_alerts.arn

  environment_variables = {
    TELEGRAM_BOT_TOKEN_PARAM = aws_ssm_parameter.telegram_bot_token.name
  }
}

resource "aws_lambda_event_source_mapping" "notifier_from_notification_queue" {
  event_source_arn = module.notification_queue.queue_arn
  function_name    = module.notifier_lambda.function_name
  batch_size       = 5
}
