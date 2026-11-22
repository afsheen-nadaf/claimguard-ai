#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <cognito-user-pool-id>" >&2
  exit 2
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required." >&2
  exit 1
fi

USER_POOL_ID="$1"

read -r -s -p "Permanent password for adjuster@demo.com: " ADJUSTER_PASSWORD
printf '\n'
read -r -s -p "Permanent password for claimant@demo.com: " CLAIMANT_PASSWORD
printf '\n'

create_or_confirm_user() {
  local email="$1"
  local group="$2"
  local password="$3"

  if ! AWS_PAGER="" aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" >/dev/null 2>&1; then
    AWS_PAGER="" aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$email" \
      --user-attributes "Name=email,Value=$email" "Name=email_verified,Value=true" \
      --message-action SUPPRESS >/dev/null
  fi

  AWS_PAGER="" aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --password "$password" \
    --permanent

  AWS_PAGER="" aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --group-name "$group"
}

create_or_confirm_user "adjuster@demo.com" "adjuster" "$ADJUSTER_PASSWORD"
create_or_confirm_user "claimant@demo.com" "claimant" "$CLAIMANT_PASSWORD"

unset ADJUSTER_PASSWORD CLAIMANT_PASSWORD
echo "Demo users are ready."
