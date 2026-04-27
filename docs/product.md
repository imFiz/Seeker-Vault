# Product

> What Seeker Vault does, who it's for, and how each surface works.

---

## 1. Who it's for

| User | Pain |
|---|---|
| **Active crypto user** | Has 5+ wallets, dozens of API keys, screenshots of seed phrases scattered across devices |
| **Privacy-conscious traveller** | Carries passport scans, KYC selfies, legal PDFs that can't sit in iCloud / Google Drive |
| **DeFi power user** | Needs hardware-grade backup of seed phrases without buying 5 hardware wallets |
| **Solana Mobile / Seeker owner** | Wants apps that *use* Seed Vault and SKR utility, not just ports from other platforms |

---

## 2. Feature matrix

| Surface | Free | Premium ($9 one-time) |
|---|:---:|:---:|
| Encrypted notes | ✅ | ✅ |
| Encrypted secrets (passwords, API keys) | ✅ | ✅ |
| Encrypted seed phrases (12 / 18 / 24 words) | ✅ | ✅ |
| Protected keys (chain-tagged) | ✅ | ✅ |
| PIN + Biometric + Wallet auth | ✅ | ✅ |
| Wallet-signed `.svb` backups | ✅ | ✅ |
| Auto-lock (1 / 3 / 5 / 10 min) | ✅ | ✅ |
| Light / Dark theme | ✅ | ✅ |
| **Private Vault — 200 MB encrypted file storage** | ❌ | ✅ |
| **Inline image previews of encrypted files** | ❌ | ✅ |
| **Bulk file restore to Downloads/** | ❌ | ✅ |
| Cloud NFT Backup *(coming soon)* | ❌ | ✅ |

Premium is unlockable in **SOL** (~0.1054 SOL) or **SKR** (~538 SKR, **−10% discount**).

---

## 3. User flows

### 3.1 First-time setup

1. Launch app → onboarding triptych
2. Set a PIN (4–12 digits)
3. Optionally enable biometric unlock
4. Optionally connect Solana wallet (Phantom / Solflare / Seed Vault) for second factor + backup
5. Vault is ready

### 3.2 Daily unlock

1. Launch app → PIN gate
2. (If enabled) biometric prompt
3. (If enabled) wallet signature challenge
4. Vault unlocks → DEK derived in memory
5. After N minutes of inactivity → DEK is wiped, vault locks again

### 3.3 Backup

1. Settings → Backup → Export
2. App constructs deterministic challenge string
3. Wallet signs challenge (single MWA round-trip)
4. App derives backup key via HKDF, encrypts the entire vault
5. `.svb` file written to user-selected location (SAF picker)

### 3.4 Restore on a new device

1. Install app on new device
2. Set a fresh PIN
3. Settings → Backup → Import → pick `.svb` file
4. App re-signs the same deterministic challenge with the same wallet
5. Same backup key is derived → vault decrypts and rehydrates

**The wallet itself is the recovery key — no email, no support ticket, no recovery phrase to print.**

### 3.5 Premium unlock

1. Settings → Premium → Unlock
2. Choose payment: SOL or SKR (-10%)
3. Wallet approves transfer to publisher address
4. App verifies the on-chain transaction
5. Premium flag flips → Private Vault tab unlocks

### 3.6 Private Vault (Premium)

1. Authenticate (any combination of PIN / biometric / wallet)
2. Add file via system picker → file is encrypted with a unique IV before hitting disk
3. Files appear as tiles with optional inline preview
4. Export individual file → SAF picker for destination
5. Bulk-restore → all files written to `Downloads/SeekerVault/` in one tap

---

## 4. UX principles

1. **Never assume a network.** The app must function fully offline; only wallet signing requires connectivity, and only at user request.
2. **Never silently leak.** Clipboard auto-clears (30s after copy, 150ms after paste); logger filters secrets.
3. **The Save button never hides.** Keyboard-aware layout pushes the form, not the button.
4. **No "forgot password" flow.** It's a feature, not a bug — there's no party with the power to reset.
5. **Triple-factor optional, not mandatory.** A user with just a PIN is fine; the gates compose, they don't conflict.
6. **Edge-to-edge Android 15.** Full-bleed layouts that respect insets.
7. **Two languages, system-detected.** English + Russian. More coming.

---

## 5. Out of scope (intentionally)

| Not in this product | Why |
|---|---|
| Sending / receiving SOL / SPL transactions | Use Phantom or Solflare. We are a vault, not a wallet. |
| Token swaps / Jupiter integration | Same — out of scope. |
| Balance tracking / portfolio view | Same. |
| Cloud sync | Defeats the zero-knowledge model. Backup is user-controlled file. |
| Account system / login | Nothing to register, nothing to leak. |
| Telemetry / analytics / crash reporting | Defeats privacy promises. |
| Browser extension | Mobile-first product. Cross-device coordination via wallet-signed deltas is on the roadmap. |

---

## 6. What "done" looks like

A user opens the app, unlocks with PIN + fingerprint, copies a password to log into their bank, the clipboard clears 30 seconds later, the app auto-locks 5 minutes after. Their seed phrases, KYC PDFs, and API keys never leave the device. If they lose the phone, they install the app on a new one and restore their vault by signing a single message with their existing Solana wallet.

That's the entire product loop.
