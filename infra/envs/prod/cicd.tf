# Lets deploy.yml assume an AWS role via OIDC federation - no long-lived
# AWS access keys stored as GitHub secrets, nothing to rotate or leak.

# Thumbprint is derived from GitHub's live TLS cert rather than hardcoded, so it can't go
# stale (or be mistyped) if GitHub ever rotates their CA.
data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "kite-signal-github-actions-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        # AWS requires this trust policy be scoped on `sub` or `job_workflow_ref`
        # specifically (plain `repository`/`ref` conditions are rejected outright).
        # `job_workflow_ref` also avoids the numeric owner/repo IDs GitHub's immutable-ID
        # claims feature embeds into `sub` here (e.g. "repo:Malczewski@123/kite-signal@456:...")
        # and is more precise anyway - it pins to this exact workflow file, not just the branch.
        StringEquals = {
          "token.actions.githubusercontent.com:aud"              = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:job_workflow_ref" = "Malczewski/kite-signal/.github/workflows/deploy.yml@refs/heads/master"
        }
      }
    }]
  })
}

# Same accepted shortcut as the human Terraform IAM user (see docs/manual-setup.md): broad
# access to move fast solo, to be scoped down once the resource set stabilizes.
resource "aws_iam_role_policy_attachment" "github_actions_deploy_admin" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
