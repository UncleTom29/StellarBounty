#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${VITE_BOUNTY_CONTRACT:?VITE_BOUNTY_CONTRACT must be set in .env}"

HORIZON_URL="${VITE_HORIZON_URL:-https://horizon-testnet.stellar.org}"
ADMIN_ALIAS="${ADMIN_ALIAS:-admin}"
BOUNTY_ID="$VITE_BOUNTY_CONTRACT"
STAMP="$(date +%Y%m%d%H%M%S)"
REPORT_FILE="$ROOT_DIR/seed-report-$STAMP.txt"

json_str() {
  printf '"%s"' "$1"
}

xlm_from_stroops() {
  awk "BEGIN { printf \"%.7f\", $1 / 10000000 }"
}

find_alias() {
  local prefix="$1"
  stellar keys ls 2>/dev/null | rg "^${prefix}-" | tail -n 1 || true
}

ensure_alias() {
  local prefix="$1"
  local alias

  alias="$(find_alias "$prefix")"
  if [ -n "$alias" ]; then
    printf '%s\n' "$alias"
    return 0
  fi

  alias="$prefix-$STAMP"
  stellar keys generate "$alias" >/dev/null
  printf '%s\n' "$alias"
}

fund_with_faucet() {
  local addr="$1"
  curl -fsS "https://friendbot.stellar.org/?addr=$addr" >/dev/null
}

account_exists() {
  local addr="$1"
  curl -fsS "$HORIZON_URL/accounts/$addr" >/dev/null
}

invoke_write() {
  local contract_id="$1"
  local source="$2"
  shift 2
  stellar contract invoke \
    --id "$contract_id" \
    --source "$source" \
    --network testnet \
    --send yes \
    -- "$@"
}

invoke_read() {
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source "$ADMIN_ALIAS" \
    --network testnet \
    --send no \
    -- "$@"
}

POSTER_1="$(ensure_alias 'sb-poster-1')"
POSTER_2="$(ensure_alias 'sb-poster-2')"
POSTER_3="$(ensure_alias 'sb-poster-3')"
WORKER_1="$(ensure_alias 'sb-worker-1')"
WORKER_2="$(ensure_alias 'sb-worker-2')"
WORKER_3="$(ensure_alias 'sb-worker-3')"

ADMIN_ADDR="$(stellar keys address "$ADMIN_ALIAS")"

POSTER_1_ADDR="$(stellar keys address "$POSTER_1")"
POSTER_2_ADDR="$(stellar keys address "$POSTER_2")"
POSTER_3_ADDR="$(stellar keys address "$POSTER_3")"
WORKER_1_ADDR="$(stellar keys address "$WORKER_1")"
WORKER_2_ADDR="$(stellar keys address "$WORKER_2")"
WORKER_3_ADDR="$(stellar keys address "$WORKER_3")"

echo "Ensuring 6 seed identities are funded..."
for alias in \
  "$POSTER_1" "$POSTER_2" "$POSTER_3" \
  "$WORKER_1" "$WORKER_2" "$WORKER_3"
do
  addr="$(stellar keys address "$alias")"
  if ! account_exists "$addr"; then
    fund_with_faucet "$addr"
  fi
  sleep 1
done

START_COUNT="$(invoke_read "$BOUNTY_ID" bounty_count | tail -n 1)"
NEXT_ID="$START_COUNT"

NEXT_ID=$((NEXT_ID + 1))
ID_1="$NEXT_ID"
echo "Posting bounty $ID_1 (open)..."
invoke_write "$BOUNTY_ID" "$POSTER_1" \
  post_bounty \
  --poster "$POSTER_1_ADDR" \
  --title "$(json_str 'Design landing hero copy')" \
  --description "$(json_str 'Create sharper hero messaging for the StellarBounty landing screen.')" \
  --reward_xlm 250000000 >/dev/null

NEXT_ID=$((NEXT_ID + 1))
ID_2="$NEXT_ID"
echo "Posting bounty $ID_2 (claimed)..."
invoke_write "$BOUNTY_ID" "$POSTER_2" \
  post_bounty \
  --poster "$POSTER_2_ADDR" \
  --title "$(json_str 'Fix wallet connect edge case')" \
  --description "$(json_str 'Handle modal-close and reconnect errors in the wallet flow.')" \
  --reward_xlm 300000000 >/dev/null
