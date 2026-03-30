# StellarBounty — Architecture Document

## System Overview

StellarBounty is a decentralized bounty board built on Stellar Testnet.
Users post XLM-backed tasks, workers claim and complete them, and the
smart contract auto-pays on approval. Top completers earn BNT tokens
via an inter-contract mint call.

---

## High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                     USER BROWSER                        │
│                                                         │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │  React 18    │      │   StellarWalletsKit          │ │
│  │  + Vite      │◄────►│   (Freighter/xBull/Lobstr)  │ │
│  └──────┬───────┘      └──────────────────────────────┘ │
│         │                                               │
│  ┌──────▼───────────────────────────────────────┐      │
│  │            Frontend Layers                    │      │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │      │
│  │  │ config  │ │  cache   │ │  errors util  │  │      │
│  │  │   .js   │ │   .js    │ │     .js       │  │      │
│  │  └─────────┘ └──────────┘ └───────────────┘  │      │
│  │  ┌──────────────────────────────────────────┐ │      │
│  │  │           contract.js                    │ │      │
│  │  │  sim() prep() submit() waitTx() bustAll()│ │      │
│  │  └──────────────────────────────────────────┘ │      │
│  │  ┌────────────────┐ ┌────────────────────────┐│      │
│  │  │ useWallet.js   │ │    useBounty.js        ││      │
│  │  │ connect/sign/  │ │  post/claim/approve/   ││      │
│  │  │ disconnect     │ │  cancel + TX lifecycle ││      │
│  │  └────────────────┘ └────────────────────────┘│      │
│  └──────────────────────────────────────────────┘      │
└─────────────────┬───────────────────────────────────────┘
                  │  HTTPS / JSON-RPC
     ┌────────────▼────────────────────────────────┐
     │         Stellar Network Layer               │
     │                                             │
     │  ┌─────────────────┐  ┌──────────────────┐  │
     │  │  Soroban RPC    │  │  Horizon REST    │  │
     │  │  (Testnet)      │  │  API (Testnet)   │  │
     │  │  simulate TX    │  │  XLM balances    │  │
     │  │  prepare TX     │  │  account info    │  │
     │  │  submit TX      │  │                  │  │
     │  │  poll status    │  │                  │  │
     │  └────────┬────────┘  └──────────────────┘  │
     └───────────┼─────────────────────────────────┘
                 │
     ┌───────────▼─────────────────────────────────┐
     │         Smart Contract Layer                │
     │                                             │
     │  ┌───────────────────────────────────────┐  │
     │  │        BountyContract (Soroban)        │  │
     │  │                                       │  │
     │  │  init()         post_bounty()         │  │
     │  │  claim_bounty() approve_bounty()      │  │
     │  │  cancel_bounty() get_bounties()       │  │
     │  │  total_paid()   bounty_count()        │  │
     │  │                                       │  │
     │  │  ┌─────────────────────────────────┐  │  │
     │  │  │   INTER-CONTRACT CALL           │  │  │
     │  │  │   on approve_bounty():          │  │  │
     │  │  │   env.invoke_contract →         │  │  │
     │  │  │   BNTToken.mint(worker, amt)    │  │  │
     │  │  └─────────────────────────────────┘  │  │
     │  └───────────────────────────────────────┘  │
     │                    │                        │
     │  ┌─────────────────▼─────────────────────┐  │
     │  │         BNTToken Contract              │  │
     │  │                                       │  │
     │  │  init()   mint()   transfer()         │  │
     │  │  balance() symbol() name()            │  │
     │  └───────────────────────────────────────┘  │
     └─────────────────────────────────────────────┘
