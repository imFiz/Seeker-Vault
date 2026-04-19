import CryptoJS from 'crypto-js';
import { Preferences } from '@capacitor/preferences';
import { logError } from './logger';

// ─── In-memory DEK (Data Encryption Key) ─────────────────────────────────────
let DEK_HEX = '';

// ─── localStorage keys (non-sensitive metadata stays in localStorage) ─────────
const K_WRAPPED    = 'sv_wrapped_dek';
const K_IV         = 'sv_wrap_iv';
const K_SALT       = 'sv_wrap_salt';
const K_PIN_TS     = 'sv_last_pin_ts';
// Preferences keys (sensitive counters and lock state)
const K_PIN_FAILS  = 'sv_pin_fails';
const K_PIN_LOCK   = 'sv_pin_lock_until';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toBase64 = (buf: Uint8Array): string => {
  let result = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    result += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(result);
};

const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const hexToBytes = (hex: string): Uint8Array => {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
};

const bytesToHex = (buf: Uint8Array): string =>
  Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');

const importDEK = (dekHex: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', hexToBytes(dekHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

// ─── PBKDF2 (Web Crypto) ──────────────────────────────────────────────────────
async function deriveKEK(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Preferences-backed lock_until ───────────────────────────────────────────
async function getPinLockUntil(): Promise<number> {
  try {
    const { value } = await Preferences.get({ key: K_PIN_LOCK });
    if (value !== null && value !== undefined) {
      return parseInt(value, 10);
    }
    // backward-compat migration from localStorage
    const legacy = localStorage.getItem(K_PIN_LOCK);
    if (legacy) {
      const ts = parseInt(legacy, 10);
      await Preferences.set({ key: K_PIN_LOCK, value: legacy });
      localStorage.removeItem(K_PIN_LOCK);
      return ts;
    }
    return 0;
  } catch {
    return parseInt(localStorage.getItem(K_PIN_LOCK) || '0', 10);
  }
}

async function setPinLockUntil(ts: number): Promise<void> {
  try {
    await Preferences.set({ key: K_PIN_LOCK, value: String(ts) });
    localStorage.removeItem(K_PIN_LOCK);
  } catch {
    localStorage.setItem(K_PIN_LOCK, String(ts));
  }
}

async function clearPinLock(): Promise<void> {
  try {
    await Preferences.remove({ key: K_PIN_LOCK });
    localStorage.removeItem(K_PIN_LOCK);
  } catch {
    localStorage.removeItem(K_PIN_LOCK);
  }
}

// ─── PIN rate limiting ────────────────────────────────────────────────────────
export const isPinLocked = async (): Promise<boolean> => {
  const until = await getPinLockUntil();
  return Date.now() < until;
};

export const getPinLockRemainingMs = async (): Promise<number> => {
  const until = await getPinLockUntil();
  return Math.max(0, until - Date.now());
};

// ─── Preferences-backed fail counter ──────────────────────────────────────────
async function getPinFails(): Promise<number> {
  try {
    const { value } = await Preferences.get({ key: K_PIN_FAILS });
    return parseInt(value || '0', 10);
  } catch {
    return 0;
  }
}

async function setPinFails(n: number): Promise<void> {
  try {
    await Preferences.set({ key: K_PIN_FAILS, value: String(n) });
  } catch { /* ignore */ }
}

async function clearPinFails(): Promise<void> {
  try {
    await Preferences.remove({ key: K_PIN_FAILS });
  } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const hasWrappedKey = (): boolean => !!localStorage.getItem(K_WRAPPED);

export const setupPin = async (pin: string, existingKeyHex?: string): Promise<void> => {
  try {
    let dekBytes: Uint8Array;
    if (existingKeyHex) {
      dekBytes = hexToBytes(existingKeyHex);
    } else {
      dekBytes = crypto.getRandomValues(new Uint8Array(32));
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const kek  = await deriveKEK(pin, salt);

    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dekBytes);

    localStorage.setItem(K_WRAPPED, toBase64(new Uint8Array(wrapped)));
    localStorage.setItem(K_IV,      toBase64(iv));
    localStorage.setItem(K_SALT,    toBase64(salt));
    localStorage.setItem(K_PIN_TS,  String(Date.now()));

    localStorage.removeItem('sv_ek');
    try { sessionStorage.removeItem('sv_ek'); } catch {}

    await clearPinFails();
    await clearPinLock();

    DEK_HEX = bytesToHex(dekBytes);
  } catch (e) {
    logError('crypto', e);
    throw e;
  }
};

export const unlockWithPin = async (pin: string): Promise<boolean> => {
  if (await isPinLocked()) return false;
  try {
    const wrappedB64 = localStorage.getItem(K_WRAPPED);
    const ivB64      = localStorage.getItem(K_IV);
    const saltB64    = localStorage.getItem(K_SALT);
    if (!wrappedB64 || !ivB64 || !saltB64) return false;

    const salt    = fromBase64(saltB64);
    const iv      = fromBase64(ivB64);
    const wrapped = fromBase64(wrappedB64);
    const kek     = await deriveKEK(pin, salt);

    let dekBytes: ArrayBuffer;
    try {
      dekBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, wrapped);
    } catch {
      const fails = (await getPinFails()) + 1;
      if (fails >= 3) {
        await setPinLockUntil(Date.now() + 5 * 60 * 1000);
        await clearPinFails();
      } else {
        await setPinFails(fails);
      }
      return false;
    }

    DEK_HEX = bytesToHex(new Uint8Array(dekBytes));
    localStorage.setItem(K_PIN_TS, String(Date.now()));
    await clearPinFails();
    await clearPinLock();
    return true;
  } catch (e) {
    logError('crypto', e);
    return false;
  }
};

const PIN_GRACE_MS = 10 * 60 * 1000;

export const getLastPinTimestamp = (): number =>
  parseInt(localStorage.getItem(K_PIN_TS) || '0', 10);

export const requiresPinEntry = (): boolean => {
  if (!DEK_HEX) return true;
  return Date.now() - getLastPinTimestamp() >= PIN_GRACE_MS;
};

export const clearEncryptionKey = (): void => { DEK_HEX = ''; };

export const getEncryptionKey = (): string => DEK_HEX;

export const isEncryptionReady = (): boolean => DEK_HEX.length > 0;

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────
export const encrypt = async (text: string): Promise<string> => {
  if (!DEK_HEX) throw new Error('Encryption key not set. Unlock vault first.');
  const key = await importDEK(DEK_HEX);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(text);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return 'gcm1:' + toBase64(combined);
};

export const decrypt = async (ciphertext: string): Promise<string> => {
  if (!DEK_HEX) return '';
  try {
    if (!ciphertext.startsWith('gcm1:')) {
      // legacy CBC — read-only migration
      logError('crypto-legacy', new Error('Decrypting legacy CBC ciphertext'));
      const bytes = CryptoJS.AES.decrypt(ciphertext, DEK_HEX);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
    const key = await importDEK(DEK_HEX);
    const combined = fromBase64(ciphertext.slice(5));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '';
  }
};
