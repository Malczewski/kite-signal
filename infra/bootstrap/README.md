# infra/bootstrap

Creates the S3 bucket + DynamoDB table used as the remote state backend by every other
Terraform root under `infra/envs/*`. This is the one Terraform root that keeps **local**
state (`terraform.tfstate` in this directory) — it can't use the S3 backend it's
responsible for creating.

This is a one-time, manual, run-it-yourself step (see `../../docs/manual-setup.md`):

```sh
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars   # edit state_bucket_name to something globally unique
terraform init
terraform apply
```

Keep the local `terraform.tfstate` file safe (e.g. back it up somewhere private) — if
it's lost, the bucket/table still exist in AWS but Terraform will want to recreate them.
This root changes rarely, if ever, after the first apply.
