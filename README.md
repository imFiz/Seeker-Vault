<div align="center">
<img width="1200" height="475" alt="Seeker Vault" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Seeker Vault

**A zero-knowledge Solana wallet and encrypted personal vault for Android.**

Your keys. Your files. Your device. Nothing leaves.

</div>

---

## What is Seeker Vault?

Seeker Vault is an Android application that combines two things people usually split across multiple apps:

1. **A non-custodial Solana wallet** — send, receive, swap, and sign with Phantom, Solflare, and any other Mobile Wallet Adapter (MWA) compatible wallet.
2. **An encrypted personal vault** — store seed phrases, passwords, notes, documents, images, and any other files on your device, fully encrypted at rest.

Everything is stored **locally on your phone**. There is no server, no account, no cloud sync, no telemetry, no analytics. If your phone is offline, the app still works — except for blockchain operations, which obviously need the internet.

---

## Why you can trust it

### 1. Zero-knowledge architecture

Only **you** can decrypt your vault. The encryption keys are derived from:
- Your PIN (via PBKDF2-SHA256 with **600 000 iterations** — the current OWASP recommendation),
- Optionally your biometric-unlocked keystore entry,
- A per-install random salt that never leaves the device.

The developer, Google, your wallet provider, and anyone else **cannot** recover your data, even if they wanted to. There is no "forgot password" flow because there is no one to ask.

### 2. Nothing leaves the device

- **No backend server.** The app does not have one. Look at the code.
- **No analytics.** No Firebase, no Sentry, no Mixpanel, no Google Analytics.
- **No telemetry.** Crash logs are written to `localStorage` **on your device** for your own debugging, never transmitted.
- **No cloud backup.** `android:allowBackup="false"` in the manifest — Google's automatic backup cannot copy your vault off the phone.
- **No account system.** There is nothing to register. Nothing to log into.

The only network calls the app makes are:
- Solana RPC (to read balances and broadcast transactions you explicitly sign),
- Jupiter aggregator (when you explicitly initiate a swap),
- Mobile Wallet Adapter WebSocket (only when you connect a wallet),
- Public price feeds (for display).

You can verify this yourself with any network-monitoring tool.

### 3. Strong, modern cryptography

| Component | Algorithm |
|---|---|
| Vault encryption | **AES-256-GCM** with a unique random IV per record |
| Key derivation from PIN | **PBKDF2-SHA256**, 600 000 iterations |
| Backup key derivation | **HKDF-SHA256** over a wallet signature |
| Random source | Web Crypto API `crypto.getRandomValues` (CSPRNG) |
| Versioning | Ciphertext prefixed with `gcm1:` — future migrations won't break existing data |

Data-encryption keys live in memory only as hex strings and are zeroed out the moment the app locks.

### 4. Defense in depth

- **PIN lockout.** After repeated failed PIN attempts, the app locks itself for an escalating cool-down period. The lockout timer is stored in Android's `Preferences` (protected) — not in `localStorage` — so it survives DevTools and `adb` tampering.
- **Biometric gate.** Optional fingerprint/face unlock backed by the Android Keystore. The biometric unlock is a gate to the encrypted DEK, not a replacement for it.
- **Clipboard hygiene.** Sensitive values are cleared from the clipboard 30 seconds after copy, and 150 ms after paste.
- **Obfuscated release build.** ProGuard/R8 enabled for release APKs.
- **No `allowBackup`.** The OS cannot silently copy vault data off the phone.
- **No exported components** except the main `Activity`.
- **Secrets never logged.** The application logger never writes seed phrases, private keys, or PINs to logcat — even in error paths.

### 5. Open source, verifiable

