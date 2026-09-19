# Milestone 13. Single ops-alerts topic reused by every alarm (Lambda errors, DLQs, oldest-
# message-age, dead-man's-switch) and the budget below - one place to manage who gets paged.
resource "aws_sns_topic" "ops_alerts" {
  name = "kite-signal-ops-alerts"
}

resource "aws_sns_topic_policy" "ops_alerts" {
  arn = aws_sns_topic.ops_alerts.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudWatchAlarms"
        Effect    = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.ops_alerts.arn
      },
      {
        Sid       = "AllowBudgets"
        Effect    = "Allow"
        Principal = { Service = "budgets.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.ops_alerts.arn
      },
    ]
  })
}

# Requires confirming a "subscribe" link AWS emails to alert_email - see docs/manual-setup.md.
resource "aws_sns_topic_subscription" "ops_alerts_email" {
  count     = var.alert_email != null ? 1 : 0
  topic_arn = aws_sns_topic.ops_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Fires if forecast-fetcher hasn't run successfully in ~2x its 3h schedule - catches a
# silently stalled pipeline or a broken schedule itself, not just per-message failures.
resource "aws_cloudwatch_metric_alarm" "forecast_fetcher_dead_mans_switch" {
  alarm_name          = "kite-signal-forecast-fetcher-dead-mans-switch"
  alarm_description   = "forecast-fetcher has not run successfully in 6+ hours"
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  dimensions          = { FunctionName = module.forecast_fetcher_lambda.function_name }
  statistic           = "Sum"
  period              = 21600
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.ops_alerts.arn]
}

resource "aws_budgets_budget" "monthly" {
  name         = "kite-signal-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.ops_alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.ops_alerts.arn]
  }
}

resource "aws_cloudwatch_dashboard" "pipeline" {
  dashboard_name = "kite-signal-pipeline"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "Lambda Errors"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Sum"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", module.forecast_fetcher_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", module.forecast_scorer_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", module.telegram_webhook_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", module.preference_matcher_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", module.notifier_lambda.function_name],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "Lambda Invocations"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Sum"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", module.forecast_fetcher_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", module.forecast_scorer_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", module.telegram_webhook_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", module.preference_matcher_lambda.function_name],
            ["AWS/Lambda", "Invocations", "FunctionName", module.notifier_lambda.function_name],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "Queue Depth (visible messages)"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Maximum"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.forecast_scoring_queue.queue_name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.preference_matching_queue.queue_name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.notification_queue.queue_name],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title  = "DLQ Depth"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Maximum"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.forecast_scoring_queue.dlq_name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.preference_matching_queue.dlq_name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", module.notification_queue.dlq_name],
          ]
        }
      },
    ]
  })
}
