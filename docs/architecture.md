# Architecture

> System design, cryptographic pipeline, and threat model for Seeker Vault.

---

## 1. Design principles

1. **Zero-knowledge by default.** No party other than the user — including the developer, Google, or the wallet provider — can decrypt the vault.
2. **Nothing leaves the device.** No backend, no telemetry, no analytics, no cloud sync.
3. **No custom crypto.** Every primitive comes from the Web Crypto API. Nothing rolled by hand.
4. **Three independent gates.** PIN, biometric, and Solana wallet signature — combine any subset.
5. **Wallet is the recovery key.** Backups are encrypted with a key derived (via HKDF) from a deterministic wallet signature. No password recovery flow exists, because there's no one to ask.

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     📱  Seeker (Android device)                   │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐     │
│   │  React 19 UI (Capacitor 6 WebView shell)                │     │
│   └─────┬──────────────┬─────────────────┬─────────────────┘     │
│         │              │                 │                       │
│         ▼              ▼                 ▼                       │
│  ┌──────────┐   ┌────────────┐   ┌───────────────┐              │
│  │   PIN    │   │ Biometric  │   │ Wallet Auth   │              │
│  │ (PBKDF2) │   │ (Keystore) │   │ (MWA / Phantom│              │
│  └─────┬────┘   └──────┬─────┘   │  / Solflare / │              │
│        │               │         │  Seed Vault)  │              │
│        ▼               ▼         └───────┬───────┘              │
│  ┌──────────────────────────────┐        │                      │
│  │  Web Crypto API (browser)    │◀───────┘                      │
│  │  • PBKDF2-SHA256 (600k)      │                               │
│  │  • AES-256-GCM (unique IV)   │                               │
│  │  • HKDF-SHA256 (backup key)  │                               │
│  │  • CSPRNG (getRandomValues)  │                               │
│  └──────────────┬───────────────┘                               │
│                 │                                               │
│        ┌────────┴────────────┐                                  │
│        ▼                     ▼                                  │
│  ┌──────────┐         ┌──────────────┐                          │
│  │  Vault   │         │ Private Vault│                          │
│  │ records  │         │ 200 MB files │                          │
│  └──────────┘         └──────────────┘                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Native Java plugin: SafSaverPlugin (SAF file export)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

  Network calls (only on explicit user action):
  • Mobile Wallet Adapter WebSocket — wallet sign-in / signature
```

---

## 3. Cryptographic pipeline

### 3.1 Data Encryption Key (DEK)

The DEK is **derived** at unlock time, never persisted.

```
PBKDF2-SHA256(
  password = userPIN || biometric-keystore-secret,
  salt     = per-install-random-256-bit,
  iter     = 600 000,
  out      = 256 bits
) → DEK
```

- **Iterations**: 600 000 — current OWASP 2024 recommendation for PBKDF2-SHA256.
- **Salt**: generated once at install via `crypto.getRandomValues(32 bytes)`, persisted in Capacitor Preferences.
- **Output handling**: kept as a hex string in JS heap, **zeroed on app lock** (`secureWipeKey()`).

### 3.2 Per-record encryption

Every vault record (seed phrase, password, note, file) is encrypted independently:

```
ciphertext = "gcm1:" || base64(IV || AES-256-GCM(DEK, IV, plaintext))
where IV = crypto.getRandomValues(12 bytes)
```

- **Versioning prefix `gcm1:`** allows future migrations without breaking existing records.
- **Unique IV per record** prevents IV-reuse attacks on the same key.

### 3.3 Backup encryption

```
challenge      = "seekervault.backup.v3:" || vaultId
walletSig      = wallet.signMessage(challenge)         // deterministic
backupKey      = HKDF-SHA256(
                    ikm  = walletSig,
                    salt = vaultId,
                    info = "seekervault-backup-v3",
                    out  = 256 bits
                 )
backupBlob     = AES-256-GCM(backupKey, randomIV, vaultJSON)
.svb file      = "svb3:" || base64(IV || backupBlob)
```

- The signature is **deterministic** — the same wallet signing the same challenge always produces the same signature, so the backup can always be re-derived from the wallet alone.
- The `.svb` file is useless without the originating wallet's signature.

---

## 4. Authentication factors

| Factor | Purpose | Storage |
|---|---|---|
| **PIN (4–12 digits)** | Primary KDF input | Never stored — derived live |
| **Biometric** | Unlocks an Android Keystore entry that XOR-mixes into the DEK input | Keystore (hardware-backed on Seeker) |
| **Wallet signature** | Optional auth gate + backup key derivation | Wallet's secure element |

**Lockout policy**: 3 failed PIN attempts → 5-minute lockout. Lockout state lives in **Capacitor Preferences** (a tamper-resistant native bucket), *not* `localStorage` — so it survives DevTools, `adb shell run-as`, and JS-level clearing.

---

## 5. Storage layout

| Bucket | Contents | Encryption |
|---|---|---|
| `localStorage` | Encrypted vault records (JSON) | AES-256-GCM per record |
| Capacitor `Filesystem` | Private Vault file blobs | AES-256-GCM per file |
| Capacitor `Preferences` | Install salt, lockout state, settings | Plain (non-secret config only) |
| Android Keystore | Biometric-gated key | Hardware-backed |

**Nothing sensitive goes to plain Preferences or app config.**

---

## 6. Network surface

The app makes exactly **one** kind of network call:

| Call | When | What it carries |
|---|---|---|
| MWA WebSocket | Only on explicit "Connect Wallet" / "Sign for backup" | Challenge → signature exchange. No vault data. |

That's it. No analytics, no Sentry, no Firebase, no crash reporting, no update pings. The app **does not implement** any HTTP client. You can verify this with `mitmproxy` or any network-monitoring tool.

---

## 7. Threat model

### Protected against

| Threat | Mitigation |
|---|---|
| Lost / stolen device | Attacker cannot decrypt without PIN/biometric/wallet |
| Backend compromise | There is no backend |
| Cloud provider supply chain | We don't use one for your data |
| OS-level backup replication | `android:allowBackup="false"` |
| Clipboard shoulder-surfing | Clipboard cleared 30s after copy, 150ms after paste |
| Weak PIN brute-force | PBKDF2 600k + 3-attempt lockout |
| DevTools / `adb` tampering of lockout | Lockout state in native Preferences, not JS-accessible storage |
| Logcat secret leakage | Logger never writes seed phrases / keys / PINs even in error paths |

### NOT protected against

| Threat | Why |
|---|---|
| Rooted device with active keylogger | No software-only mitigation possible |
| Malware with system privileges | Same |
| Physical coercion ("$5 wrench attack") | Same |
| User writing seed on paper and losing it | Same |

For the highest-value holdings, use a hardware wallet. Seeker Vault is for everything else — passwords, notes, files, daily-use seed phrases, API keys.

---

## 8. Reproducible builds

The release APK is built deterministically:

- Same source tree + same keystore → identical SHA-256
- Build inputs: Node 20, JDK 17, Android SDK 35, Capacitor 6
- ProGuard/R8 enabled
- Published SHA-256 in [`README.md`](../README.md#official-release-fingerprints)

Anyone can clone this repo, build with their own keystore, and verify that the *unsigned* portion of the APK matches.

---

## 9. References

- [OWASP Password Storage Cheat Sheet (2024)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — PBKDF2 iteration counts
- [NIST SP 800-108](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-108r1.pdf) — Key derivation
- [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869) — HKDF
- [Solana Mobile Wallet Adapter](https://docs.solanamobile.com/mobile-wallet-adapter/overview)
