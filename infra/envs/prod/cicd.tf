# Milestone 14: lets deploy.yml assume an AWS role via OIDC federation - no long-lived
# AWS access keys stored as GitHub secrets, nothing to rotate or leak.

# GitHub's OIDC thumbprint has been stable for years; if GitHub ever rotates their TLS CA,
# this value needs updating (see https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect).
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea"]
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
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Restricts to workflow runs triggered on main - PRs (any other ref) can't assume this.
          "token.actions.githubusercontent.com:sub" = "repo:Malczewski/kite-signal:ref:refs/heads/main"
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
