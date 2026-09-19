# Fetcher -> scorer work queue (one message per spot's forecast).
module "forecast_scoring_queue" {
  source = "../../modules/sqs-queue"

  queue_name                 = "kite-signal-forecast-scoring"
  visibility_timeout_seconds = 90
  enable_alarm               = true
  alarm_sns_topic_arn        = aws_sns_topic.ops_alerts.arn
}

# Custom bus, single junction where future consumers (e.g. a trip-planner) can
# subscribe to the same GoodForecastDetected events at zero cost until they're added.
# This is the only place EventBridge is used, versus plain SQS everywhere else, since
# it's the one hop with more than one decoupled consumer.
resource "aws_cloudwatch_event_bus" "kite_signal_events" {
  name = "kite-signal-events"
}

resource "aws_cloudwatch_event_rule" "good_forecast_detected" {
  name           = "good-forecast-detected"
  event_bus_name = aws_cloudwatch_event_bus.kite_signal_events.name
  event_pattern = jsonencode({
    source        = ["kite-signal.forecast-scorer"]
    "detail-type" = ["GoodForecastDetected"]
  })
}

# Bus -> preference-matching work queue.
module "preference_matching_queue" {
  source = "../../modules/sqs-queue"

  queue_name                 = "kite-signal-preference-matching"
  visibility_timeout_seconds = 60
  enable_alarm               = true
  alarm_sns_topic_arn        = aws_sns_topic.ops_alerts.arn
}

resource "aws_cloudwatch_event_target" "to_preference_matching_queue" {
  rule           = aws_cloudwatch_event_rule.good_forecast_detected.name
  event_bus_name = aws_cloudwatch_event_bus.kite_signal_events.name
  arn            = module.preference_matching_queue.queue_arn
}

resource "aws_sqs_queue_policy" "preference_matching_allow_eventbridge" {
  queue_url = module.preference_matching_queue.queue_url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgePut"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = module.preference_matching_queue.queue_arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.good_forecast_detected.arn
        }
      }
    }]
  })
}

# Matcher -> notifier work queue.
module "notification_queue" {
  source = "../../modules/sqs-queue"

  queue_name                 = "kite-signal-notification"
  visibility_timeout_seconds = 30
  enable_alarm               = true
  alarm_sns_topic_arn        = aws_sns_topic.ops_alerts.arn
}
