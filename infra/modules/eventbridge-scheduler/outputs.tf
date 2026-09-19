output "schedule_name" {
  value = aws_scheduler_schedule.this.name
}

output "role_arn" {
  value = aws_iam_role.scheduler.arn
}
