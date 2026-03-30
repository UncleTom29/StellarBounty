#!/usr/bin/env bash
set -euo pipefail

# Resolve admin identity from Stellar CLI key store.
# Assumes an identity named "admin" already exists.
ADMIN_SECRET="$(stellar keys show admin)"
ADMIN_ADDR="$(stellar keys address admin)"

if [[ -z "${ADMIN_SECRET}" || -z "${ADMIN_ADDR}" ]]; then
  echo "Admin identity not found. Create it first with the Stellar CLI."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="testnet"

TOKEN_DIR="$ROOT_DIR/contract/token"
BOUNTY_DIR="$ROOT_DIR/contract/bounty"

TOKEN_WASM="$TOKEN_DIR/target/wasm32-unknown-unknown/release/stellar_bounty_token.wasm"
BOUNTY_WASM="$BOUNTY_DIR/target/wasm32-unknown-unknown/release/stellar_bounty.wasm"

echo "1. Building BNT token contract with Stellar tooling"
cd "$TOKEN_DIR"
stellar contract build

if [[ ! -f "$TOKEN_WASM" ]]; then
  echo "Token WASM not found at: $TOKEN_WASM"
  exit 1
fi

echo "2. Deploying BNT token contract"
TOKEN_ID="$(stellar contract deploy --wasm "$TOKEN_WASM" --source admin --network "$NETWORK")"

echo "3. Initializing BNT token contract"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  init \
  --admin "$ADMIN_ADDR" \
  --name "BountyToken" \
  --symbol "BNT"

echo "4. Building bounty contract with Stellar tooling"
cd "$BOUNTY_DIR"
stellar contract build

if [[ ! -f "$BOUNTY_WASM" ]]; then
  echo "Bounty WASM not found at: $BOUNTY_WASM"
  exit 1
fi

echo "5. Deploying bounty contract"
BOUNTY_ID="$(stellar contract deploy --wasm "$BOUNTY_WASM" --source admin --network "$NETWORK")"

echo "6. Initializing bounty contract"
stellar contract invoke \
  --id "$BOUNTY_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  init \
  --admin "$ADMIN_ADDR" \
  --token_contract "$TOKEN_ID"

echo "7. Registering bounty contract as token minter"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  set_minter \
  --admin "$ADMIN_ADDR" \
  --minter "$BOUNTY_ID"

echo "8. Minting initial BNT to admin"
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  mint \
  --admin "$ADMIN_ADDR" \
  --to "$ADMIN_ADDR" \
  --amount 1000000000000

echo
echo "Deployment complete"
echo "Bounty Contract: $BOUNTY_ID"
echo "BNT Token: $TOKEN_ID"
echo
echo "Add these to your .env file:"
echo "VITE_BOUNTY_CONTRACT=$BOUNTY_ID"
echo "VITE_TOKEN_CONTRACT=$TOKEN_ID"
echo "VITE_RPC_URL=https://soroban-testnet.stellar.org"
echo "VITE_HORIZON_URL=https://horizon-testnet.stellar.org"