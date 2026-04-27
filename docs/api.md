# Internal API

> Module-level API surface inside the Seeker Vault codebase. This is *internal* documentation — Seeker Vault does not expose a public HTTP / SDK API.

---

## 1. Module map

```
src/
├── App.tsx                       # Root component (~4700 lines, all screens)
├── utils/
│   ├── crypto.ts                 # Vault encryption (AES-256-GCM, PBKDF2)
│   ├── backupCrypto.ts           # Backup key derivation (HKDF + wallet sig)
│   ├── walletAuth.ts             # MWA sign-in flow
│   ├── safSaver.ts               # Native Java plugin bridge (file export)
│   ├── clipboard.ts              # Auto-clearing clipboard helpers
│   └── logger.ts                 # Secret-filtering logger
├── components/                   # UI primitives
└── i18n/                         # EN / RU translations
```

---

## 2. `crypto.ts` — vault encryption

### `deriveDEK(pin: string, salt: Uint8Array): Promise<string>`
Derives the data encryption key from a PIN.

- **Input**: 4–12-digit PIN string, 32-byte random salt.
- **Algorithm**: PBKDF2-SHA256, 600 000 iterations, 256-bit output.
- **Returns**: hex-encoded 256-bit key.

### `encryptRecord(plaintext: string, dek: string): Promise<string>`
Encrypts a single vault record.

- **Output format**: `gcm1:` + base64(`IV ‖ AES-256-GCM(DEK, IV, plaintext)`)
- **IV**: 12 bytes from `crypto.getRandomValues`, fresh per call.

### `decryptRecord(ciphertext: string, dek: string): Promise<string>`
Decrypts a record. Validates the `gcm1:` version prefix; throws on mismatch.

### `secureWipeKey(dek: string): void`
Best-effort zeroing of the DEK string in JS heap. Called on app lock and on `pagehide`.

### `getOrCreateInstallSalt(): Promise<Uint8Array>`
Reads the per-install salt from Capacitor Preferences, generating one on first use via CSPRNG.

### `recordPinAttempt(success: boolean): Promise<LockoutState>`
Updates lockout counters in Capacitor Preferences. Returns `{ locked, retryAt, attemptsLeft }`.

---

## 3. `backupCrypto.ts` — wallet-signed backups

### `buildBackupChallenge(vaultId: string): string`
Returns the deterministic challenge string the wallet will sign.

```
"seekervault.backup.v3:" + vaultId
```

### `deriveBackupKey(walletSignature: Uint8Array, vaultId: string): Promise<CryptoKey>`
HKDF-SHA256 over the wallet signature.

- **IKM**: raw signature bytes (64 bytes for ed25519)
- **Salt**: vaultId as UTF-8
- **Info**: `"seekervault-backup-v3"` as UTF-8
- **Out**: 256-bit AES key

### `exportBackup(vault: VaultState, backupKey: CryptoKey): Promise<Uint8Array>`
Serializes the vault to JSON, encrypts with AES-256-GCM, prefixes with `svb3:`, returns the file bytes.

### `importBackup(blob: Uint8Array, backupKey: CryptoKey): Promise<VaultState>`
Inverse of `exportBackup`. Validates `svb3:` prefix; throws on version mismatch.

---

## 4. `walletAuth.ts` — Mobile Wallet Adapter

### `connectWallet(): Promise<{ publicKey: string; cluster: 'mainnet-beta' }>`
Triggers an MWA session, returns the connected wallet's public key.

### `signMessage(message: Uint8Array): Promise<Uint8Array>`
Wraps `transact(...)` with a single `signMessages` call. Returns the raw signature.

### `verifySignature(pubkey, message, signature): boolean`
ed25519 verification using `@solana/web3.js`. No network call.

> ⚠️ **No `signTransaction` is ever called.** The app never sends or signs blockchain transactions. MWA is used **solely** for `signMessages`.

---

## 5. `safSaver.ts` — Storage Access Framework bridge

Wraps the native Java plugin `SafSaverPlugin`.

### `pickDestinationAndSave(filename: string, bytes: Uint8Array, mime: string): Promise<{ uri: string }>`
Opens the system "Save As" dialog, writes the bytes to the chosen URI.

### `bulkRestoreToDownloads(files: { name: string; bytes: Uint8Array }[]): Promise<{ count: number }>`
Writes all files to `Downloads/SeekerVault/` using `MediaStore.Downloads`. Returns count saved.

---

## 6. `clipboard.ts` — auto-clearing clipboard

### `copyAndAutoClear(value: string, ms = 30000): Promise<void>`
Copies value to clipboard, schedules a clear after `ms` milliseconds (default 30s).

### `pasteAndAutoClear(): Promise<string>`
Reads clipboard, schedules a 150 ms clear (anti-screenshot heuristic).

---

## 7. `logger.ts` — secret-filtering logger

```ts
log.info('vault unlocked', { pin: userPin });
// → "vault unlocked { pin: '[REDACTED]' }"
```

Filtered key patterns: `pin`, `password`, `seed`, `mnemonic`, `privatekey`, `apiKey`, `token`, `secret`, `dek`, `signature`.

> The logger is the **only** path to console output. Direct `console.log` calls are forbidden by lint rule.

---

## 8. Storage keys

| Key | Bucket | Contents |
|---|---|---|
| `sv:install-salt` | Preferences | 32-byte CSPRNG salt |
| `sv:lockout` | Preferences | `{ attempts, lockedUntil }` |
| `sv:settings` | Preferences | Theme, autolock, locale, premium flag |
| `sv:vault:records` | localStorage | Array of encrypted record strings |
| `sv:vault:files-index` | localStorage | Encrypted index of Private Vault files |
| `sv:vault:files/<id>` | Filesystem | Each Private Vault file as encrypted blob |

---

## 9. Versioning

- **Vault record format**: `gcm1:` (current). Future versions add new prefixes; old prefixes always remain decryptable.
- **Backup file format**: `svb3:` (current — v3). Older formats (v1, v2) are legacy and will be migrated on import.
- **App versionCode**: tracks Android package version. v1.0 = versionCode 1.
