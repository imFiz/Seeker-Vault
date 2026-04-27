# Roadmap

> What's shipping next, and why. Updated 2026-04.

---

## 🟢 Now — v1.0 (shipped)

- ✅ PIN + Biometric + Wallet (MWA) triple authentication
- ✅ AES-256-GCM vault with unique IV per record (`gcm1:` versioned)
- ✅ PBKDF2-SHA256 600 000 iterations (OWASP-compliant)
- ✅ HKDF-SHA256 wallet-signed `.svb` v3 backups
- ✅ 200 MB encrypted Private Vault (Premium)
- ✅ Inline image previews, bulk restore, SAF export
- ✅ EN + RU localization
- ✅ Edge-to-edge Android 15 layout
- ✅ Reproducible build with published SHA-256
- ✅ Solana dApp Store submission (Release NFT minted)
- ✅ Source-available license, public GitHub repo

---

## 🟡 Next — v1.1 (Q3 2026)

### Cloud NFT Backup
- Encrypted backup blob pinned to IPFS / Arweave
- On-chain NFT pointer holds the storage URI + integrity hash
- Solves "lost phone, lost vault" without compromising zero-knowledge
- User can reattach to backup on any device by signing with the same wallet

### Public trust stack
- 📄 Threat model document (this repo, `docs/architecture.md` deepened)
- 🐛 Public bug bounty (Immunefi-style tiers)
- 🔍 Independent code review of `crypto.ts` + `backupCrypto.ts`
- 💰 Reserve for full tier-1 audit (OtterSec / Halborn) once Premium revenue covers it

### SKR payment polish
- On-chain receipt NFTs for every Premium purchase (SOL or SKR)
- Cleaner SKR balance check + price feed in the paywall
- Featured-slot coordination with Solana Mobile

---

## 🟠 Later — v1.2 / v2.0 (Q4 2026 +)

### Cross-device sync (wallet-signed deltas)
- Device A produces a CRDT delta of vault changes, signs with wallet
- Device B verifies the signature, applies the delta
- Server-free sync — the wallet is the auth root, the deltas are end-to-end encrypted
- No central coordinator, no "sign in to sync" account

### iOS port
- Capacitor → Swift bridge for the SAF-equivalent (Files / iCloud-Drive picker)
- Same crypto core (Web Crypto API works identically on WKWebView)
- App Store distribution via the same publisher

### Shamir's Secret Sharing recovery
- Optional: split a high-entropy "emergency key" into N-of-M shares
- Distribute shares among trusted parties (lawyer, family, vault) for inheritance
- Reconstruction requires M shares, never the developer's involvement

### Localization expansion
- Turkish, Spanish, Portuguese-BR (Solana Mobile growth markets)

### Enterprise / family vaults
- Multi-user access to a shared vault under role-based permissions
- Same crypto, additional access-control layer

---

## ❌ Not on the roadmap

These are **explicit non-goals** — not "later," but "no":

| Not planned | Reason |
|---|---|
| Sending / receiving SOL or SPL transactions | Vault, not a wallet. |
| Token swaps / Jupiter integration | Out of scope. |
| Cloud sync via our backend | We don't have one. |
| Free Premium tier | Premium funds the audit + Cloud NFT Backup. |
| Telemetry / analytics | Defeats the privacy promise. |
| Browser extension as a product | Mobile-first. Cross-device coordination via wallet-signed deltas instead. |

---

## How priorities shift

This roadmap is grant- and revenue-driven, not VC-driven:

- **Cloud NFT Backup** moves up if user feedback shows "lost phone, lost vault" is the #1 friction point.
- **Tier-1 audit** moves up the moment Premium revenue covers it (~250 paying users at $9 = ~$2K monthly = audit-fundable in 3–4 months).
- **iOS port** moves up only if Solana Mobile expands into iOS-friendly distribution channels.
- **Cross-device sync** is the highest-complexity feature; will not ship until Cloud NFT Backup proves the encrypted-blob-on-chain pattern works end-to-end.

---

## Current focus (next 90 days)

If the Solana Mobile Builder Grant lands:

1. **Day 0–30** — dApp Store launch + paid creative push targeting Seeker owners
2. **Day 20–70** — Public trust stack (threat model doc + bug bounty + paid focused code review)
3. **Day 60–90** — Cloud NFT Backup v1 (v1.1.0 release)

KPI: **150 paying Premium unlocks in 90 days, ≥ 30% paid in SKR.**
