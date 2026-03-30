# 🎯 StellarBounty

A decentralized bounty board on Stellar Testnet. Post tasks with
XLM rewards locked in a Soroban smart contract. Workers claim,
complete, and get paid automatically on approval. Top completers
earn BNT tokens via inter-contract mint calls.


---

## 🌐 Live Demo
> https://stellarbounty.vercel.app

---

## 📋 User Feedback Form
We are actively collecting feedback to improve StellarBounty.

👉 **[Fill out our feedback form here](Yhttps://docs.google.com/forms/d/e/1FAIpQLSewpGC1t-CzzgCxmn_tkAjTV34nUzQswGus7kjOctnNEUVmqA/viewform)**

Fields collected: Name, Email, Wallet Address,
Product Rating (1–5), Feature feedback, Improvement suggestions.

---

## 📊 Feedback & Analytics

All user responses are exported and tracked in our Excel sheet:

📁 **[View Feedback Excel Sheet](https://docs.google.com/spreadsheets/d/1W2RaWjKHnpbr3ynN6whrC1BIHXyNMgc_Sa__kRhdvO8/edit?usp=sharing)**

| Field           | Purpose                              |
|-----------------|--------------------------------------|
| Name & Email    | User identification & follow-up      |
| Wallet Address  | On-chain activity correlation        |
| Rating (1–5)    | Overall satisfaction tracking        |
| Feature Used    | Usage pattern analysis               |
| Improvements    | Roadmap prioritization input         |
| Mainnet Intent  | Go-to-market signal                  |

---

## ✨ Features

- 🔐 Post bounties with XLM locked in escrow
- 👷 Workers claim open bounties
- ✅ Posters approve to auto-release payment
- 🪙 BNT tokens minted to completers (inter-contract)
- ⭐ Multi-wallet via StellarWalletsKit
- 📡 Real-time event feed
- 🚀 CI/CD via GitHub Actions → Vercel
- 📱 Mobile-first responsive design

---

## 📐 Architecture

See full architecture document:
📁 **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

---

## 📜 Contract Addresses (Testnet)

| Contract        | Address                              |
|-----------------|--------------------------------------|
| BountyContract  | `CDTXKJNDS4Y4EQYHK6CPDUYWERGKN4QB7STNPEMCMQC4H5XD3BES76QY`            |
| BNT Token       | `CD4TM7ET64UZAQZLHO5RHCWOOERKTGGXZYI67E7OLGCP4AA4UGBTOLGK`             |



## ⚙️ Setup
```bash
# 1. Clone and install
git clone https://github.com/uncletom29/stellarbounty
cd stellarbounty
npm install

# 2. Install Stellar CLI
cargo install --locked stellar-cli

# 3. Generate and fund testnet account
stellar keys generate admin --network testnet
stellar keys fund admin --network testnet

# 4. Deploy contracts
export ADMIN_SECRET=$(stellar keys show admin)
export ADMIN_ADDR=$(stellar keys address admin)
bash scripts/deploy.sh

# 5. Configure environment
cp .env.example .env
# Open .env and paste the printed contract IDs

# 6. Run locally
npm run dev
# Open http://localhost:5173
```

---

## 🧪 Tests
```bash
npm test
```

Expected output:
```
✓ src/test/cache.test.js (5 tests)
✓ src/test/errors.test.js (7 tests)

Test Files: 2 passed
Tests:      12 passed
```

---

## 🚀 Deploy
```bash
npm run build
npx vercel --prod
```

Set these GitHub secrets for CI/CD auto-deploy:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## 📸 Screenshots

### Mobile View
> Add screenshot here

### CI/CD Pipeline
> Add GitHub Actions screenshot here

### Bounty Approval TX
> Add Stellar Expert TX screenshot here
---

## 📁 Project Structure
```
stellarbounty/
├── .github/workflows/ci.yml   # CI/CD pipeline
├── contract/
│   ├── token/src/lib.rs       # BNT token contract
│   └── bounty/src/lib.rs      # Bounty escrow contract
├── docs/
│   ├── ARCHITECTURE.md        # Full architecture doc
├── src/
│   ├── config.js
│   ├── utils/
│   │   ├── cache.js
│   │   ├── errors.js
│   │   └── contract.js
│   ├── hooks/
│   │   ├── useWallet.js
│   │   └── useBounty.js
│   ├── test/
│   │   ├── cache.test.js
│   │   └── errors.test.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── scripts/deploy.sh
├── .env.example
└── README.md
```

---

## 🤝 Contributing

1. Fork the repo
2. Create branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: your feature"`
4. Push and open a PR

---

## 📄 License
MIT