The entire codebase is in this repository. You can:
- **Read it.** Every cryptographic operation is in `src/utils/crypto.ts` and `src/utils/backupCrypto.ts`.
- **Build it.** See the [Build from source](#build-from-source) section. You will produce the exact same APK we publish.
- **Audit it.** No obfuscated logic, no hidden bundled binaries beyond standard Capacitor/Android libraries, no remote code execution.

If you find a security issue, please open an issue or contact the maintainer — **before** disclosing publicly.

---

## Features

### Solana wallet
- Connect any Mobile Wallet Adapter-compatible wallet (Phantom, Solflare, Seed Vault, etc.)
- View SOL and SPL token balances
- Send and receive SOL and tokens
- Swap tokens via Jupiter aggregator
- Sign messages and transactions
- Transaction history
- Live USD pricing

### Encrypted vault
- **Seed phrases** — structured entry with word count validation
- **Passwords** — per-entry fields for site/username/password/notes
- **Secure notes** — plain rich text you want no one else to see
- **Files** — any file type: documents, images, PDFs, archives, keys
- **Inline image previews** for supported formats
- **Bulk restore** — export all files back to your device's `Downloads/` folder in one tap
- **Individual export** — pick exact destination via the system file picker
- **Share** — send decrypted content to another app via the Android share sheet

### Backup & recovery
- **Wallet-signed encrypted backups.** Your vault is exported as an encrypted `.svb` file. The decryption key is derived (via HKDF) from a deterministic signature produced by your Solana wallet — meaning **as long as you have your wallet, you can restore the vault, even on a new phone.**
- **Portable.** Backup files are plain encrypted blobs — store them on a USB stick, in a cloud drive, email them to yourself. They are useless without your wallet signature.
- **Versioned.** The backup format is versioned (`v3`), so future format upgrades won't orphan your old backups.

### Authentication
- **PIN code** — 4-to-8-digit numeric with rate-limiting and lockout
- **Biometric unlock** (optional) — fingerprint or face
- **Wallet authentication** (optional) — sign-in with a wallet signature
- **Triple-factor mode** — require any combination of the three

### UX
- **Light and dark themes**
- **Edge-to-edge Android 15 support**
- **Keyboard-aware layout** — the Save button never hides under the keyboard
- **Russian and English** UI copy (auto-detected from system locale)

---

## Privacy policy, in plain English

- We collect **nothing.**
- We store **nothing** outside your device.
- We have **no servers** that hold your data.
- We **cannot** see your vault, your balances, your addresses, or your usage patterns.
- We do **not** share data with third parties because we do not have your data.
- Network requests are limited to blockchain RPC, price feeds, and wallet-adapter handshakes — all of which are necessary for the features that trigger them, and none of which carry your private data.

The full EULA is included in the app under **Settings → Privacy Policy & Terms**.

---

## Threat model

Seeker Vault protects you against:
- ✅ Lost or stolen phone (attacker cannot decrypt without your PIN/biometric)
- ✅ Remote compromise of a backend (there is no backend)
- ✅ Supply-chain compromise of a cloud provider (we do not use one for your data)
- ✅ Malicious OS-level backup replication (disabled at manifest level)
- ✅ Shoulder-surfing the clipboard (auto-clear)
- ✅ Weak PIN brute-force (PBKDF2 600k + lockout)

Seeker Vault does **not** protect you against:
- ❌ A rooted device with an active keylogger installed by you
- ❌ Malware running with system privileges
- ❌ Physically forcing you to enter your PIN
- ❌ You writing your seed phrase on a napkin and losing the napkin

For those threats, no software can help. Use a hardware wallet for large holdings.

---

## Build from source

**Prerequisites**
- Node.js 20+
- Android Studio with SDK 35 and build-tools installed
- JDK 17

**Build**

```bash
# Install dependencies
npm install

# Build the web bundle
npm run build

# Sync into the Android project
npx cap sync android

# Build the debug APK
cd android
./gradlew assembleDebug
```

The output APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

For a signed release build, place your keystore and run `./gradlew assembleRelease`.

---

## Tech stack

- **React 19** + **TypeScript**
- **Vite 6** for the web build
- **Capacitor 6** for the Android shell
- **@solana/web3.js** + **@solana-mobile/wallet-adapter-mobile** for Solana/MWA
- **Web Crypto API** for all cryptographic primitives — no custom crypto
- **TailwindCSS** + **lucide-react** for UI
- **Native Java plugin** (`SafSaverPlugin`) for Storage Access Framework file export

---

## Verifying authenticity of official builds

The only builds considered **official** are those signed with the Seeker Vault
release keystore and distributed through channels designated by the authors.

Once a release is published, this section will list:

- The SHA-256 hash of the official APK for that version.
- The SHA-256 fingerprint of the signing certificate.

To verify an APK you obtained from the official channel:

```bash
# 1. Check the file hash
sha256sum SeekerVault-<version>.apk

# 2. Check the signing certificate fingerprint
apksigner verify --print-certs SeekerVault-<version>.apk
```

Compare both values against what is published here. If either does not match,
the APK is not an official build and should not be installed.

A self-compiled APK built from this source tree will have a **different**
signing fingerprint (your debug keystore). That is expected, and that build
is perfectly fine for your own audit and personal use — but Android will not
let you install it over an Official Build, and vice versa.

---

## License and distribution

Seeker Vault is **source-available, not open source**. See [`LICENSE`](LICENSE)
for the exact terms. In short:

- ✅ You may **read, audit, and study** the code.
- ✅ You may **compile and install** the app on your own device for personal,
     non-commercial use.
- ✅ You may **report bugs** and submit pull requests.
- ❌ You may **not redistribute builds**, binaries, or APKs — modified or
     unmodified, for a fee or free of charge.
- ❌ You may **not use** the software commercially without a separate license.
- ❌ You may **not publish** forks under the Seeker Vault name or branding.

This model exists because trust in a wallet app depends on its code being
auditable — anyone should be able to verify there is no backdoor. But the
app itself is a product: hosting, signing, supporting, and improving it
costs time and money. Official builds are distributed through paid or gated
channels to sustain development.

If you want to use the code beyond those terms (commercial deployment,
redistribution, branded fork, etc.), contact the authors for a commercial
license.

---

<div align="center">

**Your keys. Your files. Your device.**

</div>
