# infra/envs/prod

The single environment for kite-signal (see `docs/architecture-plan.md` for why there's no
separate `dev` yet). Uses the S3 bucket + DynamoDB lock table created once by
`infra/bootstrap`.

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

This will move to a GitHub Actions `deploy.yml` pipeline (build -> apply) once the manual
loop gets tedious — see the phased build order in `docs/architecture-plan.md`.
