# 🎯 StellarBounty

Decentralized bounty board on Stellar Testnet.

## Live Demo

Coming soon after deployment.

## CI/CD Badge

[![CI](https://github.com/YOUR_GITHUB_USERNAME/stellarbounty/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/stellarbounty/actions/workflows/ci.yml)

## How It Works

1. Post a bounty with an XLM-denominated reward target.
2. A worker claims the bounty and completes the task.
3. The poster approves the result, updating bounty state and minting BNT through an inter-contract call.

## Contracts

- Bounty Contract: `YOUR_BOUNTY_CONTRACT_ID`
- BNT Token: `YOUR_TOKEN_CONTRACT_ID`
- Inter-contract call TX hash: `YOUR_APPROVAL_TX_HASH`

## Setup

```bash
npm install
cargo install --locked stellar-cli
rustup target add wasm32v1-none
stellar keys generate admin --network testnet
stellar keys fund admin --network testnet
export ADMIN_SECRET=$(stellar keys show admin)
export ADMIN_ADDR=$(stellar keys address admin)
bash scripts/deploy.sh
cp .env.example .env
# open .env and paste the printed contract IDs
npm run dev
```

## Tests

```bash
npm test
```

9+ tests run across 2 suites for cache and error handling.

## Deploy Frontend

```bash
npm run build && npx vercel --prod
```

## Screenshots

- Mobile view placeholder
- CI pipeline placeholder
- Bounty approval TX placeholder

## Suggested Commits

- `feat: init project structure and config`
- `feat: implement BNT token Soroban contract`
- `feat: implement bounty escrow contract`
- `feat: add inter-contract BNT mint on approval`
- `feat: implement frontend wallet integration`
- `feat: build bounty list and post form UI`
- `feat: add transaction status and event feed`
- `ci: add GitHub Actions CI/CD pipeline`
- `fix: handle edge cases and error states`
- `docs: complete README with setup instructions`
