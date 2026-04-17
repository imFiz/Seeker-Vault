import { logError } from './logger';

export const BACKUP_SIGN_MESSAGE = 'Unlock Seeker Vault Backup. Sign only on trusted domains.';
export const BACKUP_VERSION_V1 = 0x01;
export const BACKUP_VERSION_V2 = 0x02;
export const BACKUP_VERSION_V3 = 0x03;
export const BACKUP_FORMAT_VERSION = BACKUP_VERSION_V3;
export const BACKUP_MAGIC = 'SVLT';

const MAGIC_BYTES = new TextEncoder().encode(BACKUP_MAGIC);
const ENC = new TextEncoder();

export async function deriveBackupKey(signatureBytes: Uint8Array): Promise<CryptoKey> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', signatureBytes);
  return globalThis.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// legacy v2 import only — do not use for new backups
export async function deriveBackupKeyV2Legacy(combinedBytes: Uint8Array): Promise<CryptoKey> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', combinedBytes);
  return globalThis.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function deriveBackupKeyV3Hkdf(signatureBytes: Uint8Array): Promise<CryptoKey> {
  const salt = ENC.encode('SeekerVault.Backup.v2.salt');
  const info = ENC.encode('SeekerVault.Backup.v2.key');
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw', signatureBytes, 'HKDF', false, ['deriveBits']
  );
  const keyBits = await globalThis.crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    256
  );
  return globalThis.crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function readBackupVersion(fileBytes: Uint8Array): number {
  const magic = String.fromCharCode(...fileBytes.slice(0, 4));
  if (magic !== BACKUP_MAGIC) throw new Error('Invalid backup');
  return fileBytes[4];
}

export async function encryptBackup(plaintext: string, key: CryptoKey): Promise<Uint8Array> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const ct = new Uint8Array(cipherBuf);

  const result = new Uint8Array(4 + 1 + 12 + ct.length);
  result.set(MAGIC_BYTES, 0);
  result[4] = BACKUP_FORMAT_VERSION;
  result.set(iv, 5);
  result.set(ct, 17);
  return result;
}

export async function decryptBackup(fileBytes: Uint8Array, key: CryptoKey): Promise<string> {
  const magic = String.fromCharCode(...fileBytes.slice(0, 4));
  if (magic !== BACKUP_MAGIC) throw new Error('Invalid backup');

  const version = fileBytes[4];
  if (version < BACKUP_VERSION_V1 || version > BACKUP_VERSION_V3) throw new Error('Invalid backup');

  const iv = fileBytes.slice(5, 17);
  const ct = fileBytes.slice(17);

  try {
    const plainBuf = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plainBuf);
  } catch (e) {
    logError('backupCrypto', e);
    throw new Error('Cannot decrypt backup. Make sure you are connecting the SAME wallet used to create this backup, and that the file is not corrupted (0 bytes).');
  }
}
