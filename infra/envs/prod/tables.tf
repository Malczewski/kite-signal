# Milestone 6: curated spot knowledge base. GSI1 supports "list spots by country".
module "spots_table" {
  source = "../../modules/dynamodb-table"

  table_name = "kite-signal-spots"
  attributes = [
    { name = "GSI1PK", type = "S" },
    { name = "GSI1SK", type = "S" },
  ]
  global_secondary_indexes = [
    {
      name      = "GSI1"
      hash_key  = "GSI1PK"
      range_key = "GSI1SK"
    },
  ]
}

# Milestone 9: channel-neutral user profiles (PROFILE item) + linked notification
# channels (CHANNEL#<type> items), keyed by an opaque userId.
module "users_table" {
  source = "../../modules/dynamodb-table"

  table_name = "kite-signal-users"
}

# Milestone 9: per-user, per-spot subscriptions + thresholds. GSI1 supports
# "who's subscribed to spot X", the preference-matcher's core access pattern.
module "subscriptions_table" {
  source = "../../modules/dynamodb-table"

  table_name = "kite-signal-subscriptions"
  attributes = [
    { name = "GSI1PK", type = "S" },
    { name = "GSI1SK", type = "S" },
  ]
  global_secondary_indexes = [
    {
      name      = "GSI1"
      hash_key  = "GSI1PK"
      range_key = "GSI1SK"
    },
  ]
}

# Milestone 9: dedup guard so a user isn't notified twice for the same spot/day.
# TTL auto-expires records ~7 days after they're written.
module "notification_dedup_table" {
  source = "../../modules/dynamodb-table"

  table_name         = "kite-signal-notification-dedup"
  ttl_attribute_name = "expiresAt"
}
