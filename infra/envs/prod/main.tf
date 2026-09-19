# Milestone 2: hello-world Lambda, proving the lambda-function module + IAM + log group
# pattern end-to-end before any real pipeline resources are added.
module "hello_lambda" {
  source = "../../modules/lambda-function"

  function_name   = "kite-signal-hello"
  description     = "Hello-world Lambda proving the Terraform module + IAM + logging pattern."
  source_dir      = "${path.module}/../../../services/hello/dist"
  memory_size     = 128
  timeout_seconds = 10
}
