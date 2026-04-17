import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Note, VaultFile, VaultSettings } from '../types';
import {
  BACKUP_SIGN_MESSAGE,
  BACKUP_FORMAT_VERSION,
  BACKUP_VERSION_V1,
  BACKUP_VERSION_V2,
  BACKUP_VERSION_V3,
  deriveBackupKey,
  deriveBackupKeyV2Legacy,
  deriveBackupKeyV3Hkdf,
  encryptBackup,
  decryptBackup,
  readBackupVersion,
} from './backupCrypto';
import { decrypt } from './crypto';
import { logError } from './logger';

const APP_VERSION = '1.0.0';

const MWA_IDENTITY = {
  name: 'Seeker Vault',
  uri: 'https://seekervault.whoim.space',
  icon: 'favicon.ico',
};

export interface BackupEnvelope {
  version: number;
  createdAt: string;
  appVersion: string;
  itemCount: { notes: number; files: number };
  notes: Note[];
  files: VaultFile[];
  settings: Omit<VaultSettings, 'isPremium'>;
  plaintextPayload?: true;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let result = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(result);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toUint8(raw: any): Uint8Array {
  if (typeof raw === 'string') return base64ToUint8(raw);
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  if (raw && typeof raw === 'object' && 'length' in raw) return new Uint8Array(raw as any);
  throw new Error('Unknown binary payload format');
}

export async function signForBackupKey(): Promise<{ signature: Uint8Array; address: string }> {
  return await transact(async (wallet: any) => {
    let auth;
    try {
      auth = await wallet.authorize({ cluster: 'mainnet-beta', identity: MWA_IDENTITY });
    } catch {
      auth = await wallet.authorize({ chain: 'solana:mainnet', identity: MWA_IDENTITY });
    }
    if (!auth?.accounts?.length) throw new Error('No accounts from wallet');
    const address = auth.accounts[0].address;

    const messageBytes = new TextEncoder().encode(BACKUP_SIGN_MESSAGE);
    const messageB64 = uint8ToBase64(messageBytes);
    const res = await wallet.signMessages({
      addresses: [address],
      payloads: [messageB64],
    });
    const raw = res?.signed_payloads?.[0];
    if (!raw) throw new Error('No signed payload from wallet');

    const signedFull = toUint8(raw);
    if (signedFull.length < 64) throw new Error(`Signature too short: ${signedFull.length} bytes`);

    const signature = signedFull.slice(0, 64);
    let allZero = true;
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== 0) { allZero = false; break; }
    }
    if (allZero) throw new Error('Wallet returned empty signature');
    return { signature, address };
  });
}

async function buildV2LegacyCombined(signature: Uint8Array, address: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const addrBytes = enc.encode(address + '|');
  const combined = new Uint8Array(addrBytes.length + signature.length);
  combined.set(addrBytes, 0);
  combined.set(signature, addrBytes.length);
  return combined;
}

async function deriveKeyForVersion(version: number, signature: Uint8Array, address: string): Promise<CryptoKey> {
  if (version === BACKUP_VERSION_V1) {
    return deriveBackupKey(signature);
  }
  if (version === BACKUP_VERSION_V2) {
    const combined = await buildV2LegacyCombined(signature, address);
    return deriveBackupKeyV2Legacy(combined);
  }
  if (version === BACKUP_VERSION_V3) {
    const enc = new TextEncoder();
    const addrBytes = enc.encode(address + '|');
    const combined = new Uint8Array(addrBytes.length + signature.length);
    combined.set(addrBytes, 0);
    combined.set(signature, addrBytes.length);
    return deriveBackupKeyV3Hkdf(combined);
  }
  throw new Error('Invalid backup');
}

export async function buildBackupEnvelope(
  notes: Note[],
  loadAllFilesFull: () => Promise<VaultFile[]>,
  settings: VaultSettings
): Promise<BackupEnvelope> {
  const allFiles = await loadAllFilesFull();
  const { isPremium: _isPremium, ...settingsWithoutPremium } = settings;
  const plainNotes = await Promise.all(notes.map(async n => ({ ...n, content: await decrypt(n.content) || n.content })));
  const plainFiles = await Promise.all(allFiles.map(async f => ({ ...f, data: await decrypt(f.data) || f.data })));
  return {
    version: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    itemCount: { notes: plainNotes.length, files: plainFiles.length },
    notes: plainNotes,
    files: plainFiles,
    settings: settingsWithoutPremium,
    plaintextPayload: true,
  };
}

import { SafSaver } from '../plugins/safSaver';

export interface ExportResult {
  filename: string;
  uri: string;
  cancelled?: boolean;
}

export async function exportBackupFile(envelope: BackupEnvelope): Promise<ExportResult> {
  const { signature, address } = await signForBackupKey();
  const key = await deriveKeyForVersion(BACKUP_VERSION_V3, signature, address);
  const plaintext = JSON.stringify(envelope);
  const encrypted = await encryptBackup(plaintext, key);

  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 16).replace('T', '_');
  const filename = `seeker_vault_${timestamp}.vault`;

  if (Capacitor.getPlatform() === 'android') {
    const base64 = uint8ToBase64(encrypted);
    if (!base64 || base64.length === 0) throw new Error('Encrypted data is empty');
    const tempName = `pending_backup_${Date.now()}.bin`;
    await Filesystem.writeFile({
      path: tempName,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    const stat = await Filesystem.stat({ path: tempName, directory: Directory.Data });
    if (!stat.size || stat.size === 0) throw new Error('Temp backup file empty after write');
    const uriResult = await Filesystem.getUri({ path: tempName, directory: Directory.Data });
    const absolutePath = uriResult.uri.replace('file://', '');

    try {
      const result = await SafSaver.saveFile({
        filename,
        sourcePath: absolutePath,
        mimeType: 'application/octet-stream',
      });
      return { filename, uri: result.uri };
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('cancel')) return { filename, uri: '', cancelled: true };
      logError('backup', e);
      throw e;
    }
  } else {
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { filename, uri: filename };
  }
}

export async function exportAndShare(envelope: BackupEnvelope): Promise<void> {
  const { signature, address } = await signForBackupKey();
  const key = await deriveKeyForVersion(BACKUP_VERSION_V3, signature, address);
  const plaintext = JSON.stringify(envelope);
  const encrypted = await encryptBackup(plaintext, key);
  const base64 = uint8ToBase64(encrypted);
  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 16).replace('T', '_');
  const filename = `seeker_vault_${timestamp}.vault`;
  await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Data, recursive: true });
  const cacheUri = await Filesystem.getUri({ path: filename, directory: Directory.Data });
  await Share.share({
    title: 'Seeker Vault Backup',
    text: 'Seeker Vault Backup',
    files: [cacheUri.uri],
    dialogTitle: 'Share backup file',
  });
  await Filesystem.deleteFile({ path: filename, directory: Directory.Data }).catch((e) => { logError('backup', e); });
}

export async function importBackupFile(file: File): Promise<BackupEnvelope> {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const version = readBackupVersion(fileBytes);
  if (version !== BACKUP_VERSION_V1 && version !== BACKUP_VERSION_V2 && version !== BACKUP_VERSION_V3) {
    throw new Error('Invalid backup');
  }

  const { signature, address } = await signForBackupKey();

  try {
    const key = await deriveKeyForVersion(version, signature, address);
    const plaintext = await decryptBackup(fileBytes, key);
    return JSON.parse(plaintext) as BackupEnvelope;
  } catch (e) {
    logError('backup', e);
    throw new Error('Invalid backup or wrong wallet');
  }
}
