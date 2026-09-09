output "hello_lambda_function_name" {
  value = module.hello_lambda.function_name
}

output "hello_lambda_function_arn" {
  value = module.hello_lambda.function_arn
}

output "spots_table_name" {
  value = module.spots_table.table_name
}

output "users_table_name" {
  value = module.users_table.table_name
}

output "subscriptions_table_name" {
  value = module.subscriptions_table.table_name
}

output "notification_dedup_table_name" {
  value = module.notification_dedup_table.table_name
}

output "event_bus_name" {
  value = aws_cloudwatch_event_bus.kite_signal_events.name
}

output "telegram_webhook_endpoint" {
  description = "Base API endpoint - the webhook URL is this + /telegram/webhook"
  value       = module.telegram_webhook_api.endpoint
}

output "ops_alerts_topic_arn" {
  value = aws_sns_topic.ops_alerts.arn
}

output "github_actions_deploy_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}