```

---

## Data Flow

### Post Bounty Flow
```
User fills form → PostForm validates input
→ buildPostBounty(pk, title, desc, rewardXLM)
→ prep() builds & prepares Soroban TX
→ useWallet.sign(xdr) → Freighter signs
→ submitTx(signedXDR) → Soroban RPC
→ waitTx(hash) polls until SUCCESS
→ bustAll(pk) clears cache
→ getBounties() refreshes list
→ UI updates with new bounty
```

### Claim → Approve → Pay Flow
```
Worker clicks Claim → buildClaimBounty(pk, id)
→ sign → submit → confirm
→ Bounty status: Open → Claimed

Poster clicks Approve → buildApproveBounty(pk, id)
→ sign → submit → confirm
→ BountyContract.approve_bounty():
    ├── set status = Completed
    ├── INTER-CONTRACT: BNTToken.mint(worker, reward/10)
    └── emit APPROVED event
→ Worker receives BNT tokens
→ TotalPaid += rewardXLM
```

---

## Caching Strategy

| Data          | Cache Key      | TTL   | Busted On        |
|---------------|----------------|-------|------------------|
| Bounty list   | bounties       | 10s   | Any TX success   |
| Bounty count  | count          | 8s    | Post/cancel      |
| Total paid    | paid           | 10s   | Approve          |
| XLM balance   | xb:{pk}        | 12s   | Any TX success   |
| BNT balance   | tb:{pk}        | 12s   | Approve          |

---

## Transaction Lifecycle States
```
IDLE → BUILD → SIGN → SEND → CONFIRM → OK
                              ↓
                            FAIL
```

| State   | Description                          |
|---------|--------------------------------------|
| IDLE    | No active transaction                |
| BUILD   | Preparing & simulating TX on Soroban |
| SIGN    | Awaiting wallet signature            |
| SEND    | Submitting signed TX to network      |
| CONFIRM | Polling getTransaction for result    |
| OK      | TX confirmed on-chain                |
| FAIL    | TX failed or user rejected           |

---

## Error Handling

| Error Type | Trigger                        | User Message                        |
|------------|--------------------------------|-------------------------------------|
| WALLET     | Wallet not installed           | Install a Stellar wallet extension  |
| REJECTED   | User cancels signing           | Transaction cancelled               |
| BALANCE    | Insufficient XLM               | Fund account via testnet faucet     |
| LIQUIDITY  | Contract insufficient funds    | Insufficient contract funds         |
| CONTRACT   | Soroban simulation error       | Contract error (truncated message)  |
| NETWORK    | Any other failure              | Network error (truncated message)   |

---

## CI/CD Pipeline
```
Git Push to main/develop
        │
        ▼
┌───────────────────┐
│   GitHub Actions  │
│                   │
│  Job 1: test      │
│  ├── npm ci       │
│  ├── npm test     │
│  └── npm build    │
│                   │
│  Job 2: deploy    │
│  (main only)      │
│  ├── npm build    │
│  └── vercel prod  │
└───────────────────┘
        │
        ▼
   Vercel CDN
  (Production)
```

---

## Tech Stack Summary

| Layer         | Technology                        |
|---------------|-----------------------------------|
| Frontend      | React 18, Vite 5                  |
| Wallet        | StellarWalletsKit (multi-wallet)  |
| Blockchain    | Stellar Testnet                   |
| Contracts     | Soroban (Rust)                    |
| RPC           | Soroban RPC + Horizon REST        |
| Testing       | Vitest + Testing Library          |
| CI/CD         | GitHub Actions + Vercel           |
| Caching       | In-memory TTL Map                 |

---

## Contract Storage Layout

### BountyContract
| Key               | Type      | Description              |
|-------------------|-----------|--------------------------|
| Bounty(u32)       | Bounty    | Individual bounty data   |
| BountyCount       | u32       | Total bounties posted    |
| TokenContract     | Address   | BNT token contract addr  |
| Admin             | Address   | Contract admin           |
| TotalPaid         | i128      | Total XLM paid out       |

### BNTToken
| Key   | Type        | Description         |
|-------|-------------|---------------------|
| State | TokenState  | Full token state    |
