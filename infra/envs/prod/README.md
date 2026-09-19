# infra/envs/prod

The single environment for kite-signal — no separate `dev` yet, since there are no paying
users to protect and no real dev-env value at this scale. Uses the S3 bucket + DynamoDB lock
table created once by `infra/bootstrap`.

First-time setup:

```sh
cp backend.hcl.example backend.hcl   # fill in the real bucket name from infra/bootstrap's output
terraform init -backend-config=backend.hcl
```

Lambda source must be built **before** `terraform plan`/`apply`, since Terraform zips
whatever is already in each service's `dist/` directory:

```sh
npm run build:services   # builds every services/* Lambda via esbuild
terraform plan
terraform apply
```

After the first apply, see `docs/manual-setup.md` for the one-time steps that can't be
Terraform-managed: setting the real Telegram bot token / webhook secret into SSM, and
registering the webhook URL with Telegram.

`.github/workflows/deploy.yml` builds, tests, and applies Terraform automatically on every
push to `master` (via GitHub OIDC — see `cicd.tf`). The manual `terraform apply` loop above is
the fallback/local-dev path, not the primary deploy mechanism.

## Estimated cost

At ~100-200 spots checked every few hours, small subscriber count:

| Component | Est. monthly cost | Notes |
|---|---|---|
| Lambda (invocations + compute) | ~$0 | Free tier: 1M requests + 400k GB-s/month; won't come close |
| DynamoDB (on-demand) | ~$0-1 | Tiny item counts/request volume; idle = $0 |
| SQS | ~$0 | Free tier 1M requests/month |
| EventBridge (bus + scheduler) | ~$0 | Scheduler free tier 14M invocations/month; bus $1/million events |
| API Gateway (HTTP API, webhook) | ~$0 | Only fires on real Telegram interactions |
| CloudWatch Logs (14-day retention) | ~$0.50-2 | Retention cap is the key lever if this creeps up |
| CloudWatch alarms + 1 dashboard | ~$1-3 | ~6-10 alarms at $0.10/alarm/month; dashboard free under 3 |
| X-Ray tracing | ~$0 | Well within 100k free traces/month |
| S3 (Terraform state + deploy artifacts) | ~$0-1 | Negligible |
| **Total** | **~$2-8/month** | |

Watch items that could grow unexpectedly: CloudWatch Logs without a retention cap (mitigated —
14-day cap is the default in the `lambda-function` module, not opt-in), a paid second forecast
provider if one is added later (Open-Meteo is free; not all providers are), and a poison-pill
SQS message retrying indefinitely without a DLQ (mitigated — DLQ is mandatory in the
`sqs-queue` module). The `monthly_budget_usd` AWS Budgets alarm (`observability.tf`) is the
backstop for anything not explicitly guarded against.
