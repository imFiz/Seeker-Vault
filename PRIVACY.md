# Privacy Policy — Seeker Vault

**Effective date:** April 2026
**Last updated:** April 2026

This Privacy Policy explains how Seeker Vault ("the application", "we", "our") handles information when you use it on your device. This document is concerned **only with data and privacy practices**. Licensing terms, ownership, warranties, and limitations of liability are governed separately by the [End User License Agreement (EULA)](EULA.md).

---

## 1. The short version

- We **do not** operate any backend, server, account system, or cloud database.
- We **do not** collect, transmit, store, sell, share, or analyze any personal data.
- Everything you store in Seeker Vault stays **on your device**, encrypted with keys derived from inputs (PIN, biometric, wallet signature) that are also held only on your device.
- The **only** outbound network activity is a Mobile Wallet Adapter (MWA) WebSocket connection that is initiated **only when you explicitly perform a wallet action** (sign-in or backup-key derivation). It carries a challenge / signature exchange — never your vault contents.

If any clause below conflicts with this short version, the short version controls in your favor.

---

## 2. Data we **do not** collect

We make no effort to know who you are. Specifically, Seeker Vault does **not** collect or transmit:

- Personal identifiers (name, email, phone, address, government ID).
- Device identifiers (advertising ID, IMEI, MAC, serial, install ID).
- Usage analytics (screen views, feature usage, session length, retention).
- Crash reports or stack traces sent off-device.
- Network telemetry (IP logging, geolocation, ISP).
- Wallet addresses, balances, or transaction history.
- Your PIN, biometric template, master password, seed phrases, private keys, notes, files, or any other vault contents.

There is **no** Firebase, Sentry, Mixpanel, Amplitude, Crashlytics, Google Analytics, or comparable SDK embedded in the application.

---

## 3. Data stored locally on your device

The following information is created and used by the application **on your device only**:

| Category | What it is | Where it lives |
|---|---|---|
| Encrypted vault records | Your seeds, passwords, notes, files | Local app storage (encrypted with AES-256-GCM) |
| Per-install salt | A random 256-bit value used in key derivation | Capacitor Preferences (native, app-private) |
| PIN-attempt counters | Lockout state to mitigate brute force | Capacitor Preferences (native, app-private) |
| Settings | Theme, auto-lock duration, locale, premium-flag | Capacitor Preferences (native, app-private) |
| Biometric-gated key | Optional Android-Keystore-protected key | Android Keystore (hardware-backed where available) |

This data is stored in app-private locations that the Android OS isolates from other applications. We do **not** receive any of it.

When you uninstall the application, the operating system removes all of this data. There is no remote copy.

---

## 4. Outbound network activity

Seeker Vault contains exactly the following kinds of outbound network activity, and **only when you explicitly trigger them**:

1. **Mobile Wallet Adapter (MWA) connection.** When you tap "Connect Wallet" or "Sign for backup", the app opens an MWA WebSocket session (per the standard Solana Mobile MWA protocol) to your installed wallet (Phantom, Solflare, Seed Vault, etc.). The session carries a challenge string and returns a signature. No vault contents are transmitted.

You can verify this list with any standard network-monitoring tool (mitmproxy, Charles, PCAPdroid). The application does not embed any HTTP client, telemetry SDK, push-notification SDK, or update-check endpoint.

---

## 5. Third parties

We do not share data with third parties because we **do not have your data**.

The only third-party software involved at runtime is your installed Solana wallet (Phantom, Solflare, Seed Vault, etc.), which is launched by you to sign a message via the standard MWA protocol. Your wallet's privacy practices are governed by its own publisher's policy, not by us.

---

## 6. Backups created by you

When you choose to export an encrypted backup file (`.svb`), the file is written to a destination **you select** through the Android system file picker (Storage Access Framework). The encryption key is derived from a deterministic Solana wallet signature using HKDF-SHA256 — meaning we cannot decrypt the file even if it were sent to us. We never receive the file.

You are solely responsible for the location to which you save your backups (USB stick, cloud drive, email to yourself, etc.) and for the security of that destination.

---

## 7. Children's privacy

Seeker Vault is not directed to children under 13, and we do not knowingly collect any data from anyone, including children. Because we collect nothing, no special children's-data handling is needed.

---

## 8. International data transfers

We make no international data transfers because we do not transfer data at all. Your data does not leave your device.

---

## 9. Your privacy rights

Because we do not collect, store, or process your personal data:

- **Access** — there is nothing on our side to access.
- **Correction** — you control all stored data directly within the app.
- **Deletion** — uninstalling the application deletes all data on your device. No further deletion request to us is possible because we have nothing.
- **Portability** — you can export a backup at any time via Settings → Backup → Export.
- **Objection / withdrawal of consent** — uninstalling the application is the complete withdrawal mechanism.

GDPR / CCPA equivalents apply in the same way: there is no data subject record on our side because we operate no systems that hold your data.

---

## 10. Security of the cryptographic design

The application uses standard primitives provided by the Web Crypto API (no custom cryptography):

- **AES-256-GCM** with a unique random IV per record for vault content.
- **PBKDF2-SHA256** with 600 000 iterations for PIN-derived key derivation (current OWASP guidance).
- **HKDF-SHA256** for wallet-derived backup keys.
- **CSPRNG** (`crypto.getRandomValues`) for all randomness.

Source code is publicly available at https://github.com/imFiz/Seeker-Vault for independent inspection.

No system is perfectly secure. You acknowledge that local risks (rooted device, keylogger, physical coercion) are outside the scope of any software's privacy controls and are not addressed by this policy.

---

## 11. Changes to this Privacy Policy

We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above and, where reasonable, by an in-app notice. Continued use after a change constitutes acceptance of the updated policy.

---

## 12. Contact

For privacy-related questions, please open an issue on the project's public repository:

**https://github.com/imFiz/Seeker-Vault/issues**

For sensitive disclosures (security vulnerabilities), please contact the maintainer privately via the contact details available on the publisher's profile, before disclosing publicly.

---

**Publisher:** Aibat / X-BOOSTER, Almaty, Kazakhstan