invoke_write "$BOUNTY_ID" "$WORKER_1" \
  claim_bounty \
  --worker "$WORKER_1_ADDR" \
  --bounty_id "$ID_2" >/dev/null

NEXT_ID=$((NEXT_ID + 1))
ID_3="$NEXT_ID"
echo "Posting bounty $ID_3 (open)..."
invoke_write "$BOUNTY_ID" "$POSTER_3" \
  post_bounty \
  --poster "$POSTER_3_ADDR" \
  --title "$(json_str 'Ship README cleanup')" \
  --description "$(json_str 'Tighten setup docs, deployment notes, and test instructions.')" \
  --reward_xlm 120000000 >/dev/null

NEXT_ID=$((NEXT_ID + 1))
ID_4="$NEXT_ID"
echo "Posting bounty $ID_4 (cancelled)..."
invoke_write "$BOUNTY_ID" "$POSTER_1" \
  post_bounty \
  --poster "$POSTER_1_ADDR" \
  --title "$(json_str 'Audit bounty list sorting')" \
  --description "$(json_str 'Review the list sort order and filter behavior for regressions.')" \
  --reward_xlm 180000000 >/dev/null
invoke_write "$BOUNTY_ID" "$POSTER_1" \
  cancel_bounty \
  --poster "$POSTER_1_ADDR" \
  --bounty_id "$ID_4" >/dev/null

NEXT_ID=$((NEXT_ID + 1))
ID_5="$NEXT_ID"
echo "Posting bounty $ID_5 (claimed)..."
invoke_write "$BOUNTY_ID" "$POSTER_2" \
  post_bounty \
  --poster "$POSTER_2_ADDR" \
  --title "$(json_str 'Build contract explorer links')" \
  --description "$(json_str 'Add copyable contract IDs and explorer deep links to the dashboard.')" \
  --reward_xlm 400000000 >/dev/null
invoke_write "$BOUNTY_ID" "$WORKER_2" \
  claim_bounty \
  --worker "$WORKER_2_ADDR" \
  --bounty_id "$ID_5" >/dev/null

NEXT_ID=$((NEXT_ID + 1))
ID_6="$NEXT_ID"
echo "Posting bounty $ID_6 (claimed)..."
invoke_write "$BOUNTY_ID" "$POSTER_3" \
  post_bounty \
  --poster "$POSTER_3_ADDR" \
  --title "$(json_str 'Add dashboard loading states')" \
  --description "$(json_str 'Polish stats loading, transaction progress, and empty-state feedback.')" \
  --reward_xlm 550000000 >/dev/null
invoke_write "$BOUNTY_ID" "$WORKER_3" \
  claim_bounty \
  --worker "$WORKER_3_ADDR" \
  --bounty_id "$ID_6" >/dev/null

FINAL_COUNT="$(invoke_read "$BOUNTY_ID" bounty_count | tail -n 1)"
TOTAL_PAID_STROOPS="$(invoke_read "$BOUNTY_ID" total_paid | tail -n 1)"
TOTAL_PAID_XLM="$(xlm_from_stroops "$TOTAL_PAID_STROOPS")"

cat > "$REPORT_FILE" <<EOF
StellarBounty Seed Report
Generated at: $STAMP

Contracts
- Bounty: $BOUNTY_ID
- Admin: $ADMIN_ADDR

Seed Accounts
- $POSTER_1: $POSTER_1_ADDR
- $POSTER_2: $POSTER_2_ADDR
- $POSTER_3: $POSTER_3_ADDR
- $WORKER_1: $WORKER_1_ADDR
- $WORKER_2: $WORKER_2_ADDR
- $WORKER_3: $WORKER_3_ADDR

Seeded Bounties
- #$ID_1 open
- #$ID_2 claimed
- #$ID_3 open
- #$ID_4 cancelled
- #$ID_5 claimed
- #$ID_6 claimed

Dashboard Summary
- bounty_count: $FINAL_COUNT
- total_paid_stroops: $TOTAL_PAID_STROOPS
- total_paid_xlm: $TOTAL_PAID_XLM
- note: approvals were skipped, so total_paid remains unchanged
EOF

echo
echo "Seed complete."
echo "Bounty count: $FINAL_COUNT"
echo "Total paid: $TOTAL_PAID_XLM XLM"
echo "Report: $REPORT_FILE"
echo
cat "$REPORT_FILE"
