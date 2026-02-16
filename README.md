
# 🗳️ Voting DApp on Solana

>A decentralized, transparent, and secure voting platform built on the Solana blockchain. Empowering communities, organizations, and events to run tamper-proof polls with real-time, verifiable results.

---

## 🌟 Features

- 🗳️ **Create and Manage Polls:** Anyone can create a poll with multiple contestants
- 👤 **Add Contestants:** Add candidates to any poll
- ✅ **Cast Votes:** Users can vote securely and only once per poll
- 🔒 **On-Chain Security:** All votes and poll data are stored on Solana, ensuring transparency and immutability
- 📊 **Live Results:** See poll results update in real time
- 🦾 **Solana Integration:** Uses Anchor for the on-chain program and @solana/web3.js for frontend integration
- 🌐 **Modern UI:** Built with Next.js, Vite, and Tailwind CSS for a fast, responsive experience

---



## 🛠️ Tech Stack

- **Solana**: Blockchain platform for fast, low-cost transactions
- **Anchor**: Framework for Solana smart contracts
- **Next.js + Vite**: Modern React frontend
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type safety across the stack

---


## 🏛️ Architecture Diagram

```
      +-------------------+         +---------------------+         +---------------------+
      |                   |         |                     |         |                     |
      |   User Wallets    +<------->+   Frontend (React)  +<------->+  Solana Blockchain  |
      | (Phantom, etc.)   |         |  (Next.js, Vite)    |         |  (Anchor Program)   |
      |                   |         |                     |         |                     |
      +-------------------+         +---------------------+         +---------------------+
                    |                              |                               |
                    | 1. Connect Wallet            | 2. Create Poll, Vote,         | 3. Store/Fetch Polls,
                    |                              |    View Results               |    Votes, Results
                    |----------------------------->|-----------------------------> |
                    | <--------------------------- | <---------------------------- |
                    |   Transaction Signatures     |   On-chain Data               |
```

---

## 🏗️ User Flow Diagram

```
      +---------+        +----------------+        +---------------------+        +---------------------+
      |  User   +------->+  Connect Wallet+------->+   Create/Join Poll  +------->+   Cast Vote/View   |
      +---------+        +----------------+        +---------------------+        +---------------------+
                  ^                                                                              |
                  |                                                                              v
      +-------------------+                                                        +-------------------+
      |   View Results    |<-------------------------------------------------------+   Blockchain      |
      +-------------------+                                                        +-------------------+
```

---
```


## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Yarn or Bun
- Rust & Anchor CLI
- Solana CLI

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/voting-dapp-solana.git
cd voting-dapp-solana
```

### 2. Install dependencies

```bash
cd cast-vote-app
bun install # or yarn install
```

### 3. Configure Solana

```bash
solana config set --url devnet
anchor build
anchor deploy
```

### 4. Run the frontend

```bash
bun run dev # or yarn dev
```

---

---


## 🎥 Demo

- [Demo Video](#) <!-- Add your video link here -->
- [Live App](#) <!-- Add your live deployment link here -->

---


## 📁 Project Structure

- `cast-vote-app/` — Frontend (Next.js, Vite, Tailwind)
- `votingdapp_onchain/` — Solana Anchor program (Rust)
- `migrations/` — Anchor deployment scripts
- `tests/` — On-chain program tests

---


## 👥 Team

- [Your Name] (Project Lead, Full Stack)
- [Teammate 2] (Solana/Anchor Dev)
- [Teammate 3] (Frontend/UX)
- [Teammate 4] (QA/Docs)

---


## 💡 Business Case & Impact

This DApp can be used for:

- Community governance
- University elections
- Event polls
- DAO decision-making

By leveraging Solana, it ensures trust, transparency, and accessibility for all participants.

---


## 📚 Resources Used

- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Solana Mobile Developer Docs](https://docs.solanamobile.com/)
- [Superteam Nepal](https://twitter.com/SuperteamNepal)

---


## 📝 License

MIT

---


## 🌐 Share & Connect

- [Twitter](#) | [LinkedIn](#) <!-- Add your social links -->
- Build in public! #Solana #Nepal #Hackathon

---

<!--
For architecture and DFD diagrams, open the .drawio files in draw.io or compatible viewers. You may export them as PNG/SVG for GitHub rendering.
-->