# SMPD FINAL — Solana Discord Economy

Production-oriented baseline for a custodial Solana Discord wallet.

## Included
- Automatic Solana wallet per Discord user
- Encrypted private keys (AES-256-GCM)
- On-chain SOL deposit scanner using finalized transactions
- Automatic deposit credit with duplicate protection
- SOL balance + live IDR estimate
- Internal `/tip` and `/give`
- `/rain` to active members
- Persistent button-based `/giveaway`
- `/history`
- `/withdraw` on-chain SOL withdrawal
- Withdrawal cooldown and min/max limits
- Admin `/smpd admin` commands
- SQLite WAL + transaction ledger
- Emergency freeze
- Audit log
- Startup reconciliation of pending withdrawals

## Important security
This is a real-money custodial system. Do NOT use the example master key. Generate a long random secret and store it as a hosting secret. Do not commit `.env` or the SQLite database.

For serious production funds, put key encryption behind a KMS/HSM/secret manager and use a dedicated paid Solana RPC provider. Start with small amounts and test on Solana devnet before mainnet.

## Setup
1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env`.
4. Set Discord token/client ID, RPC URL and a strong MASTER_KEY.
5. Put your Discord user ID in ADMIN_USER_IDS for admin commands.
6. `npm run register`
7. `npm start`

For fast command registration in one server, set DISCORD_GUILD_ID. Remove it for global registration.

## Commands
User:
- `/wallet`
- `/balance`
- `/deposit`
- `/withdraw address amount`
- `/tip user amount`
- `/give user amount`
- `/rain amount`
- `/giveaway amount minutes`
- `/history`

Admin:
- `/smpd admin freeze`
- `/smpd admin unfreeze`
- `/smpd admin status`
- `/smpd admin credit user amount` (manual internal credit; audit logged)
- `/smpd admin debit user amount` (manual internal debit; audit logged)

## Deposit model
Each user receives a unique Solana address. The worker scans finalized signatures for that address, loads each transaction, calculates the wallet's net lamport increase and credits only positive finalized net increases. Every signature is recorded once.

## Internal transfers
Tip/Give/Rain do NOT move SOL on-chain. They move the user's custodial ledger balance. This avoids unnecessary network fees.

## Withdrawal model
Withdrawals are real Solana transfers from the user's custodial wallet. The requested amount is reserved in the database before broadcast. A pending withdrawal is reconciled after restart so a crash cannot silently cause a second spend.

## IDR
IDR is display-only and is fetched from the configured price API. It is not a second cash balance.
