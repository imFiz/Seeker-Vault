# Seeker Vault — Pitch Deck (Text Version)

> Descriptive companion to the visual pitch deck. Same 8-slide narrative arc, with verifiable claims, accurate technical statements, and no marketing hyperbole.
>
> **Visual deck:** [Google Drive PDF](https://drive.google.com/file/d/1UcM7HbW7gq96kbXk2STNiQm_njrm1E7y/view)
> **Repository:** https://github.com/imFiz/Seeker-Vault
> **Demo:** https://www.youtube.com/shorts/Udxx0owO-zA

---

## Slide 1 — Cover

**Title:** Seeker Vault
**Tagline:** Your Secrets. Your Hardware. Your Control.
**One-liner:** A source-available, zero-knowledge encrypted vault built natively for the Solana Seeker device.

**Status badges (factually accurate):**
- 📦 v1.0.2 signed APK — published on GitHub Releases
- 🔍 Solana dApp Store — In Review (Release NFT minted on mainnet)
- 🏆 Colosseum 2026 — Cypherpunk track submission
- 📱 Android 15 (SDK 35) — Capacitor 6, React 19

**Visual:** Real Android Pixel / Seeker mockup with the actual app UI. **Do not use an iPhone mockup.** **Do not show a "5.0 Rating" badge** until the app is live and has real reviews. **Do not claim "#1"** — claim what is true: "purpose-built for Solana Seeker."

---

## Slide 2 — The Problem

**Question:** Where do you actually store your seed phrases, recovery passwords, KYC documents, and backup keys today?

**The honest answer for most crypto users:**

| Approach | Failure mode |
|---|---|
| **In memory** | Forgetful — limited capacity, no fallback on a bad day. |
| **On paper** | Fragile — fire, water, loss, photographing-and-uploading by a curious roommate. |
| **In cloud password managers** | Centralized — LastPass-style breaches are a "when," not an "if." |
| **In screenshots in your phone gallery** | Indexed by Google Photos / iCloud, syncable, searchable, leakable. |

Every existing answer trades one form of vulnerability for another. The crypto user is left without a clean primitive for "store this on my device, only I can decrypt, the recovery flow doesn't depend on a third party."

---

## Slide 3 — Built for Solana Seeker

**Headline:** 100% On-Device. 100% Local.

Seeker Vault is engineered to align with the Seeker hardware threat model:

1. **Triple-factor authentication.** PIN (PBKDF2-SHA256, 600 000 iterations — OWASP 2024 compliant), optional biometric gate (Android BiometricPrompt + Android Keystore — hardware-backed where available), optional Solana wallet signature via Mobile Wallet Adapter.
2. **Wallet-derived recovery key.** Backup encryption keys are derived (HKDF-SHA256) from a deterministic wallet signature. Your wallet becomes the recovery key — no support agent, no email reset, no centralized custodian.
3. **No backend exists.** The application is a local Android app. There is no server we operate. The only outbound network call is the Mobile Wallet Adapter WebSocket, triggered exclusively by your explicit wallet actions.

> **Correction vs the visual deck:** Avoid the term "FaceID" — that is an Apple trademark for iOS. Android uses BiometricPrompt with face / fingerprint as appropriate. Avoid claiming a "custom hardware PIN pad" — the PIN pad is a standard software component. The hardware-backed surface is the Android Keystore biometric key, not the entire encryption stack.

---

## Slide 4 — One Vault for All Your Secrets

A single encrypted local store for the four asset classes a crypto user actually carries:

| Surface | Contents | Encryption |
|---|---|---|
| **Seed phrases** | 12 / 18 / 24-word entry, checksum validated | AES-256-GCM per record, unique IV |
| **API keys & wallet keys** | Tagged by chain — EVM / Solana / Cosmos / OpenAI / etc. | AES-256-GCM per record, unique IV |
| **Encrypted notes** | Free-form rich text | AES-256-GCM per record, unique IV |
| **Encrypted secrets** | Site / username / password / notes | AES-256-GCM per record, unique IV |

All records share the same in-memory Data Encryption Key (DEK), derived on unlock and **zeroed from memory the moment the app locks** (`secureWipeKey()`). The DEK is never persisted.

Wallet integration: **Phantom, Solflare, Seed Vault** (and any other MWA-compatible Solana wallet).

---

## Slide 5 — Premium: The Hidden Private Vault

**200 MB of encrypted on-device file storage**, unlockable as a one-time Premium purchase.

**Real use cases (the legitimate framing):**
- Passport and ID scans for travel
- KYC selfies and verification documents
- Hardware-wallet seed backup QR codes
- Legal PDFs, contracts, NDAs
- Tax records and on-ramp invoices
- Personal photos that should never touch Google Photos

**Pricing:**
- **One-time $9** — no subscription, no SaaS trap
- Pay in **SOL** (≈ 0.1054 SOL at current price) **or in SKR** with a native **−10 % discount** (effective $8.10)
- 10 % SKR discount routes organic, non-speculative demand into the Seeker ecosystem token from every paying user

> **Correction vs the visual deck:** Drop the "those photos" wink and the line *"I'm not judging. I'm just encrypting."* It signals an adult-content positioning that (a) triggers dApp Store moderation, (b) deters institutional / family-vault buyers, and (c) understates the product. Legitimate use cases — KYC documents, legal PDFs, backup QR codes — are a stronger pitch and a wider market.

---

## Slide 6 — Lose the Phone, Keep the Vault

**Headline:** Broken phone? Stolen device? Backup that nobody else can decrypt.

**Backup loop:**

```
1. Vault → encrypted with DEK (AES-256-GCM)
2. DEK encrypted with backup key (AES-256-GCM)
3. Backup key derived via HKDF-SHA256 from a deterministic wallet signature
4. Final blob written as a versioned .svb v3 file
```

**Properties:**

- Backup file is a sealed encrypted blob — store it on a USB stick, in iCloud Drive, email it to yourself. Useless without your Solana wallet.
- Restoration works on **any Android device running Seeker Vault** — not restricted to Seeker hardware. Install the app, sign the same deterministic challenge with the same wallet, vault rehydrates.
- The format is versioned (`v3`). Future format upgrades will not orphan existing backups.

> **Correction vs the visual deck:** The slide claims "Restore safely on any Seeker-compatible device." The actual restoration runs on any Android device with Seeker Vault installed — the wallet is the recovery factor, not the phone hardware. Don't artificially narrow your own product.

---

## Slide 7 — Trust the Code, Not the Author

**Thesis:** Zero-Knowledge Architecture. Source-Available. Verifiable Builds.

**What "verifiable" actually means here:**

| Verification surface | Where | How |
|---|---|---|
| **Source code** | https://github.com/imFiz/Seeker-Vault | Read every cryptographic operation in `src/utils/crypto.ts` and `src/utils/backupCrypto.ts` |
| **APK SHA-256** | This deck + GitHub Release | `a14c01b4c085d30dfb434a9ed18c653ee7d4fcad5414ab55dcc7518ef46bf6ea` (v1.0.2). Compute it locally with `sha256sum`. |
| **Signing cert SHA-256** | This deck + GitHub Release | `19:F2:E3:62:52:77:C1:97:29:57:96:C3:59:FA:A8:31:6C:AF:33:33:D0:1E:23:54:04:30:07:DB:36:17:E6:92` |
| **Release NFT on-chain** | Solana mainnet | dApp Store mints a Release NFT containing the install hash — the chain itself attests to which binary is the canonical release |

**Cryptographic primitives** (all standard Web Crypto API — no custom crypto):

- **AES-256-GCM** with unique random IV per record, `gcm1:` versioned ciphertext
- **PBKDF2-SHA256**, 600 000 iterations (current OWASP recommendation)
- **HKDF-SHA256** for backup-key derivation
- **CSPRNG** via `crypto.getRandomValues` — no `Math.random` anywhere

> **Corrections vs the visual deck:**
> 1. **Do not say "100 % Open Source."** Seeker Vault is **source-available**, not OSI-licensed open source. Claiming open source without an OSI license is factually false and exposes the project to legitimate criticism. The correct phrase is *"source-available, publicly auditable."*
> 2. **Do not say "military-grade encryption."** Real military encryption uses Type-1 certified hardware. The phrase is a marketing cliché that security professionals discount. AES-256-GCM is enough — it's the same primitive your bank uses; that's what we should claim.
> 3. **Replace the placeholder hash** `0x7E8c2D4F9A1B5...` with the real APK SHA-256 above. The whole "verify yourself" pitch collapses if the hash on the slide doesn't match the actual binary.

---

## Slide 8 — The Ask & Closing

**Closing line:** Secure your future. Starting now.

**Call to action:**
1. Install Seeker Vault from the Solana dApp Store (once approved) or build from source ([github.com/imFiz/Seeker-Vault](https://github.com/imFiz/Seeker-Vault))
2. Verify the APK SHA-256 against this deck before installing
3. Try the free tier; upgrade to Premium in SKR for −10 %

**The grant ask** *(if pitching Solana Mobile Builder Grant):*

- **Amount:** USD 10 000 (paid in USDC)
- **Timeline:** 90 days to v1.1
- **Allocation:**
  - 40 % — independent code review of `crypto.ts` + `backupCrypto.ts` (focused scope, not a full tier-1 audit; reserve for that built once Premium revenue covers it)
  - 30 % — Cloud NFT Backup feature (encrypted blob + on-chain NFT pointer)
  - 20 % — co-marketing with Solana Mobile targeting Seeker owners in CIS + EN markets
  - 10 % — localization (TR, ES) and iOS-port feasibility scoping

**KPI:** 150 paying Premium unlocks within 90 days of dApp Store launch, with ≥ 30 % paid in SKR — measuring both product-market fit and ecosystem-token utility.

**Founder:**

- **Daniyar Gabdullin** — Founder & Solo Engineer
- **Aibat / X-BOOSTER** — KYC-verified publisher, Solana dApp Store
- **Almaty, Kazakhstan**
- Previously shipped X-BOOSTER on the Solana dApp Store (same publisher profile)

---

## Summary of corrections recommended for the visual deck

| Slide | Replace | With |
|---|---|---|
| 1 | iPhone mockup | Android Pixel / Seeker mockup with real app UI |
| 1 | "5.0 Rating" App Store badge | "Solana dApp Store — In Review" or "v1.0.2 on GitHub Releases" |
| 1 | "JUST LAUNCHED" | "v1.0.2 — Available on GitHub" (until dApp Store goes live) |
| 1 | "#1 Hardware-Native Vault" | "Purpose-built for Solana Seeker" |
| 3 | "FaceID" | "Android BiometricPrompt (Face / Fingerprint)" |
| 3 | "Custom PIN Pad: Independent hardware PIN interface layer" | "PIN gate with PBKDF2-SHA256 (600 000 iterations) — OWASP 2024" |
| 3 | "Seed-key verification executing entirely at the silicon level" | "Biometric-gated DEK in the Android Keystore, hardware-backed where available" |
| 5 | "those photos" + winking quote | "Passports · KYC · Legal PDFs · Backup QR codes · Personal photos" |
| 6 | "Anti-Fragility Loop" | "Wallet-Signed Backup Loop" |
| 6 | "Restore … on any Seeker-compatible device" | "Restore on any Android device running Seeker Vault" |
| 7 | "100 % Open Source" | "Source-Available · Publicly Auditable" |
| 7 | "Military-grade encryption" | "AES-256-GCM · PBKDF2-600k · HKDF-SHA256 — standard primitives, no custom crypto" |
| 7 | Fake hash `0x7E8c2D4F9A1B5...` | Real `a14c01b4c085d30dfb434a9ed18c653ee7d4fcad5414ab55dcc7518ef46bf6ea` |
| 8 | "Daniyar \| Full-Stack Developer \| Almaty" | "Daniyar Gabdullin · Founder, Aibat / X-BOOSTER · Almaty, Kazakhstan" |
| All | NotebookLM watermark in corner | Removed — clean export |

## Structural additions recommended (if expanding beyond 8 slides)

These were entirely absent from the original deck and are critical for a Solana Mobile Builder Grant:

1. **Market & competition** — Vault12, Lockbox, Neulock comparison; where Seeker Vault wins (Seeker-native + 200 MB file vault + SKR utility).
2. **Business model** — pricing card, unit economics, why we don't subscribe.
3. **Traction proof** — APK published, Release NFT minted, Colosseum 2026 submission, GitHub repo with documented releases, KYC-verified publisher.
4. **Roadmap** — Cloud NFT Backup → external audit → iOS scoping.
5. **The ask** — explicit grant request with allocation breakdown (now included on Slide 8 above).
