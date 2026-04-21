/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Plus,
  Search,
  Shield,
  Key,
  FileText,
  Settings,
  LogOut,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Star,
  Eye,
  EyeOff,
  Copy,
  Check,
  Wallet,
  Zap,
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  User,
  Ghost,
  Menu,
  X,
  ArrowLeft,
  Globe,
  Database,
  Mail,
  Smartphone,
  Library,
  Pencil,
  ShoppingBag,
  Moon,
  Sun,
  List,
  ListChecks,
  Image as ImageIcon,
  File,
  Upload,
  Download,
  Square,
  CheckSquare,
  FolderOutput,
  Volume2,
  Send,
  ExternalLink,
  Sliders,
  Share2,
  FolderOpen
} from 'lucide-react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Browser } from '@capacitor/browser';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { Note, KEY_ECOSYSTEMS, KEY_TYPES, LOGIN_TYPES, VaultSettings, ChecklistItem, ChecklistData, VaultFile, PAYMENT_WALLET_ADDRESS, PREMIUM_PRICE_USD, MAX_FILE_SIZE_BYTES, MAX_TOTAL_STORAGE_BYTES } from './types';
import CryptoJS from 'crypto-js';
import { encrypt, decrypt, clearEncryptionKey, isEncryptionReady, getEncryptionKey, hasWrappedKey, setupPin, unlockWithPin, requiresPinEntry, getLastPinTimestamp, isPinLocked, getPinLockRemainingMs, getPinFailCount, MAX_PIN_ATTEMPTS } from './utils/crypto';
import { logError } from './utils/logger';
// z-index scale: 400=toasts, 300=top modals (destroy/confirm), 200=normal modals, 100=overlays, 50=base UI
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BackupEnvelope, ExportResult, buildBackupEnvelope, exportBackupFile, exportAndShare, importBackupFile } from './utils/backupService';
import { SafSaver } from './plugins/safSaver';
import BackupRestoreModal from './components/BackupRestoreModal';
import AppToast from './components/AppToast';

// ─── Minimal Sound Effects (Web Audio API) ───────────────────────────────────
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

let _soundEnabled = true;
export const setSoundEnabled = (v: boolean) => { _soundEnabled = v; };

export const Sounds = {
  biometricSuccess: () => { if (!_soundEnabled) return; playTone(880, 0.12, 'sine', 0.12); setTimeout(() => playTone(1320, 0.10, 'sine', 0.10), 120); },
  biometricFail:    () => { if (!_soundEnabled) return; playTone(220, 0.25, 'square', 0.08); },
  walletConnect:    () => { if (!_soundEnabled) return; playTone(660, 0.08, 'sine', 0.10); setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 90); setTimeout(() => playTone(1100, 0.15, 'sine', 0.10), 180); },
  walletFail:       () => { if (!_soundEnabled) return; playTone(180, 0.20, 'sawtooth', 0.07); },
  lockVault:        () => { if (!_soundEnabled) return; playTone(440, 0.08, 'sine', 0.08); setTimeout(() => playTone(330, 0.14, 'sine', 0.07), 80); },
  unlockVault:      () => { if (!_soundEnabled) return; playTone(330, 0.08, 'sine', 0.08); setTimeout(() => playTone(440, 0.14, 'sine', 0.07), 80); },
  keyClick:         () => { if (!_soundEnabled) return; playTone(1200, 0.04, 'square', 0.05); },
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TabType = 'notes' | 'keys' | 'passwords' | 'secrets' | 'private';

// Premium SV Logo Component
function PrivateSpaceView({ isUnlocked, onUnlock, isDarkMode }: { isUnlocked: boolean, onUnlock: () => void, isDarkMode?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
      <div className={cn(
        "w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative overflow-hidden",
        isUnlocked ? "bg-emerald-500 text-white" : (isDarkMode ? "bg-white/5 text-cream/20" : "bg-graphite/5 text-graphite/20")
      )}>
        {isUnlocked ? <ShieldCheck className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
        {!isUnlocked && (
          <motion.div
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-1 bg-graphite/10 blur-sm pointer-events-none"
          />
        )}
      </div>

      <div className="space-y-3 max-w-xs">
        <h2 className={cn("text-3xl font-serif italic text-graphite", isDarkMode && "text-cream")}>
          {isUnlocked ? 'Private Space Active' : 'Private Space Locked'}
        </h2>
        <p className={cn("text-xs leading-relaxed text-graphite/60", isDarkMode && "text-cream/60")}>
          {isUnlocked
            ? 'Managed Profile API is currently active. Your data is isolated and secured by hardware Seed Vault.'
            : 'Access to this space requires Biometric verification and a Hardware Seed Vault signature.'}
        </p>
      </div>

      {!isUnlocked ? (
        <button
          onClick={onUnlock}
          className={cn(
            "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-95 transition-all",
            isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream"
          )}
        >
          Open Private Vault
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className={cn("p-6 rounded-3xl border border-graphite/5 space-y-2", isDarkMode && "bg-white/5 border-white/5")}>
            <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <p className={cn("text-[10px] font-black uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Status</p>
            <p className={cn("text-xs font-bold", isDarkMode && "text-cream")}>Isolated</p>
          </div>
          <div className={cn("p-6 rounded-3xl border border-graphite/5 space-y-2", isDarkMode && "bg-white/5 border-white/5")}>
            <div className="w-8 h-8 bg-graphite rounded-xl flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <p className={cn("text-[10px] font-black uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Hardware</p>
            <p className={cn("text-xs font-bold", isDarkMode && "text-cream")}>Seed Vault</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className={cn(
              "col-span-2 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] border border-red-500/20 text-red-500 active:scale-95 transition-all",
              isDarkMode && "bg-red-500/5"
            )}
          >
            Close & Lock Space
          </button>
        </div>
      )}

      <div className="pt-8">
        <div className={cn("flex items-center justify-center gap-2 text-graphite/20", isDarkMode && "text-cream/20")}>
          <Shield className="w-3 h-3" />
          <span className="text-[8px] uppercase tracking-[0.2em]">Android 15 Managed Profile API</span>
        </div>
      </div>
    </div>
  );
}

const SeekerLogo = ({ className, large = false, isDarkMode }: { className?: string, large?: boolean, isDarkMode?: boolean }) => (
  <div className={cn("flex items-center gap-4", className)}>
    <div className={cn(
      "relative bg-graphite rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden group transition-all",
      large ? "w-20 h-20" : "w-12 h-12",
      isDarkMode && "bg-cream"
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
      <Shield className={cn("absolute text-cream/5", large ? "w-12 h-12" : "w-8 h-8", isDarkMode && "text-graphite/5")} strokeWidth={1} />
      <span className={cn("relative font-black tracking-tighter text-cream", large ? "text-3xl" : "text-xl", isDarkMode && "text-graphite")}>SV</span>
    </div>
    <div className="flex flex-col -space-y-1">
      <span className={cn("font-serif italic font-bold text-graphite", large ? "text-3xl" : "text-xl", isDarkMode && "text-cream")}>Seeker</span>
      <span className={cn("font-bold uppercase tracking-[0.4em] text-graphite/40", large ? "text-[12px]" : "text-[9px]", isDarkMode && "text-cream/40")}>Vault</span>
    </div>
  </div>
);

export default function App() {
  return (
    <VaultApp />
  );
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
};

const EXT_COLORS: Record<string, string> = {
  PDF: '#ef4444', DOC: '#3b82f6', DOCX: '#3b82f6',
  TXT: '#6b7280', ZIP: '#f59e0b', RAR: '#f59e0b', '7Z': '#f59e0b',
  CSV: '#22c55e', XLS: '#22c55e', XLSX: '#22c55e',
  MP3: '#a855f7', WAV: '#a855f7', OGG: '#a855f7', FLAC: '#a855f7',
  MP4: '#06b6d4', MOV: '#06b6d4', AVI: '#06b6d4', MKV: '#06b6d4',
  PNG: '#14b8a6', JPG: '#14b8a6', JPEG: '#14b8a6', WEBP: '#14b8a6', GIF: '#14b8a6',
  JSON: '#f97316', XML: '#f97316', HTML: '#f97316',
  APK: '#10b981', JS: '#eab308', TS: '#3b82f6', PY: '#3b82f6',
};

const getExtColor = (ext: string): string => EXT_COLORS[ext] || '#9ca3af';

// Lazy image preview component — decrypts on mount with retry
const ImagePreviewLoader: React.FC<{ file: VaultFile; onLoad: (url: string) => void; decrypt: (data: string) => Promise<string>; loadFileData: (id: string) => Promise<string> }> = ({ file, onLoad, decrypt, loadFileData }) => {
  const [failed, setFailed] = React.useState(false);
  const attempted = React.useRef(false);
  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    if (attempted.current) return;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const tryDecrypt = async () => {
      try {
        const cipher = await loadFileData(file.id);
        const dec = await decrypt(cipher);
        if (dec) {
          attempted.current = true;
          onLoad(`data:${file.mimeType};base64,${dec}`);
          return true;
        }
      } catch {}
      return false;
    };
    tryDecrypt().then(ok => {
      if (!ok) {
        t1 = setTimeout(() => {
          tryDecrypt().then(ok2 => {
            if (!ok2) {
              t2 = setTimeout(() => { tryDecrypt().then(ok3 => { if (!ok3 && mountedRef.current) setFailed(true); }); }, 1000);
            }
          });
        }, 300);
      }
    });
    return () => {
      mountedRef.current = false;
      if (t1 !== undefined) clearTimeout(t1);
      if (t2 !== undefined) clearTimeout(t2);
    };
  }, [file.id]);
  if (failed) return (
    <div className="w-full h-full flex items-center justify-center bg-black/5">
      <Lock className="w-6 h-6 text-white/30" />
    </div>
  );
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
  );
};

function VaultApp() {
  const [isLocked, setIsLocked] = useState(true);
  const [isPrivateSpaceUnlocked, setIsPrivateSpaceUnlocked] = useState(false);
  const [bioAttempts, setBioAttempts] = useState(0);
  const [bioCooldown, setBioCooldown] = useState(false);
  const [bioCooldownUntil, setBioCooldownUntil] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinStep, setPinStep] = useState('enter');
  const [firstPin, setFirstPin] = useState('');
  // Migration / security upgrade modal
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationPin, setMigrationPin] = useState('');
  const [migrationPinConfirm, setMigrationPinConfirm] = useState('');
  const [migrationStep, setMigrationStep] = useState<'enter' | 'confirm'>('enter');
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState('');
  const [migrationDek, setMigrationDek] = useState<string | null>(null);
  const [pendingPubKey, setPendingPubKey] = useState('');
  const [changePinStep, setChangePinStep] = useState(null);
  const [changePinInput, setChangePinInput] = useState('');
  const [changePinNew, setChangePinNew] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [pinLockRemaining, setPinLockRemaining] = useState(0);
  const [pinFails, setPinFails] = useState(0);
  const [settings, setSettings] = useState<VaultSettings>(() => {
    const saved = localStorage.getItem('seeker_vault_settings');
    const parsed = saved ? JSON.parse(saved) : {};
    // PIN is mandatory (unwraps the encryption key) — force to true regardless of saved state.
    return {
      autoLockTimeout: 3,
      isDarkMode: false,
      isPremium: false,
      biometricEnabled: true,
      walletEnabled: true,
      soundEnabled: true,
      ...parsed,
    };
  });
  const [prices, setPrices] = useState<{ sol: number, skr: number }>({ sol: 0, skr: 0 });
  const [selectedPayToken, setSelectedPayToken] = useState<'SOL' | 'SKR' | 'USDC'>('SOL');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsScreen, setSettingsScreen] = useState<'main' | 'security' | 'preferences' | 'premium'>('main');
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => localStorage.getItem('seeker_vault_terms_accepted') === 'true');
  const [showTermsOnly, setShowTermsOnly] = useState(false);
  const [authStep, setAuthStep] = useState<'biometric' | 'wallet' | 'pin'>('biometric');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [isEditing, setIsEditing] = useState(false);
  const [showContent, setShowContent] = useState<Record<string, boolean>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [biometricRevealTarget, setBiometricRevealTarget] = useState<string | null>(null);
  const [isRevealScanning, setIsRevealScanning] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [fileCategory, setFileCategory] = useState<string>('all');
  const [isVaultFolderOpen, setIsVaultFolderOpen] = useState(false);
  const filePickerActive = useRef(false);
  const [decryptingProgress, setDecryptingProgress] = useState({ current: 0, total: 0 });
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const previewOrder = useRef<string[]>([]);
  const addPreview = useCallback((id: string, url: string) => {
    setPreviewCache(prev => {
      const next: Record<string, string> = { ...prev, [id]: url };
      previewOrder.current.push(id);
      while (previewOrder.current.length > 10) {
        const drop = previewOrder.current.shift()!;
        delete next[drop];
      }
      return next;
    });
  }, []);
  const [confirmState, setConfirmState] = useState<null | {
    title: string; body: string; confirmText: string; danger: boolean;
    resolve: (v: boolean) => void;
  }>(null);
  const askConfirm = (title: string, body: string, confirmText = 'Confirm', danger = false) =>
    new Promise<boolean>(resolve => setConfirmState({ title, body, confirmText, danger, resolve }));
  const [viewingFile, setViewingFile] = useState<VaultFile | null>(null);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [destroyPinInput, setDestroyPinInput] = useState('');
  const [destroyPinError, setDestroyPinError] = useState('');
  const [previewBackupData, setPreviewBackupData] = useState<BackupEnvelope | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupBusy, setBackupBusy] = useState<'idle' | 'exporting' | 'importing'>('idle');
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ type: 'info' | 'success' | 'error' | 'loading'; title?: string; message: string } | null>(null);
  const [pendingShareEnvelope, setPendingShareEnvelope] = useState<BackupEnvelope | null>(null);

  const showToast = (type: 'info' | 'success' | 'error' | 'loading', message: string, title?: string) =>
    setToast({ type, title, message });
  const hideToast = () => setToast(null);

  // ─── visualViewport: track keyboard height for fixed Save button ──────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb-height', `${kbHeight}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  // ─── IndexedDB helpers (unlimited storage) ───────────────────────────────
  const IDB_NAME = 'seeker_vault_idb';
  const IDB_STORE = 'files';

  const openIDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });

  const loadVaultFiles = async (): Promise<VaultFile[]> => {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a: VaultFile, b: VaultFile) => b.createdAt.localeCompare(a.createdAt)));
        req.onerror = () => resolve([]);
      });
    } catch { return []; }
  };

  const loadVaultFilesMetadata = async (): Promise<VaultFile[]> => {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => {
          const stripped = (req.result || []).map((f: VaultFile) => ({ ...f, data: '' }));
          resolve(stripped.sort((a: VaultFile, b: VaultFile) => b.createdAt.localeCompare(a.createdAt)));
        };
        req.onerror = () => resolve([]);
      });
    } catch { return []; }
  };

  const loadFileData = async (id: string): Promise<string> => {
    try {
      const db = await openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(id);
        req.onsuccess = () => resolve(req.result?.data || '');
        req.onerror = () => resolve('');
      });
    } catch { return ''; }
  };

  const saveFileToIDB = async (file: VaultFile): Promise<void> => {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(file);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  };

  const deleteFileFromIDB = async (id: string): Promise<void> => {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  };

  const getTotalFileSize = () => vaultFiles.reduce((sum, f) => sum + f.size, 0);

  const handleRestoreFile = async (file: VaultFile) => {
    try {
      const cipher = await loadFileData(file.id);
      const decryptedData = await decrypt(cipher);
      if (!decryptedData) {
        showToast('error', 'Could not decrypt file.', 'Decrypt error');
        return;
      }
      try {
        await SafSaver.saveFile({ filename: file.name, data: decryptedData, mimeType: file.mimeType || 'application/octet-stream' });
        showToast('success', `Saved to Documents/${file.name}`, 'File saved');
      } catch (error) {
        logError('file-save', error); showToast('error', 'Failed to save file', 'Save error');
      }
    } catch (error) {
      logError('file-restore', error); showToast('error', 'Failed to restore file', 'Restore error');
    }
  };

  const handleRestoreAllFiles = async () => {
    if (!vaultFiles.length) {
      showToast('info', 'No files to restore', 'Vault empty');
      return;
    }
    if (!await askConfirm(
      'Restore All Files',
      `${vaultFiles.length} file(s) will be saved silently to the public Downloads folder under their original names. Files will be UNENCRYPTED on your device after restore.\n\nContinue?`,
      'Restore to Downloads',
      false
    )) return;

    showToast('info', `Restoring ${vaultFiles.length} files to Downloads/...`, 'Starting');
    let restored = 0;
    let failed = 0;
    for (const file of vaultFiles) {
      try {
        const cipher = await loadFileData(file.id);
        const decryptedData = await decrypt(cipher);
        if (!decryptedData) { failed++; continue; }
        await SafSaver.saveFile({
          filename: file.name,
          data: decryptedData,
          mimeType: file.mimeType || 'application/octet-stream',
          skipPicker: true,
        });
        restored++;
      } catch (e) {
        logError('file-restore-all', e, { file: file.name });
        failed++;
      }
    }
    if (failed === 0) {
      showToast('success', `${restored} files saved to Downloads/ — now UNENCRYPTED on device`, 'Restore complete');
    } else {
      showToast('info', `Saved ${restored}/${vaultFiles.length} to Downloads/. ${failed} failed.`, 'Partial restore');
    }
  };

  const getPreview = async (file: VaultFile): Promise<string> => {
    if (previewCache[file.id]) return previewCache[file.id];
    const cipher = await loadFileData(file.id);
    const dec = await decrypt(cipher);
    if (!dec) return '';
    const url = `data:${file.mimeType};base64,${dec}`;
    addPreview(file.id, url);
    return url;
  };

  const openFileFromVault = async (file: VaultFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (file.mimeType.startsWith('image') || file.mimeType.startsWith('video')) {
      setViewingFile(file);
      return;
    }
    try {
      const cipher = await loadFileData(file.id);
      const dec = await decrypt(cipher);
      if (!dec) { showToast('error', 'Could not decrypt file.', 'Decrypt error'); return; }
      try { await Filesystem.mkdir({ path: 'vault_temp', directory: Directory.Data, recursive: true }); } catch (e) { logError('file-open-mkdir', e); }
      await Filesystem.writeFile({ path: 'vault_temp/' + file.name, data: dec, directory: Directory.Data });
      const fileUri = await Filesystem.getUri({ path: 'vault_temp/' + file.name, directory: Directory.Data });
      if ((navigator as any).share) {
        try {
          const response = await fetch(`data:${file.mimeType};base64,${dec}`);
          const blob = await response.blob();
          const shareFile = new File([blob], file.name, { type: file.mimeType });
          await (navigator as any).share({ files: [shareFile], title: file.name });
          return;
        } catch (_) {}
      }
      window.open(fileUri.uri, '_system');
    } catch (error) {
      logError('file-open', error); showToast('error', 'Cannot open file', 'Open error');
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    return new Blob([byteArray], { type: mimeType });
  };

  const downloadFileFromVault = async (file: VaultFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const cipher = await loadFileData(file.id);
      const dec = await decrypt(cipher);
      if (!dec) { showToast('error', 'Could not decrypt file.', 'Decrypt error'); return; }

      // Method 1: SAF picker — Scoped Storage compatible on Android 10+
      try {
        await SafSaver.saveFile({ filename: file.name, data: dec, mimeType: file.mimeType || 'application/octet-stream' });
        showToast('info', `Saved — file is now UNENCRYPTED on device`, 'Exported');
        return;
      } catch (err1) {
        // Method 2: Web Share API fallback
        if ((navigator as any).share && (navigator as any).canShare) {
          try {
            const blob = base64ToBlob(dec, file.mimeType || 'application/octet-stream');
            const shareFile = new File([blob], file.name, { type: file.mimeType || 'application/octet-stream' });
            if ((navigator as any).canShare({ files: [shareFile] })) {
              await (navigator as any).share({ files: [shareFile], title: file.name });
              return;
            }
          } catch (_) {}
        }
        logError('file-download-fallback', err1);
        showToast('error', 'Could not save file', 'Save error');
      }
    } catch (error) {
      logError('file-download', error); showToast('error', 'Download failed', 'Download error');
    }
  };

  const handleOpenVaultFolder = async () => {
    if (!vaultFiles.length) { showToast('info', 'No files in vault', 'Vault empty'); return; }
    setDecryptingProgress({ current: 0, total: vaultFiles.length });
    try {
      try { await Filesystem.rmdir({ path: 'vault_temp', directory: Directory.Data, recursive: true }); } catch (e) { logError('vault-cleanup', e); }
      await Filesystem.mkdir({ path: 'vault_temp', directory: Directory.Data, recursive: true });
      for (let i = 0; i < vaultFiles.length; i++) {
        const file = vaultFiles[i];
        const cipher = await loadFileData(file.id);
        const decryptedData = await decrypt(cipher);
        if (decryptedData) {
          await Filesystem.writeFile({
            path: 'vault_temp/' + file.name,
            data: decryptedData,
            directory: Directory.Data,
          });
        }
        setDecryptingProgress({ current: i + 1, total: vaultFiles.length });
      }
      setIsVaultFolderOpen(true);
    } catch (error) {
      logError('vault-folder-open', error); showToast('error', 'Could not open vault folder', 'Error');
    }
    setDecryptingProgress({ current: 0, total: 0 });
  };

  const handleCloseVaultFolder = async () => {
    try {
      await Filesystem.rmdir({ path: 'vault_temp', directory: Directory.Data, recursive: true });
    } catch (e) { logError('vault-folder-close', e); }
    setIsVaultFolderOpen(false);
  };

  const handleOpenFileWithSystem = async (fileName: string) => {
    try {
      const fileUri = await Filesystem.getUri({ path: 'vault_temp/' + fileName, directory: Directory.Data });
      window.open(fileUri.uri, '_system');
    } catch (error) {
      logError('file-system-open', error); showToast('error', 'Cannot open file', 'Open error');
    }
  };

  const formatSize = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  // ─── One-time migration: legacy sv_ek → PIN-wrapped DEK ─────────────────────
  useEffect(() => {
    if (hasWrappedKey()) return; // Already migrated
    const legacyKey = localStorage.getItem('sv_ek');
    if (legacyKey) {
      localStorage.removeItem('sv_ek'); // consume immediately — better lost than leaked
      setMigrationDek(legacyKey);
      setShowMigrationModal(true);
    }
    // Fresh install: no legacy key, no wrapped key — handled by normal first-use flow
  }, []);

  // ─── Restore bio rate-limit state from Preferences on mount ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const [failsRes, cooldownRes] = await Promise.all([
          Preferences.get({ key: 'sv_bio_fails' }),
          Preferences.get({ key: 'sv_bio_cooldown_until' }),
        ]);
        const fails = parseInt(failsRes.value || '0', 10);
        const until = parseInt(cooldownRes.value || '0', 10);
        setBioAttempts(fails);
        if (until > Date.now()) {
          setBioCooldown(true);
          setBioCooldownUntil(until);
          const bioTid = setTimeout(() => { setBioCooldown(false); setBioAttempts(0); setBioCooldownUntil(0); Preferences.remove({ key: 'sv_bio_fails' }); Preferences.remove({ key: 'sv_bio_cooldown_until' }); }, until - Date.now());
          return () => clearTimeout(bioTid);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // StatusBar: overlay mode + transparent bg. Icon color forced to LIGHT natively
  // via MainActivity (WindowInsetsControllerCompat) — works reliably on Android 15.
  useEffect(() => {
    (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
      } catch (_) {
        // Not running on mobile — ignore
      }
    })();
  }, []);


  // Inactivity timer
  useEffect(() => {
    if (isLocked) return;

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (filePickerActive.current) {
          timeoutId = setTimeout(resetTimer, 30_000);
          return;
        }
        clearEncryptionKey();
        try { localStorage.removeItem('sv_locked'); localStorage.removeItem('sv_private_unlocked'); } catch {}
        setIsLocked(true);
        setAuthStep('biometric');
        setSelectedNote(null); // Clear selection on lock
      }, Math.min(settings.autoLockTimeout, 10) * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isLocked, settings.autoLockTimeout]);

  // Fetch Prices
  useEffect(() => {
    const fetchPrices = async () => {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const SKR_MINT_ADDR = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
      let solPrice = 0;
      let skrPrice = 0;

      // SOL: CoinGecko primary (reliable, free)
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const d = await r.json();
        if (d?.solana?.usd) solPrice = Number(d.solana.usd);
      } catch (e) { logError('price-sol-coingecko', e); }

      // SKR: DexScreener primary
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SKR_MINT_ADDR}`);
        const d = await r.json();
        if (d?.pairs?.length) {
          const sorted = [...d.pairs].sort((a: any, b: any) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
          if (sorted[0]?.priceUsd) skrPrice = Number(sorted[0].priceUsd);
        }
      } catch (e) { logError('price-skr-dexscreener', e); }

      // SKR fallback + SOL fallback: Jupiter Price API v2
      try {
        const ids = [!solPrice && SOL_MINT, !skrPrice && SKR_MINT_ADDR].filter(Boolean).join(',');
        if (ids) {
          const r = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
          const d = await r.json();
          if (!solPrice && d?.data?.[SOL_MINT]?.price) solPrice = Number(d.data[SOL_MINT].price);
          if (!skrPrice && d?.data?.[SKR_MINT_ADDR]?.price) skrPrice = Number(d.data[SKR_MINT_ADDR].price);
        }
      } catch (e) { logError('price-jup-fallback', e); }

      setPrices({ sol: solPrice, skr: skrPrice });
    };

    if (showCatalog) {
      fetchPrices();
    }
  }, [showCatalog]);

  useEffect(() => {
    if (isLocked) {
      setPreviewCache({});
      try { localStorage.removeItem('sv_private_unlocked'); } catch {}
      setIsPrivateSpaceUnlocked(false);
      if (isVaultFolderOpen) {
        handleCloseVaultFolder();
      }
    }
  }, [isLocked]);

  useEffect(() => {
    let backgroundTimestamp: number | null = null;

    const onVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimestamp = Date.now();
        try { localStorage.setItem('sv_last_active_ts', String(backgroundTimestamp)); } catch {}
        // Lock Private space when app goes to background (but not during file picker)
        if (isPrivateSpaceUnlocked && !filePickerActive.current) {
          setPreviewCache({});
          try { localStorage.removeItem('sv_private_unlocked'); } catch {}
          setIsPrivateSpaceUnlocked(false);
        }
        if (isVaultFolderOpen && !filePickerActive.current) {
          handleCloseVaultFolder();
        }
      } else {
        if (filePickerActive.current) {
          backgroundTimestamp = null;
          return;
        }
        if (!isLocked && backgroundTimestamp !== null) {
          const elapsed = Date.now() - backgroundTimestamp;
          if (elapsed >= settings.autoLockTimeout * 60 * 1000) {
            clearEncryptionKey();
            try { localStorage.removeItem('sv_locked'); localStorage.removeItem('sv_private_unlocked'); } catch {}
            setIsLocked(true);
            setAuthStep('biometric');
            setSelectedNote(null);
          }
        }
        backgroundTimestamp = null;
      }
    };

    const handlePagehide = () => {
      Filesystem.rmdir({ path: 'vault_temp', directory: Directory.Data, recursive: true }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', handlePagehide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handlePagehide);
    };
  }, [isVaultFolderOpen, isLocked, isPrivateSpaceUnlocked, settings.autoLockTimeout]);

  // Private locks when main vault locks (via isLocked useEffect above)
  // No separate Private auto-lock — main vault inactivity timer handles security

  useEffect(() => {
    localStorage.setItem('seeker_vault_settings', JSON.stringify(settings));
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setSoundEnabled(settings.soundEnabled !== false);
  }, [settings]);

  useEffect(() => {
    if (!isLocked) {
      fetchNotes();
    }
  }, [isLocked]);

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const tick = async () => {
      const ms = await getPinLockRemainingMs();
      setPinLockRemaining(ms);
      if (ms <= 0) clearInterval(id);
    };
    isPinLocked().then(locked => {
      if (!locked) { setPinLockRemaining(0); return; }
      tick();
      id = setInterval(tick, 1000);
    });
    getPinFailCount().then(setPinFails);
    return () => clearInterval(id);
  }, [showPinModal, isLocked]);

  const STORAGE_KEY = 'seeker_vault_notes';

  const loadNotes = (): Note[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const persistNotes = (data: Note[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setNotes(data);
  };

  const fetchNotes = async () => {
    setNotes(loadNotes());
    const files = await loadVaultFilesMetadata();
    setVaultFiles(files);
  };

  const handleBackupExport = async () => {
    filePickerActive.current = true;
    setTimeout(() => { filePickerActive.current = false; }, 40000);
    try {
      setBackupBusy('exporting');
      const envelope = await buildBackupEnvelope(notes, loadVaultFiles, settings);
      const result = await exportBackupFile(envelope);
      if (result.cancelled) {
        setBackupBusy('idle');
        return;
      }
      setPendingShareEnvelope(envelope);
      setLastExport(result);
    } catch (e: any) {
      logError('backup-export', e); showToast('error', 'Export failed', 'Export failed');
    } finally {
      filePickerActive.current = false;
      setBackupBusy('idle');
    }
  };

  const handleBackupImportPick = () => { filePickerActive.current = true; setTimeout(() => { filePickerActive.current = false; }, 40000); backupFileInputRef.current?.click(); };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.vault')) {
      showToast('error', 'Please select a file with .vault extension', 'Invalid file');
      e.target.value = '';
      return;
    }
    try {
      setBackupBusy('importing');
      const envelope = await importBackupFile(file);
      setPreviewBackupData(envelope);
      setShowBackupModal(true);
    } catch (err: any) {
      logError('backup-import', err); showToast('error', 'Import failed', 'Import failed');
    } finally {
      filePickerActive.current = false;
      setBackupBusy('idle');
      e.target.value = '';
    }
  };

  const handleRestoreSelected = async (sel: { noteIds: Set<string>; fileIds: Set<string>; includeSettings: boolean }) => {
    if (!previewBackupData) return;
    const filteredNotes = previewBackupData.notes.filter(n => sel.noteIds.has(n.id));
    const selectedNotes = await Promise.all(filteredNotes.map(async n =>
      previewBackupData.plaintextPayload ? { ...n, content: await encrypt(n.content) } : n
    ));
    const existingIds = new Set(notes.map(n => n.id));
    const merged = [
      ...notes.map(n => selectedNotes.find(s => s.id === n.id) || n),
      ...selectedNotes.filter(s => !existingIds.has(s.id))
    ];
    persistNotes(merged);

    const selectedFiles = previewBackupData.files.filter(f => sel.fileIds.has(f.id));
    for (const f of selectedFiles) {
      const reEnc = previewBackupData.plaintextPayload ? { ...f, data: await encrypt(f.data) } : f;
      await saveFileToIDB(reEnc);
    }
    setVaultFiles(await loadVaultFilesMetadata());

    if (sel.includeSettings) {
      setSettings(prev => ({ ...previewBackupData.settings, isPremium: prev.isPremium }));
    }

    handleBackupModalClose();
    showToast('success', `Restored: ${selectedNotes.length} notes, ${selectedFiles.length} files`, 'Restore complete');
  };

  const handleBackupModalClose = () => {
    setPreviewBackupData(null);
    setShowBackupModal(false);
  };

  const getFirstUnlockStep = (s: typeof settings): 'biometric' | 'wallet' | 'pin' => {
    if (s.biometricEnabled) return 'biometric';
    if (s.walletEnabled) return 'wallet';
    return 'pin';
  };

  const advanceUnlockStep = (current: 'biometric' | 'wallet' | 'pin', s: typeof settings) => {
    if (current === 'biometric') {
      if (s.walletEnabled) { setAuthStep('wallet'); return; }
      // PIN is always required now (DEK unwrap)
      setAuthStep('pin'); setShowPinModal(true); return;
    }
    if (current === 'wallet') {
      // PIN is always required now (DEK unwrap)
      setAuthStep('pin'); setShowPinModal(true); return;
    }
    // PIN step completed — unlock is handled inside handlePinSubmit after unlockWithPin().
    // This branch should not be reached directly; kept for safety.
    if (pendingPubKey) localStorage.setItem('seeker_vault_wpk', pendingPubKey);
    Sounds.unlockVault();
    setIsLocked(false);
    setShowPinModal(false);
    setPinInput('');
    setPendingPubKey('');
  };

  const handleBiometricUnlock = async () => {
    setIsScanning(true);
    Sounds.keyClick();
    try {
      const isAvailable = await NativeBiometric.isAvailable();
      if (!isAvailable.isAvailable) {
        showToast('error', 'Enable biometrics in device settings or use PIN', 'Biometrics unavailable');
        Sounds.biometricFail();
        return;
      }
      await NativeBiometric.verifyIdentity({
        reason: 'Authorize access to Seeker Vault',
        title: 'Seeker Security Stack',
        subtitle: 'Verify Biometric Identity',
      });
      Sounds.biometricSuccess();
      advanceUnlockStep('biometric', settings);
    } catch (err) {
      logError('biometric-auth', err);
      Sounds.biometricFail();
      // Biometric failed — show retry only, do NOT skip to other methods
    } finally {
      setIsScanning(false);
    }
  };

  // MWA spec requires identity.icon to be a RELATIVE URI (relative to uri).
  // Absolute URLs trigger "identity.icon must be a relative URI" in Seeker wallet.
  const MWA_IDENTITY = {
    name: 'Seeker Vault',
    uri: 'https://seekervault.whoim.space',
    icon: 'favicon.ico',
  };

  const authorizeWallet = async (wallet: any) => {
    try {
      return await wallet.authorize({ cluster: 'mainnet-beta', identity: MWA_IDENTITY });
    } catch (e1: any) {
      try {
        return await wallet.authorize({ chain: 'solana:mainnet', identity: MWA_IDENTITY });
      } catch (e2: any) {
        throw new Error(`Wallet authorization failed: ${e2?.message || e1?.message || 'unknown'}`);
      }
    }
  };

  const handleWalletUnlock = async () => {
    Sounds.keyClick();
    try {
      // Direct MWA transact() call — exactly matching the working Aibat app.
      // This bypasses the wallet-adapter framework entirely, avoiding
      // WalletNotSelectedError and React state timing issues.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const authResult = await transact(async (wallet: any) => {
          const auth = await authorizeWallet(wallet);
          return auth;
        });

        if (authResult?.accounts?.length > 0) {
          const rawAddress = authResult.accounts[0].address;

          // CRITICAL: This exact toBase58 function was used to encrypt existing files.
          // DO NOT change it — any change will make existing encrypted files unreadable.
          const toBase58 = (bytes: Uint8Array): string => {
            const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let num = BigInt(0);
            for (const byte of bytes) {
              num = num * BigInt(256) + BigInt(byte);
            }
            let encoded = '';
            while (num > BigInt(0)) {
              const remainder = Number(num % BigInt(58));
              num = num / BigInt(58);
              encoded = alphabet[remainder] + encoded;
            }
            for (const byte of bytes) {
              if (byte === 0) encoded = '1' + encoded;
              else break;
            }
            return encoded;
          };

          let pubKey: string;
          if (rawAddress instanceof Uint8Array) {
            pubKey = toBase58(rawAddress);
          } else if (typeof rawAddress === 'string') {
            const binaryStr = atob(rawAddress);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            pubKey = toBase58(bytes);
          } else {
            pubKey = String(rawAddress);
          }

          Sounds.walletConnect();
          setPendingPubKey(pubKey);
          advanceUnlockStep('wallet', settings);
        } else {
          Sounds.walletFail();
          showToast('error', 'No accounts returned from wallet', 'Wallet error');
        }
      } else {
        // Desktop fallback: try browser extension wallets
        let provider = null;
        if ((window as any).solana) {
          provider = (window as any).solana;
        } else if ((window as any).solflare) {
          provider = (window as any).solflare;
        }
        if (provider) {
          const resp = await provider.connect();
          const pubKey = resp.publicKey.toString();
          try {
            const message = new TextEncoder().encode('Unlock Seeker Vault ' + Date.now());
            const { signature } = await provider.signMessage(message, 'utf8');
            if (!signature) { showToast('error', 'Signature required to unlock.', 'Wallet error'); return; }
          } catch {
            showToast('error', 'Wallet signature required to unlock.', 'Wallet error');
            return;
          }
          Sounds.walletConnect();
          setPendingPubKey(pubKey);
          advanceUnlockStep('wallet', settings);
        } else {
          Sounds.walletFail();
          showToast('error', 'No Solana wallet found. Install a browser extension.', 'Wallet not found');
        }
      }
    } catch (err: any) {
      Sounds.walletFail();
      if (err?.message?.includes('Found no installed')) {
        showToast('error', 'No compatible wallet app found.', 'Wallet not found');
      } else if (err?.message?.includes('User rejected') || err?.message?.includes('rejected')) {
        showToast('error', 'Wallet connection was rejected.', 'Rejected');
      } else {
        logError('wallet-connect', err); showToast('error', 'Wallet connection failed', 'Wallet error');
      }
    }
  };



  const handleAcceptTerms = () => {
    localStorage.setItem('seeker_vault_terms_accepted', 'true');
    setHasAcceptedTerms(true);
  };

  const saveNote = async (note: Partial<Note>) => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: note.id || crypto.randomUUID(),
      title: note.title || 'Untitled',
      content: await encrypt(note.content || ''),
      type: (note.type || activeTab) as Note['type'],
      category: note.category || 'Other',
      importance: note.importance || 0,
      created_at: note.created_at || now,
      updated_at: now,
    };

    const existing = loadNotes();
    const idx = existing.findIndex(n => n.id === newNote.id);
    if (idx >= 0) {
      existing[idx] = newNote;
    } else {
      existing.unshift(newNote);
    }
    persistNotes(existing);
    setIsEditing(false);
    setSelectedNote(null);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const deleteNote = async (id: string) => {
    if (!id) {
      setSelectedNote(null);
      setIsEditing(false);
      return;
    }

    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    const id = showDeleteConfirm;

    try {
      const existing = loadNotes();
      const filtered = existing.filter(n => n.id !== id);
      persistNotes(filtered);
      setSelectedNote(null);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to delete note', err);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => n.type === activeTab)
      .filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [notes, activeTab, searchQuery]);

  const filteredVaultFiles = useMemo(() => {
    return vaultFiles.filter(file => {
      const matchesSearch = !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = fileCategory === 'all' ||
        (fileCategory === 'photos' && file.mimeType.startsWith('image/')) ||
        (fileCategory === 'videos' && file.mimeType.startsWith('video/')) ||
        (fileCategory === 'documents' && /\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i.test(file.name)) ||
        (fileCategory === 'archives' && /\.(zip|rar|7z|tar|gz)$/i.test(file.name));
      return matchesSearch && matchesCategory;
    });
  }, [vaultFiles, searchQuery, fileCategory]);

  const toggleShowContent = (id: string) => {
    if (!showContent[id]) {
      setBiometricRevealTarget(id);
    } else {
      setShowContent(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleBiometricRevealConfirm = async () => {
    if (bioCooldown) {
      showToast('error', 'Too many failed attempts. Please wait 60 seconds.', 'Locked');
      return;
    }
    setIsRevealScanning(true);
    try {
      const isAvailable = await NativeBiometric.isAvailable();
      if (!isAvailable.isAvailable) {
        showToast('error', 'Enable biometrics in device settings', 'Biometrics unavailable');
        setIsRevealScanning(false);
        return;
      }
      await NativeBiometric.verifyIdentity({
        reason: 'Authorize biometric authorization step',
        title: 'Seeker Security Stack',
        subtitle: 'Verify Biometric Identity',
      });

      // Success Path
      if (biometricRevealTarget) {
        if (biometricRevealTarget === 'edit') {
          setIsEditing(true);
        } else if (biometricRevealTarget === 'private-space') {
          setIsPrivateSpaceUnlocked(true);
        } else {
          setShowContent(prev => ({ ...prev, [biometricRevealTarget]: true }));
        }
        setBiometricRevealTarget(null);
      }
    } catch (err) {
      console.error('Biometric auth failed during reveal', err);
      const newAttempts = bioAttempts + 1;
      setBioAttempts(newAttempts);
      await Preferences.set({ key: 'sv_bio_fails', value: String(newAttempts) });
      if (newAttempts >= 3) {
        const until = Date.now() + 5 * 60 * 1000;
        setBioCooldown(true);
        setBioCooldownUntil(until);
        await Preferences.set({ key: 'sv_bio_cooldown_until', value: String(until) });
        showToast('error', 'Too many failed attempts. Locked for 5 minutes.', 'Locked');
        setTimeout(() => { setBioCooldown(false); setBioAttempts(0); setBioCooldownUntil(0); Preferences.remove({ key: 'sv_bio_fails' }); Preferences.remove({ key: 'sv_bio_cooldown_until' }); }, 5 * 60 * 1000);
      }
    } finally {
      setIsRevealScanning(false);
    }
  };

  const handleChangePinStep = async () => {
    if (changePinStep === 'current') {
      if (!changePinInput || changePinInput.length < 4) { setChangePinError('Min. 4 characters'); return; }
      // Verify current PIN by trying to unwrap (but we don't want to re-lock memory)
      const ok = await unlockWithPin(changePinInput);
      if (!ok) { setChangePinError('Wrong PIN'); setChangePinInput(''); return; }
      setChangePinNew('');
      setChangePinInput('');
      setChangePinError('');
      setChangePinStep('new');
    } else if (changePinStep === 'new') {
      if (!changePinInput || changePinInput.length < 4) { setChangePinError('Min. 4 characters'); return; }
      setChangePinNew(changePinInput);
      setChangePinInput('');
      setChangePinError('');
      setChangePinStep('confirm');
    } else if (changePinStep === 'confirm') {
      if (changePinInput !== changePinNew) { setChangePinError('PINs do not match'); setChangePinInput(''); return; }
      try {
        // Re-wrap existing in-memory DEK with new PIN
        await setupPin(changePinInput, getEncryptionKey() || undefined);
      } catch {
        setChangePinError('Failed to update PIN');
        setChangePinInput('');
        return;
      }
      setChangePinInput('');
      setChangePinNew('');
      setChangePinError('');
      setChangePinStep('success');
      setTimeout(() => setChangePinStep(null), 2000);
    }
  };

  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length < 4) { showToast('error', 'PIN must be at least 4 characters', 'Invalid PIN'); return; }

    if (await isPinLocked()) {
      const ms = await getPinLockRemainingMs();
      const mm = Math.floor(ms / 60000);
      const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
      showToast('error', `Too many attempts. Try in ${mm}:${ss}`, 'Locked');
      return;
    }

    if (!hasWrappedKey()) {
      // First-time setup — collect PIN with confirmation
      if (pinStep === 'enter') {
        setFirstPin(pinInput);
        setPinInput('');
        setPinStep('confirm');
        return;
      }
      // Confirm step
      if (pinInput !== firstPin) {
        showToast('error', 'PINs do not match', 'PIN mismatch');
        setPinInput('');
        setFirstPin('');
        setPinStep('enter');
        return;
      }
      // Setup wrapped DEK
      try {
        await setupPin(pinInput);
      } catch (e) {
        showToast('error', 'Failed to set up PIN', 'Error');
        setPinInput('');
        return;
      }
    } else {
      // Unwrap existing DEK
      const ok = await unlockWithPin(pinInput);
      if (!ok) {
        // Check if this failure triggered the lockout
        if (await isPinLocked()) {
          const ms = await getPinLockRemainingMs();
          const mm = Math.floor(ms / 60000);
          const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
          setPinLockRemaining(ms);
          setPinFails(0);
          showToast('error', `Too many attempts. Locked for ${mm}:${ss}`, 'Vault locked');
        } else {
          const fails = await getPinFailCount();
          setPinFails(fails);
          const remaining = Math.max(0, MAX_PIN_ATTEMPTS - fails);
          if (remaining === 1) {
            showToast('error', '1 attempt left — vault will lock for 5 min', 'Wrong PIN');
          } else {
            showToast('error', `Wrong PIN — ${remaining} attempts left`, 'Wrong PIN');
          }
        }
        setPinInput('');
        return;
      }
    }

    // PIN accepted — finalize unlock
    if (pendingPubKey) localStorage.setItem('seeker_vault_wpk', pendingPubKey);
    Sounds.unlockVault();
    setIsLocked(false);
    setShowPinModal(false);
    setPinInput('');
    setFirstPin('');
    setPinStep('enter');
    setPendingPubKey('');
    setPinFails(0);
    hideToast(); // dismiss any lingering "Wrong PIN" toast from earlier attempts
  };

  // ─── Migration modal: security upgrade for legacy sv_ek users ───────────────
  if (showMigrationModal) {
    const handleMigrationSubmit = async () => {
      if (!migrationPin || migrationPin.length < 4) { setMigrationError('PIN must be at least 4 characters'); return; }
      if (migrationStep === 'enter') {
        setMigrationPinConfirm(migrationPin);
        setMigrationStep('confirm');
        setMigrationError('');
        setMigrationPin('');
        return;
      }
      if (migrationPin !== migrationPinConfirm) {
        setMigrationError('PINs do not match');
        setMigrationPin('');
        return;
      }
      setMigrationBusy(true);
      try {
        await setupPin(migrationPin, migrationDek || undefined);
        setShowMigrationModal(false);
        showToast('success', 'Your vault is now protected by a PIN-wrapped key.', 'Security upgraded');
      } catch {
        setMigrationError('Failed to upgrade. Please try again.');
      } finally {
        setMigrationBusy(false);
      }
    };
    return (
      <div className={cn("w-full overflow-y-auto flex flex-col items-center", settings.isDarkMode ? "bg-graphite" : "bg-cream")} style={{ minHeight: '100dvh', paddingTop: 'max(env(safe-area-inset-top, 24px), 10vh)' }}>
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 'env(safe-area-inset-bottom, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 'env(safe-area-inset-top, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}        <div className="w-full max-w-xs px-8 pb-8 space-y-4">
          <SeekerLogo className="justify-center mb-2" isDarkMode={settings.isDarkMode} />
          <h2 className={cn("text-xl font-serif italic text-center", settings.isDarkMode ? "text-cream" : "text-graphite")}>
            Security Upgrade
          </h2>
          <p className={cn("text-xs text-center leading-relaxed", settings.isDarkMode ? "text-cream/60" : "text-graphite/60")}>
            {migrationStep === 'enter'
              ? "We're upgrading how your encryption key is stored. Please set a PIN now — it will protect your existing vault. Without this PIN, your data cannot be decrypted. Save it somewhere safe."
              : 'Enter the same PIN again to confirm.'}
          </p>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={12}
            autoComplete="off"
            value={migrationPin}
            onChange={e => setMigrationPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleMigrationSubmit()}
            placeholder={migrationStep === 'enter' ? 'New PIN (min. 4 digits)' : 'Confirm PIN'}
            className={cn("w-full border rounded-xl px-4 py-3 text-center focus:outline-none", settings.isDarkMode ? "border-white/20 bg-white/10 text-cream placeholder:text-cream/30" : "border-graphite/20 text-graphite bg-white")}
            autoFocus
          />
          {migrationError && <p className="text-red-500 text-xs text-center">{migrationError}</p>}
          <button
            onClick={handleMigrationSubmit}
            disabled={migrationBusy}
            className="w-full btn-primary py-3"
          >
            {migrationBusy ? 'Upgrading...' : migrationStep === 'enter' ? 'Next' : 'Set PIN & Upgrade'}
          </button>
          {migrationStep === 'confirm' && (
            <button
              onClick={() => { setMigrationStep('enter'); setMigrationPin(''); setMigrationError(''); }}
              className={cn("w-full text-xs underline text-center", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (showPinModal) {
    const isNewPin = !hasWrappedKey();
    const pinTitle = isNewPin
      ? (pinStep === 'enter' ? 'Set Your PIN' : 'Confirm PIN')
      : 'PIN Authentication';
    const pinHint = isNewPin
      ? (pinStep === 'enter'
          ? 'This PIN protects your encryption key. Without it, your notes and files cannot be decrypted — even on this device. Keep it memorable. For backup access on another device, sign with your wallet.'
          : 'Enter the same PIN again to confirm.')
      : 'Enter your PIN to unlock the vault.';
    const pinBtnLabel = isNewPin
      ? (pinStep === 'enter' ? 'Next' : 'Save PIN')
      : 'Unlock';
    const pinCaption = isNewPin ? 'KEY WRAPPING' : 'SECURE ACCESS';

    const pinSteps: Array<'biometric' | 'wallet' | 'pin'> = ['biometric', 'wallet', 'pin'];
    const pinEnabledSteps = new Set<string>();
    if (settings.biometricEnabled) pinEnabledSteps.add('biometric');
    if (settings.walletEnabled) pinEnabledSteps.add('wallet');
    pinEnabledSteps.add('pin');

    return (
      <div
        className={cn("w-full overflow-y-auto flex flex-col items-center", settings.isDarkMode ? "bg-graphite" : "bg-cream")}
        style={{ minHeight: '100dvh', paddingTop: 'max(env(safe-area-inset-top, 24px), 10vh)' }}
      >
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 'env(safe-area-inset-bottom, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 'env(safe-area-inset-top, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}        <div className="w-full max-w-sm px-8 pb-8 space-y-12">
          {/* Logo + step indicator */}
          <div className="space-y-4 text-center">
            <SeekerLogo className="justify-center" large isDarkMode={settings.isDarkMode} />
            <div className="flex items-center justify-center gap-3">
              {pinSteps.map(s => (
                <div key={s} className={cn(
                  "h-1 w-8 rounded-full transition-all duration-500",
                  !pinEnabledSteps.has(s)
                    ? (settings.isDarkMode ? "bg-cream/10" : "bg-graphite/10")
                    : s === 'pin'
                      ? (settings.isDarkMode ? "bg-cream" : "bg-graphite")
                      : (settings.isDarkMode ? "bg-cream/20" : "bg-graphite/20")
                )} />
              ))}
            </div>
          </div>

          {/* Caption + title */}
          <div className="space-y-2 text-center">
            <span className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>Security</span>
            <h2 className={cn("text-lg font-serif italic", settings.isDarkMode ? "text-cream" : "text-graphite")}>{pinTitle}</h2>
          </div>

          {/* Black card */}
          <div className={cn(
            "p-10 bg-graphite rounded-[3rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden",
            settings.isDarkMode && "bg-cream border-graphite/5"
          )}>
            <div className="relative z-10 space-y-8">
              <div className={cn(
                "w-20 h-20 bg-cream/5 rounded-3xl flex items-center justify-center mx-auto backdrop-blur-xl border border-white/5",
                settings.isDarkMode && "bg-graphite/5 border-graphite/5"
              )}>
                <Lock className={cn("w-10 h-10 text-cream/80", settings.isDarkMode && "text-graphite/80")} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className={cn("text-[10px] uppercase tracking-[0.3em] font-black text-center", settings.isDarkMode ? "text-graphite/30" : "text-cream/30")}>Seeker Protocol</p>
                <h3 className={cn("font-serif italic text-xl text-center", settings.isDarkMode ? "text-graphite" : "text-cream")}>{pinCaption}</h3>
                <p className={cn("text-xs text-center pt-1", settings.isDarkMode ? "text-graphite/50" : "text-cream/50")}>{pinHint}</p>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  autoComplete="off"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="PIN (min. 4 digits)"
                  disabled={pinLockRemaining > 0}
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-center focus:outline-none border",
                    settings.isDarkMode
                      ? "bg-graphite/10 border-graphite/20 text-graphite placeholder:text-graphite/30"
                      : "bg-cream/10 border-cream/20 text-cream placeholder:text-cream/30"
                  )}
                  autoFocus
                />
                {pinLockRemaining > 0 ? (
                  <p className="text-red-400 text-xs text-center font-bold">
                    Locked — try in {Math.floor(pinLockRemaining / 60000)}:{Math.floor((pinLockRemaining % 60000) / 1000).toString().padStart(2, '0')}
                  </p>
                ) : pinFails > 0 && hasWrappedKey() ? (
                  <p className={cn(
                    "text-xs text-center font-bold",
                    (MAX_PIN_ATTEMPTS - pinFails) === 1 ? "text-red-500" : "text-amber-500"
                  )}>
                    {(MAX_PIN_ATTEMPTS - pinFails) === 1
                      ? 'Last attempt — next wrong PIN locks vault for 5 min'
                      : `Wrong PIN — ${MAX_PIN_ATTEMPTS - pinFails} attempts left`}
                  </p>
                ) : null}
                <button
                  onClick={handlePinSubmit}
                  disabled={pinLockRemaining > 0}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all",
                    settings.isDarkMode ? "bg-graphite text-cream" : "bg-cream text-graphite",
                    pinLockRemaining > 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Lock className="w-4 h-4" />
                  {pinBtnLabel}
                </button>
              </div>
            </div>
          </div>

          {isNewPin && pinStep === 'confirm' && (
            <button
              onClick={() => { setPinStep('enter'); setFirstPin(''); setPinInput(''); }}
              className={cn("w-full text-xs underline text-center", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}
            >
              Back
            </button>
          )}

          {/* Footer */}
          <div className="space-y-4 pt-4">
            <button
              onClick={() => setShowTermsOnly(true)}
              className={cn(
                "block mx-auto text-[8px] uppercase tracking-[0.2em] underline underline-offset-4 transition-colors",
                settings.isDarkMode ? "text-cream/40 hover:text-cream" : "text-graphite/40 hover:text-graphite"
              )}
            >
              Privacy Policy & EULA
            </button>
            <div className={cn("flex items-center justify-center gap-2", settings.isDarkMode ? "text-cream/20" : "text-graphite/20")}>
              <Shield className="w-3 h-3" />
              <span className="text-[8px] uppercase tracking-[0.2em]">Seeker Security Stack v2.0</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasAcceptedTerms === false) {
    return <TermsScreen onAccept={handleAcceptTerms} isDarkMode={settings.isDarkMode} />;
  }

  if (showTermsOnly) {
    return <TermsScreen onAccept={() => setShowTermsOnly(false)} isRevisiting isDarkMode={settings.isDarkMode} />;
  }

  if (isLocked) {
    // Determine which steps are shown based on enabled methods
    const showBiometricStep = settings.biometricEnabled;
    const showWalletStep = settings.walletEnabled;
    const showPinStep = !showBiometricStep && !showWalletStep;

    // Redirect PIN-only to showPinModal for unified beautiful screen
    if (showPinStep && !showPinModal) {
      setShowPinModal(true);
      return null;
    }

    const lockedSteps: Array<'biometric' | 'wallet' | 'pin'> = ['biometric', 'wallet', 'pin'];
    const lockedEnabledSteps = new Set<string>();
    if (showBiometricStep) lockedEnabledSteps.add('biometric');
    if (showWalletStep) lockedEnabledSteps.add('wallet');
    lockedEnabledSteps.add('pin');

    return (
      <div className={cn(
        "h-screen w-full flex flex-col items-center justify-center bg-cream p-8 overflow-hidden transition-colors duration-500",
        settings.isDarkMode && "bg-graphite"
      )}>
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 'env(safe-area-inset-bottom, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 'env(safe-area-inset-top, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-12 max-w-sm w-full"
        >
          <div className="space-y-4">
            <SeekerLogo className="justify-center" large isDarkMode={settings.isDarkMode} />
            <div className="flex items-center justify-center gap-3">
              {lockedSteps.map(s => (
                <div key={s} className={cn(
                  "h-1 w-8 rounded-full transition-all duration-500",
                  !lockedEnabledSteps.has(s)
                    ? (settings.isDarkMode ? "bg-cream/10" : "bg-graphite/10")
                    : authStep === s
                      ? (settings.isDarkMode ? "bg-cream" : "bg-graphite")
                      : (settings.isDarkMode ? "bg-cream/20" : "bg-graphite/20")
                )} />
              ))}
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              {/* Biometric step */}
              {showBiometricStep && authStep === 'biometric' && (
                <motion.div
                  key="biometric"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <span className={cn("text-[10px] font-bold uppercase tracking-[0.3em] text-graphite/40", settings.isDarkMode && "text-cream/40")}>Security</span>
                    <h2 className={cn("text-lg font-serif italic text-graphite", settings.isDarkMode && "text-cream")}>Biometric Identity</h2>
                  </div>

                  <button
                    onClick={handleBiometricUnlock}
                    disabled={isScanning}
                    className={cn(
                      "relative w-48 h-48 mx-auto bg-graphite rounded-full flex flex-col items-center justify-center gap-4 shadow-2xl group active:scale-95 transition-transform overflow-hidden",
                      settings.isDarkMode && "bg-cream"
                    )}
                  >
                    <AnimatePresence>
                      {isScanning && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={cn("absolute inset-0 bg-cream/10 flex items-center justify-center", settings.isDarkMode && "bg-graphite/10")}
                        >
                          <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className={cn("w-32 h-32 border-2 border-cream/30 rounded-full", settings.isDarkMode && "border-graphite/30")}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Fingerprint className={cn("w-16 h-16 text-cream transition-all", isScanning && "animate-pulse", settings.isDarkMode && "text-graphite")} strokeWidth={1} />
                    <span className={cn("text-cream font-medium tracking-widest uppercase text-[9px]", settings.isDarkMode && "text-graphite")}>
                      {isScanning ? 'Scanning...' : 'Touch to Scan'}
                    </span>

                    <motion.div
                      animate={{ top: ['-10%', '110%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className={cn("absolute left-0 right-0 h-1 bg-cream/40 blur-sm pointer-events-none", settings.isDarkMode && "bg-graphite/40")}
                    />
                  </button>

                </motion.div>
              )}

              {/* Wallet step */}
              {showWalletStep && (!showBiometricStep || authStep === 'wallet') && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <span className={cn("text-[10px] font-bold uppercase tracking-[0.3em] text-graphite/40", settings.isDarkMode && "text-cream/40")}>Security</span>
                    <h2 className={cn("text-lg font-serif italic text-graphite", settings.isDarkMode && "text-cream")}>Cryptographic Authorization</h2>
                  </div>

                  <div className={cn(
                    "p-10 bg-graphite rounded-[3rem] border border-white/5 shadow-2xl space-y-10 relative overflow-hidden",
                    settings.isDarkMode && "bg-cream border-graphite/5"
                  )}>
                    <div className="relative z-10 space-y-8">
                      <div className={cn(
                        "w-20 h-20 bg-cream/5 rounded-3xl flex items-center justify-center mx-auto backdrop-blur-xl border border-white/5 group transition-all duration-500 hover:bg-cream/10",
                        settings.isDarkMode && "bg-graphite/5 border-graphite/5"
                      )}>
                        <Wallet className={cn("w-10 h-10 text-cream/80", settings.isDarkMode && "text-graphite/80")} strokeWidth={1.5} />
                      </div>
                      <div className="space-y-3">
                        <p className={cn("text-[10px] text-cream/30 uppercase tracking-[0.3em] font-black", settings.isDarkMode && "text-graphite/30")}>Seeker Protocol</p>
                        <h3 className={cn("font-serif italic text-cream text-xl", settings.isDarkMode && "text-graphite")}>Wallet Authorization</h3>
                      </div>
                      <div className="pt-4">
                        <button
                          onClick={handleWalletUnlock}
                          className={cn(
                            "w-full py-5 bg-cream text-graphite rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all",
                            settings.isDarkMode && "bg-graphite text-cream"
                          )}
                        >
                          <Wallet className="w-5 h-5" />
                          Connect Wallet
                        </button>
                      </div>
                    </div>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>
          </div>

          <div className="pt-12 space-y-4">
            <button
              onClick={() => setShowTermsOnly(true)}
              className={cn(
                "block mx-auto text-[8px] uppercase tracking-[0.2em] text-graphite/40 hover:text-graphite transition-colors underline underline-offset-4",
                settings.isDarkMode && "text-cream/40 hover:text-cream"
              )}
            >
              Privacy Policy & EULA
            </button>
            <div className={cn("flex items-center justify-center gap-2 text-graphite/20", settings.isDarkMode && "text-cream/20")}>
              <Shield className="w-3 h-3" />
              <span className="text-[8px] uppercase tracking-[0.2em]">Seeker Security Stack v2.0</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-screen w-full flex flex-col bg-cream overflow-hidden transition-colors duration-500",
      settings.isDarkMode && "dark bg-graphite text-cream"
    )} style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}>
      {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 'env(safe-area-inset-bottom, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}
        {!settings.isDarkMode && (<div aria-hidden style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 'env(safe-area-inset-top, 0px)', background: '#1a1a1a', zIndex: 9999, pointerEvents: 'none' }} />)}      {/* Catalog Modal (Premium Upgrade / File Vault) */}
      <AnimatePresence>
        {showCatalog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "bg-cream rounded-[2.5rem] p-8 max-w-lg w-full space-y-8 shadow-3xl border border-graphite/5 relative my-auto max-h-[90vh] overflow-y-auto",
                settings.isDarkMode && "bg-graphite-light border-white/10"
              )}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-graphite text-cream px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                      {settings.isPremium ? 'Active' : 'Premium'}
                    </div>
                    <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                      {settings.isPremium ? 'Unlocked' : 'Hidden Vault'}
                    </div>
                  </div>
                  <h3 className={cn("text-2xl font-serif italic text-graphite", settings.isDarkMode && "text-cream")}>
                    {settings.isPremium ? 'Secret File Vault' : 'Unlock Hidden Vault'}
                  </h3>
                  <p className={cn("text-[10px] uppercase tracking-widest text-graphite/40", settings.isDarkMode && "text-cream/40")}>
                    {settings.isPremium ? 'Encrypted Document Storage' : 'Store documents, photos & files secretly'}
                  </p>
                </div>
                <button
                  onClick={() => setShowCatalog(false)}
                  className={cn("p-3 bg-graphite/5 rounded-full hover:bg-graphite/10 transition-colors shrink-0", settings.isDarkMode && "bg-white/10 hover:bg-white/20")}
                >
                  <X className={cn("w-5 h-5 text-graphite", settings.isDarkMode && "text-cream")} />
                </button>
              </div>

              {!settings.isPremium ? (
                /* ─── Purchase Screen ─── */
                <div className="space-y-6">
                  <div className={cn(
                    "p-6 bg-graphite/5 rounded-[2rem] space-y-4 border border-graphite/5",
                    settings.isDarkMode && "bg-white/5 border-white/5"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-graphite rounded-2xl flex items-center justify-center shadow-lg">
                        <Shield className="w-6 h-6 text-cream" />
                      </div>
                      <div>
                        <h4 className={cn("font-bold text-sm", settings.isDarkMode && "text-cream")}>Hidden File Vault</h4>
                        <p className={cn("text-[10px] text-graphite/40", settings.isDarkMode && "text-cream/40")}>AES-256 Encrypted Storage</p>
                      </div>
                    </div>
                    <p className={cn("text-[11px] leading-relaxed text-graphite/60", settings.isDarkMode && "text-cream/60")}>
                      Store documents, photos, and files in an encrypted vault hidden from the rest of the system. Files are encrypted locally and never leave your device.
                    </p>
                  </div>

                  <div className={cn("p-5 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-2", settings.isDarkMode && "bg-red-500/10")}>
                    <div className="flex items-center gap-2 text-red-500">
                      <Shield className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Disclaimer</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-red-500/80 font-medium italic">
                      Uninstalling the app or clearing data will PERMANENTLY DELETE all stored files. Keep offline backups of critical documents.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[10px] uppercase tracking-widest font-black text-graphite/40", settings.isDarkMode && "text-cream/40")}>Price</span>
                      <span className={cn("text-xl font-serif italic text-graphite", settings.isDarkMode && "text-cream")}>${PREMIUM_PRICE_USD.toFixed(2)}</span>
                    </div>

                    {/* ── Shared payment handler ── */}
                    {(() => {
                      const RPC_PRIMARY = 'https://mainnet.helius-rpc.com/?api-key=041c63c0-81fa-4c69-93d2-1855e7e25936';
                      const RPC_FALLBACK = 'https://solana-mainnet.g.alchemy.com/v2/-TqH3rV2XZKQH6BOPoU5L';

                      const fetchBlockhash = async (statusFn: (s: string) => void): Promise<{ blockhash: string; lastValidBlockHeight: number }> => {
                        const endpoints = [RPC_PRIMARY, RPC_FALLBACK];
                        for (let i = 0; i < endpoints.length; i++) {
                          const label = i === 0 ? 'Helius' : 'Alchemy';
                          statusFn(`Connecting to ${label}...`);
                          try {
                            const conn = new Connection(endpoints[i], { commitment: 'confirmed', confirmTransactionInitialTimeout: 15000 });
                            const result = await Promise.race([
                              conn.getLatestBlockhash('confirmed'),
                              new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout`)), 8000))
                            ]);
                            statusFn(`Connected via ${label}`);
                            return result;
                          } catch (e: any) {
                            console.warn(`RPC ${label} failed:`, e?.message);
                            if (i === endpoints.length - 1) throw new Error('Network unavailable. Check internet connection.');
                          }
                        }
                        throw new Error('All RPC endpoints failed');
                      };

                      const parsePayerKey = (addrBytes: any): PublicKey => {
                        if (addrBytes instanceof Uint8Array) return new PublicKey(addrBytes);
                        if (typeof addrBytes === 'string') {
                          try { return new PublicKey(addrBytes); } catch {
                            const binaryStr = atob(addrBytes);
                            const bytes = new Uint8Array(binaryStr.length);
                            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                            return new PublicKey(bytes);
                          }
                        }
                        return new PublicKey(addrBytes);
                      };

                      const handlePaymentSuccess = (purchaserWalletAddress: string | null) => {
                        if (purchaserWalletAddress) localStorage.setItem('seeker_vault_premium_wallet', purchaserWalletAddress);
                        Sounds.walletConnect();
                        setSettings(prev => ({ ...prev, isPremium: true }));
                        setShowCatalog(false);
                        setPaymentStatus('');
                        showToast('success', 'Premium Activated! Hidden Vault is now unlocked.', 'Premium');
                      };

                      const handlePaymentError = (err: any) => {
                        Sounds.walletFail();
                        setPaymentStatus('');
                        if (err?.message?.includes('User rejected') || err?.message?.includes('rejected') || err?.message?.includes('cancelled')) {
                          showToast('info', 'Payment was cancelled.', 'Cancelled');
                        } else if (err?.message?.includes('timed out')) {
                          logError('payment-timeout', err); showToast('error', 'Request timed out', 'Timeout');
                        } else if (err?.message?.includes('authorization request failed') || err?.message?.includes('Wallet authorization failed')) {
                          showToast('error', 'Wallet rejected the connection. Please try again or use a different wallet.', 'Wallet error');
                        } else {
                          logError('payment', err); showToast('error', 'Payment failed', 'Payment error');
                        }
                      };

                      // Universal sign helper: signAndSendTransactions with payloads (MWA format),
                      // fallback to signTransactions + manual broadcast (for Phantom).
                      const signAndBroadcast = async (wallet: any, serializedBuf: Uint8Array, statusFn: (s: string) => void): Promise<void> => {
                        const base64Tx = Buffer.from(serializedBuf).toString('base64');

                        // Primary: signTransactions + own broadcast — Phantom MWA не держит WS-сессию
                        // достаточно долго для signAndSendTransactions, но подписать успевает.
                        try {
                          const res = await wallet.signTransactions({
                            payloads: [base64Tx],
                          });
                          const signedRaw = res?.signed_payloads?.[0] || res?.signed_transactions?.[0];
                          if (!signedRaw) throw new Error('No signed tx in response');
                          const signedBytes = typeof signedRaw === 'string'
                            ? new Uint8Array(Buffer.from(signedRaw, 'base64'))
                            : new Uint8Array(signedRaw);
                          statusFn('Broadcasting transaction...');
                          const endpoints = [RPC_PRIMARY, RPC_FALLBACK];
                          let lastErr: any;
                          for (const ep of endpoints) {
                            try {
                              const conn = new Connection(ep, { commitment: 'confirmed' });
                              const sig = await conn.sendRawTransaction(signedBytes, { skipPreflight: true, preflightCommitment: 'confirmed' });
                              statusFn('Confirming...');
                              await conn.confirmTransaction(sig, 'confirmed');
                              return;
                            } catch (e: any) { lastErr = e; }
                          }
                          throw new Error(lastErr?.message || 'Broadcast failed');
                        } catch (e1: any) {
                        }

                        // Fallback: signAndSendTransactions (Seeker/Solflare предпочитают)
                        try {
                          const res = await wallet.signAndSendTransactions({
                            payloads: [base64Tx],
                          });
                          const sigRaw = res?.signatures?.[0];
                          if (sigRaw) {
                            let sig: string;
                            if (typeof sigRaw === 'string') {
                              const sigBytes = Buffer.from(sigRaw, 'base64');
                              sig = bs58.encode(sigBytes);
                            } else {
                              sig = bs58.encode(new Uint8Array(sigRaw));
                            }
                            statusFn('Transaction sent! Confirming...');
                            const endpoints = [RPC_PRIMARY, RPC_FALLBACK];
                            for (const ep of endpoints) {
                              try {
                                const conn = new Connection(ep, { commitment: 'confirmed' });
                                await conn.confirmTransaction(sig, 'confirmed');
                                return;
                              } catch (_e) {}
                            }
                            return;
                          }
                          statusFn('Transaction sent!');
                          return;
                        } catch (e2: any) {
                          throw new Error(`Transaction failed: ${e2?.message || 'unknown'}`);
                        }
                      };

                      const paySol = async () => {
                        setIsProcessingPayment(true);
                        setPaymentStatus('Connecting...');
                        try {
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          if (!isMobile) {
                            showToast('error', 'Payment only available on mobile with a wallet installed', 'Unsupported');
                            setIsProcessingPayment(false);
                            setPaymentStatus('');
                            return;
                          }
                          const solPrice = prices.sol > 0 ? prices.sol : 150;
                          const lamports = Math.max(1, Math.round((PREMIUM_PRICE_USD / solPrice) * LAMPORTS_PER_SOL));
                          const recipientKey = new PublicKey(PAYMENT_WALLET_ADDRESS);
                          let purchaserWalletAddress: string | null = null;
                          const txPromise = transact(async (wallet: any) => {
                            const authResult = await authorizeWallet(wallet);
                            if (!authResult?.accounts?.length) throw new Error('No accounts from wallet');
                            const payerKey = parsePayerKey(authResult.accounts[0].address);
                            purchaserWalletAddress = payerKey.toBase58();
                            const { blockhash } = await fetchBlockhash(setPaymentStatus);
                            const message = new TransactionMessage({
                              payerKey,
                              recentBlockhash: blockhash,
                              instructions: [
                                SystemProgram.transfer({ fromPubkey: payerKey, toPubkey: recipientKey, lamports }),
                              ],
                            }).compileToV0Message();
                            const vtx = new VersionedTransaction(message);
                            const serializedBuf = vtx.serialize();
                            await signAndBroadcast(wallet, serializedBuf, setPaymentStatus);
                          });
                          await Promise.race([txPromise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Transaction timed out. Please try again.')), 40000))]);
                          handlePaymentSuccess(purchaserWalletAddress);
                        } catch (err: any) { handlePaymentError(err); }
                        finally { setIsProcessingPayment(false); setPaymentStatus(''); }
                      };

                      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                      const SKR_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
                      const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

                      const getATA = (owner: PublicKey, mint: PublicKey): PublicKey => {
                        const [ata] = PublicKey.findProgramAddressSync(
                          [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                          ATA_PROGRAM_ID
                        );
                        return ata;
                      };

                      const createSPLTransferIx = (source: PublicKey, dest: PublicKey, owner: PublicKey, amount: bigint): TransactionInstruction => {
                        const data = new Uint8Array(9);
                        data[0] = 3; // Transfer instruction index
                        const view = new DataView(data.buffer);
                        view.setBigUint64(1, amount, true); // little-endian
                        return new TransactionInstruction({
                          keys: [
                            { pubkey: source, isSigner: false, isWritable: true },
                            { pubkey: dest, isSigner: false, isWritable: true },
                            { pubkey: owner, isSigner: true, isWritable: false },
                          ],
                          programId: TOKEN_PROGRAM_ID,
                          data,
                        });
                      };

                      const paySkr = async () => {
                        setIsProcessingPayment(true);
                        setPaymentStatus('Connecting...');
                        try {
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          if (!isMobile) {
                            showToast('error', 'Payment only available on mobile with a wallet installed', 'Unsupported');
                            setIsProcessingPayment(false);
                            setPaymentStatus('');
                            return;
                          }
                          const skrPrice = prices.skr > 0 ? prices.skr : 0.017;
                          // 10% discount: $0.05 * 0.9 = $0.045, SKR has 6 decimals
                          const skrAmount = BigInt(Math.max(1, Math.round((PREMIUM_PRICE_USD * 0.9 / skrPrice) * 1e6)));
                          let purchaserWalletAddress: string | null = null;
                          const recipientKey = new PublicKey(PAYMENT_WALLET_ADDRESS);
                          const destATA = getATA(recipientKey, SKR_MINT);
                          const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
                          const txPromise = transact(async (wallet: any) => {
                            const authResult = await authorizeWallet(wallet);
                            if (!authResult?.accounts?.length) throw new Error('No accounts from wallet');
                            const payerKey = parsePayerKey(authResult.accounts[0].address);
                            purchaserWalletAddress = payerKey.toBase58();
                            const { blockhash } = await fetchBlockhash(setPaymentStatus);
                            const sourceATA = getATA(payerKey, SKR_MINT);
                            const createATAIdempotentIx = new TransactionInstruction({
                              programId: ATA_PROGRAM_ID,
                              data: new Uint8Array([1]),
                              keys: [
                                { pubkey: payerKey, isSigner: true, isWritable: true },
                                { pubkey: destATA, isSigner: false, isWritable: true },
                                { pubkey: recipientKey, isSigner: false, isWritable: false },
                                { pubkey: SKR_MINT, isSigner: false, isWritable: false },
                                { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                              ],
                            });
                            const message = new TransactionMessage({
                              payerKey,
                              recentBlockhash: blockhash,
                              instructions: [
                                createATAIdempotentIx,
                                createSPLTransferIx(sourceATA, destATA, payerKey, skrAmount),
                              ],
                            }).compileToV0Message();
                            const vtx = new VersionedTransaction(message);
                            const serializedBuf = vtx.serialize();
                            await signAndBroadcast(wallet, serializedBuf, setPaymentStatus);
                          });
                          await Promise.race([txPromise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Transaction timed out. Please try again.')), 40000))]);
                          handlePaymentSuccess(purchaserWalletAddress);
                        } catch (err: any) { handlePaymentError(err); }
                        finally { setIsProcessingPayment(false); setPaymentStatus(''); }
                      };

                      return (
                        <>
                        <div className="grid grid-cols-2 gap-3 w-full">
                          {/* Pay with SOL */}
                          <button
                            disabled={isProcessingPayment || !prices.sol || prices.sol <= 0}
                            onClick={paySol}
                            className={cn(
                              "group relative px-3 py-4 rounded-[2rem] border transition-all active:scale-95 flex items-center justify-center gap-2 min-w-0 overflow-hidden",
                              (isProcessingPayment || !prices.sol || prices.sol <= 0) ? "opacity-50 cursor-not-allowed" : "",
                              settings.isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-graphite/5 shadow-xl"
                            )}
                          >
                            <div className="w-9 h-9 bg-graphite rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Zap className="w-4 h-4 text-cream" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className={cn("text-[10px] font-black uppercase tracking-tight", settings.isDarkMode && "text-cream")}>
                                {isProcessingPayment ? (paymentStatus || 'Processing...') : 'Pay with SOL'}
                              </p>
                              <p className="text-[11px] font-serif italic text-emerald-500 truncate">
                                {prices.sol > 0 ? `~${(PREMIUM_PRICE_USD / prices.sol).toFixed(4)} SOL` : '...'}
                              </p>
                            </div>
                          </button>

                          {/* Pay with SKR */}
                          <button
                            disabled={isProcessingPayment || !prices.skr || prices.skr <= 0}
                            onClick={paySkr}
                            className={cn(
                              "group relative px-3 py-4 rounded-[2rem] border transition-all active:scale-95 flex items-center justify-center gap-2 min-w-0 overflow-hidden",
                              (isProcessingPayment || !prices.skr || prices.skr <= 0) ? "opacity-50 cursor-not-allowed" : "",
                              settings.isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-graphite/5 shadow-xl"
                            )}
                          >
                            <div className="relative w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                              <Zap className="w-4 h-4 text-white" />
                              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">-10%</span>
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className={cn("text-[10px] font-black uppercase tracking-tight", settings.isDarkMode && "text-cream")}>
                                {isProcessingPayment ? (paymentStatus || 'Processing...') : 'Pay with SKR'}
                              </p>
                              <p className="text-[11px] font-serif italic text-purple-500 truncate">
                                {prices.skr > 0 ? `~${(PREMIUM_PRICE_USD * 0.9 / prices.skr).toFixed(2)} SKR` : '...'}
                              </p>
                            </div>
                          </button>
                        </div>
                        {(!prices.sol || prices.sol <= 0 || !prices.skr || prices.skr <= 0) && (
                          <p className="text-[10px] text-center text-red-500">Fetching prices... please wait.</p>
                        )}
                        </>
                      );
                    })()}
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        let connectedWallet: string | null = null;
                        await transact(async (wallet: any) => {
                          const authResult = await authorizeWallet(wallet);
                          if (!authResult?.accounts?.length) throw new Error('No accounts');
                          const addrBytes = authResult.accounts[0].address;
                          if (addrBytes instanceof Uint8Array) {
                            connectedWallet = new PublicKey(addrBytes).toBase58();
                          } else if (typeof addrBytes === 'string') {
                            try { connectedWallet = new PublicKey(addrBytes).toBase58(); } catch {
                              const bin = atob(addrBytes);
                              const b = new Uint8Array(bin.length);
                              for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
                              connectedWallet = new PublicKey(b).toBase58();
                            }
                          } else {
                            connectedWallet = new PublicKey(addrBytes).toBase58();
                          }
                        });

                        if (!connectedWallet) throw new Error('Could not get wallet address');

                        // Fast path: local cache hit
                        const storedWallet = localStorage.getItem('seeker_vault_premium_wallet');
                        if (storedWallet && connectedWallet === storedWallet) {
                          setSettings(prev => ({ ...prev, isPremium: true }));
                          showToast('success', 'Purchase Restored!', 'Premium');
                          return;
                        }

                        // Blockchain scan
                        showToast('info', 'Scanning blockchain for payment...', 'Checking');
                        const RPC_PRIMARY = 'https://mainnet.helius-rpc.com/?api-key=041c63c0-81fa-4c69-93d2-1855e7e25936';
                        const RPC_FALLBACK = 'https://solana-mainnet.g.alchemy.com/v2/-TqH3rV2XZKQH6BOPoU5L';
                        const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

                        let conn: Connection | null = null;
                        for (const endpoint of [RPC_PRIMARY, RPC_FALLBACK]) {
                          try {
                            const c = new Connection(endpoint, { commitment: 'confirmed' });
                            await Promise.race([c.getSlot(), new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 5000))]);
                            conn = c;
                            break;
                          } catch {}
                        }
                        if (!conn) throw new Error('RPC unavailable');

                        const walletPk = new PublicKey(connectedWallet!);
                        const paymentPk = new PublicKey(PAYMENT_WALLET_ADDRESS);
                        const sigs = await conn.getSignaturesForAddress(walletPk, { limit: 200 });

                        // Derive SKR ATAs via findProgramAddress (no spl-token dep needed)
                        const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                        const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS');
                        const skrMintPk = new PublicKey(SKR_MINT);
                        const deriveAta = async (owner: PublicKey) => {
                          const [ata] = await PublicKey.findProgramAddress(
                            [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), skrMintPk.toBuffer()],
                            ATA_PROGRAM
                          );
                          return ata.toBase58();
                        };
                        const [paymentAtaStr, walletAtaStr] = await Promise.all([deriveAta(paymentPk), deriveAta(walletPk)]);

                        const CHUNK = 10;
                        let found = false;
                        outer: for (let i = 0; i < sigs.length; i += CHUNK) {
                          const chunk = sigs.slice(i, i + CHUNK);
                          const txs = await Promise.all(
                            chunk.map(s => conn!.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null))
                          );
                          for (const tx of txs) {
                            if (!tx || tx.meta?.err) continue;
                            const ixs = tx.transaction.message.instructions as any[];
                            for (const ix of ixs) {
                              // SOL transfer
                              if (ix?.parsed?.type === 'transfer' && ix?.parsed?.info?.destination === PAYMENT_WALLET_ADDRESS) { found = true; break outer; }
                              // SPL token transfer to payment wallet ATA
                              if (
                                (ix?.parsed?.type === 'transfer' || ix?.parsed?.type === 'transferChecked') &&
                                ix?.parsed?.info?.source === walletAtaStr &&
                                (ix?.parsed?.info?.destination === paymentAtaStr || ix?.parsed?.info?.destination === PAYMENT_WALLET_ADDRESS)
                              ) { found = true; break outer; }
                            }
                            // Also check inner instructions
                            for (const inner of (tx.meta?.innerInstructions ?? [])) {
                              for (const ix of (inner.instructions as any[])) {
                                if (ix?.parsed?.type === 'transfer' && ix?.parsed?.info?.destination === PAYMENT_WALLET_ADDRESS) { found = true; break outer; }
                                if (
                                  (ix?.parsed?.type === 'transfer' || ix?.parsed?.type === 'transferChecked') &&
                                  ix?.parsed?.info?.source === walletAtaStr &&
                                  (ix?.parsed?.info?.destination === paymentAtaStr || ix?.parsed?.info?.destination === PAYMENT_WALLET_ADDRESS)
                                ) { found = true; break outer; }
                              }
                            }
                          }
                        }

                        if (found) {
                          localStorage.setItem('seeker_vault_premium_wallet', connectedWallet!);
                          setSettings(prev => ({ ...prev, isPremium: true }));
                          showToast('success', 'Purchase Restored!', 'Premium');
                        } else {
                          showToast('error', 'No payment found from this wallet. If you paid from another wallet, connect that one.', 'Not found');
                        }
                      } catch (err: any) {
                        if (err?.message?.includes('rejected') || err?.message?.includes('User rejected') || err?.message?.includes('cancelled')) {
                          showToast('info', 'Wallet connection cancelled.', 'Cancelled');
                        } else {
                          logError('payment-verify', err); showToast('error', 'Could not verify payment', 'Verify error');
                        }
                      }
                    }}
                    className={cn(
                      "w-full py-3 rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] border transition-all active:scale-95",
                      settings.isDarkMode ? "border-white/10 text-cream/40" : "border-graphite/10 text-graphite/40"
                    )}
                  >
                    Restore Purchase
                  </button>
                </div>
              ) : (
                /* ─── File Vault (Premium unlocked) ─── */
                <div className="space-y-6">
                  {/* Storage meter */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
                      <span className={cn("text-graphite/40", settings.isDarkMode && "text-cream/40")}>Storage</span>
                      <span className={cn("text-graphite/60", settings.isDarkMode && "text-cream/60")}>
                        {formatSize(getTotalFileSize())} / {formatSize(MAX_TOTAL_STORAGE_BYTES)}
                      </span>
                    </div>
                    <div className={cn("h-2 rounded-full overflow-hidden", settings.isDarkMode ? "bg-white/10" : "bg-graphite/10")}>
                      <div
                        className={cn("h-full rounded-full transition-all",
                          getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES > 0.9 ? "bg-red-500" :
                          getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES > 0.7 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${Math.min(100, (getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES) * 100)}%` }}
                      />
                    </div>
                    <p className={cn("text-[10px]", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                      Max 20 MB per file · 500 MB total
                    </p>
                  </div>

                  {/* Upload button */}
                  <label className={cn(
                    "flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all hover:border-emerald-500",
                    settings.isDarkMode ? "border-white/10 text-cream/60" : "border-graphite/10 text-graphite/60"
                  )}>
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-bold">Add File</span>
                    <input
                      type="file"
                      className="hidden"
                      onClick={() => { filePickerActive.current = true; setTimeout(() => { filePickerActive.current = false; }, 40000); }}
                      onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > MAX_FILE_SIZE_BYTES) {
                            showToast('error', `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024*1024)} MB per file.`, 'Size limit');
                            return;
                          }

                          const reader = new FileReader();
                          reader.onload = async () => {
                            try {
                              const base64 = (reader.result as string).split(',')[1];
                              const newFile: VaultFile = {
                                id: crypto.randomUUID(),
                                name: file.name,
                                mimeType: file.type,
                                size: file.size,
                                data: await encrypt(base64),
                                createdAt: new Date().toISOString(),
                              };
                              await saveFileToIDB(newFile);
                              const strippedFile = { ...newFile, data: '' };
                              setVaultFiles(prev => [strippedFile, ...prev]);
                              Sounds.keyClick();
                            } catch (err) {
                              logError('file-upload', err); showToast('error', 'Upload failed', 'Upload error');
                            }
                          };
                          reader.onerror = () => showToast('error', 'Failed to read file', 'Read error');
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        } finally {
                          filePickerActive.current = false;
                        }
                      }}
                    />
                  </label>

                  {/* Open Vault Folder */}
                  {decryptingProgress.total > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
                        <span className={cn("text-graphite/40", settings.isDarkMode && "text-cream/40")}>Decrypting...</span>
                        <span className={cn("text-graphite/60", settings.isDarkMode && "text-cream/60")}>{decryptingProgress.current}/{decryptingProgress.total}</span>
                      </div>
                      <div className={cn("h-2 rounded-full overflow-hidden", settings.isDarkMode ? "bg-white/10" : "bg-graphite/10")}>
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${(decryptingProgress.current / decryptingProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : isVaultFolderOpen ? (
                    <div className="space-y-3">
                      <button
                        onClick={handleCloseVaultFolder}
                        className="w-full py-3 rounded-2xl font-black uppercase tracking-[0.15em] text-[9px] border border-red-500/30 text-red-500 bg-red-500/5 active:scale-95 transition-all"
                      >
                        Close Vault Folder
                      </button>
                      <div className="grid grid-cols-3 gap-3">
                        {vaultFiles.map(file => (
                          <button
                            key={file.id}
                            onClick={() => handleOpenFileWithSystem(file.name)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all active:scale-95",
                              settings.isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-graphite/5"
                            )}
                          >
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center",
                              file.mimeType.startsWith('image/') ? "bg-blue-500/10 text-blue-500" :
                              file.mimeType.startsWith('video/') ? "bg-purple-500/10 text-purple-500" :
                              "bg-graphite/10 text-graphite/40"
                            )}>
                              {file.mimeType.startsWith('image/') ? <ImageIcon className="w-6 h-6" /> :
                               file.mimeType.startsWith('video/') ? <File className="w-6 h-6" /> :
                               <File className="w-6 h-6" />}
                            </div>
                            <p className={cn("text-[9px] font-medium text-center leading-tight line-clamp-2 w-full", settings.isDarkMode ? "text-cream/80" : "text-graphite/80")}>{file.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleOpenVaultFolder}
                      className={cn(
                        "w-full py-3 rounded-2xl font-black uppercase tracking-[0.15em] text-[9px] transition-all active:scale-95",
                        settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite"
                      )}
                    >
                      Open Vault Folder
                    </button>
                  )}

                  {/* File list */}
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {vaultFiles.length === 0 ? (
                      <div className={cn("text-center py-8 text-graphite/30", settings.isDarkMode && "text-cream/30")}>
                        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-xs font-bold uppercase tracking-widest">No files yet</p>
                        <p className="text-[10px] mt-1">Add documents, photos & files</p>
                      </div>
                    ) : (
                      vaultFiles.map(file => (
                        <div key={file.id} className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl border transition-all",
                          settings.isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-graphite/5"
                        )}>
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            file.mimeType.startsWith('image') ? "bg-blue-500/10 text-blue-500" : "bg-graphite/10 text-graphite/40"
                          )}>
                            {file.mimeType.startsWith('image') ? <ImageIcon className="w-5 h-5" /> : <File className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium truncate", settings.isDarkMode && "text-cream")}>{file.name}</p>
                            <p className={cn("text-[9px] text-graphite/40", settings.isDarkMode && "text-cream/40")}>
                              {(file.size / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                const cipher = await loadFileData(file.id);
                                const decryptedBase64 = await decrypt(cipher);
                                if (!decryptedBase64) return;
                                const link = document.createElement('a');
                                link.href = `data:${file.mimeType};base64,${decryptedBase64}`;
                                link.download = file.name;
                                link.click();
                              }}
                              className={cn("p-2 rounded-xl transition-all active:scale-90",
                                settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite"
                              )}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (await askConfirm('Delete file', `Are you sure you want to delete "${file.name}"?\n\nThis action is irreversible.`, 'Delete', true)) {
                                  deleteFileFromIDB(file.id).then(() => {
                                    setVaultFiles(prev => prev.filter(f => f.id !== file.id));
                                  });
                                  Sounds.keyClick();
                                }
                              }}
                              className="p-2 rounded-xl bg-red-500/10 text-red-500 transition-all active:scale-90"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[150] flex items-start justify-center overflow-y-auto"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 48px), 48px)', paddingBottom: '1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "bg-cream rounded-[2.5rem] p-8 max-w-sm w-full space-y-8 shadow-2xl border border-graphite/5 my-auto",
                settings.isDarkMode && "bg-graphite-light border-white/10"
              )}
            >
              {/* Header — динамический */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settingsScreen !== 'main' && (
                    <button
                      onClick={() => setSettingsScreen('main')}
                      className={cn("p-1.5 rounded-xl mr-1", settings.isDarkMode ? "bg-white/10" : "bg-graphite/5")}
                    >
                      <ChevronLeft className={cn("w-5 h-5", settings.isDarkMode ? "text-cream" : "text-graphite")} />
                    </button>
                  )}
                  <div className="space-y-1">
                    <h3 className={cn("text-xl font-serif italic text-graphite", settings.isDarkMode && "text-cream")}>
                      {settingsScreen === 'main' ? 'Settings' : settingsScreen === 'security' ? 'Security' : settingsScreen === 'preferences' ? 'Preferences' : 'Premium'}
                    </h3>
                    {settingsScreen === 'main' && (
                      <p className={cn("text-[10px] uppercase tracking-widest text-graphite/40", settings.isDarkMode && "text-cream/40")}>Vault Configuration</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setShowSettings(false); setSettingsScreen('main'); }}
                  className={cn("p-2 bg-graphite/5 rounded-full", settings.isDarkMode && "bg-white/10")}
                >
                  <X className={cn("w-5 h-5 text-graphite", settings.isDarkMode && "text-cream")} />
                </button>
              </div>

              <div className="min-h-[560px] relative">
              <AnimatePresence mode="wait">
                {settingsScreen === 'main' && (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Security card */}
                    <button
                      onClick={() => setSettingsScreen('security')}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]",
                        settings.isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/10"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                        <Shield className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Security</p>
                        <p className={cn("text-[10px] uppercase tracking-tighter", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>PIN, Biometric, Auto-lock, Backup</p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                    </button>

                    {/* Preferences card */}
                    <button
                      onClick={() => setSettingsScreen('preferences')}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]",
                        settings.isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/10"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                        <Sliders className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Preferences</p>
                        <p className={cn("text-[10px] uppercase tracking-tighter", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>Appearance & Sound</p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                    </button>

                    {/* Premium card */}
                    <button
                      onClick={() => setSettingsScreen('premium')}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]",
                        settings.isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/10"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", settings.isPremium ? (settings.isDarkMode ? "bg-amber-400/20 text-amber-300" : "bg-amber-500/15 text-amber-600") : (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream"))}>
                        <Star className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Premium</p>
                        <p className={cn("text-[10px] uppercase tracking-tighter", settings.isPremium ? "text-amber-500" : (settings.isDarkMode ? "text-cream/40" : "text-graphite/40"))}>
                          {settings.isPremium ? 'Active' : 'Upgrade'}
                        </p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                    </button>

                    {/* Bottom actions */}
                    <div className="pt-2 space-y-3">
                      <button
                        onClick={() => { setShowSettings(false); setSettingsScreen('main'); setShowDestroyConfirm(true); setDestroyPinInput(''); setDestroyPinError(''); }}
                        className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all"
                      >
                        Destroy Vault
                      </button>
                      <button
                        onClick={() => { setShowSettings(false); setSettingsScreen('main'); }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95",
                          settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream"
                        )}
                      >
                        Save & Close
                      </button>
                      <button
                        onClick={() => setShowContactModal(true)}
                        className={cn(
                          "w-full py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2",
                          settings.isDarkMode ? "bg-white/5 text-cream/60 hover:bg-white/10" : "bg-graphite/5 text-graphite/60 hover:bg-graphite/10"
                        )}
                      >
                        <Mail className="w-3 h-3" />
                        Contact Us
                      </button>
                      <div className="flex justify-center">
                        <button
                          onClick={() => setShowTermsOnly(true)}
                          className={cn(
                            "flex items-center gap-1 text-[10px] uppercase tracking-widest transition-opacity hover:opacity-100",
                            settings.isDarkMode ? "text-cream/30 hover:text-cream/60" : "text-graphite/30 hover:text-graphite/60"
                          )}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Privacy Policy
                        </button>
                      </div>
                      <p className={cn("text-center text-[9px] uppercase tracking-widest", settings.isDarkMode ? "text-cream/20" : "text-graphite/20")}>
                        © 2026 Aibat. All rights reserved.
                      </p>
                    </div>
                  </motion.div>
                )}

                {settingsScreen === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* PIN is mandatory — shown as always-on (not a toggle) */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-graphite/5 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold text-graphite", settings.isDarkMode && "text-cream")}>PIN Code</p>
                          <p className={cn("text-[9px] uppercase tracking-tighter text-graphite/40", settings.isDarkMode && "text-cream/40")}>Mandatory</p>
                        </div>
                      </div>
                      <Lock className={cn("w-4 h-4", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")} />
                    </div>

                    {/* Optional toggles */}
                    {[
                      { key: 'biometricEnabled' as const, icon: <Fingerprint className="w-5 h-5" />, label: 'Biometric', desc: 'Fingerprint or Face ID' },
                      { key: 'walletEnabled' as const, icon: <Wallet className="w-5 h-5" />, label: 'Wallet Auth', desc: 'Solana wallet verification' },
                    ].map(({ key, icon, label, desc }) => (
                      <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-graphite/5 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", settings[key] ? (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream") : (settings.isDarkMode ? "bg-white/10 text-cream/40" : "bg-graphite/10 text-graphite/40"))}>
                            {icon}
                          </div>
                          <div>
                            <p className={cn("text-sm font-bold text-graphite", settings.isDarkMode && "text-cream")}>{label}</p>
                            <p className={cn("text-[9px] uppercase tracking-tighter text-graphite/40", settings.isDarkMode && "text-cream/40")}>{desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSettings(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                          className={cn("w-12 h-6 rounded-full relative transition-all duration-300", settings[key] ? (settings.isDarkMode ? "bg-cream" : "bg-graphite") : (settings.isDarkMode ? "bg-white/20" : "bg-graphite/20"))}
                        >
                          <motion.div animate={{ x: settings[key] ? 24 : 4 }} className={cn("absolute top-1 w-4 h-4 rounded-full", settings[key] ? (settings.isDarkMode ? "bg-graphite" : "bg-white") : "bg-white")} />
                        </button>
                      </div>
                    ))}

                    {/* Auto Lock Timeout */}
                    <div className="space-y-2">
                      <label className={cn("text-[10px] uppercase tracking-widest font-bold text-graphite/40", settings.isDarkMode && "text-cream/40")}>
                        Auto-Lock Timeout
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 3, 5, 10].map((time) => (
                          <button
                            key={time}
                            onClick={() => setSettings(prev => ({ ...prev, autoLockTimeout: time }))}
                            className={cn(
                              "py-3 rounded-xl text-xs font-bold transition-all",
                              settings.autoLockTimeout === time
                                ? (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")
                                : (settings.isDarkMode ? "bg-white/5 text-cream/60" : "bg-graphite/5 text-graphite/60")
                            )}
                          >
                            {time}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Change PIN */}
                    {hasWrappedKey() && (
                      changePinStep === null ? (
                        <button
                          onClick={() => { setChangePinStep('current'); setChangePinInput(''); setChangePinNew(''); setChangePinError(''); }}
                          className={cn("w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all", settings.isDarkMode ? "bg-white/10 text-cream hover:bg-white/20" : "bg-graphite/5 text-graphite hover:bg-graphite/10")}
                        >
                          Change PIN
                        </button>
                      ) : changePinStep === 'success' ? (
                        <div className={cn("w-full py-4 rounded-2xl text-center text-xs font-bold", settings.isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600")}>
                          PIN changed ✓
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className={cn("text-[10px] uppercase tracking-widest font-bold", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                            {changePinStep === 'current' ? 'Enter current PIN' : changePinStep === 'new' ? 'New PIN' : 'Confirm PIN'}
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={12}
                            autoComplete="off"
                            value={changePinInput}
                            onChange={e => setChangePinInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => { if (e.key === 'Enter') handleChangePinStep(); }}
                            placeholder="PIN"
                            autoFocus
                            className={cn("w-full border rounded-xl px-4 py-3 text-center focus:outline-none text-sm", settings.isDarkMode ? "border-white/20 bg-white/10 text-cream placeholder:text-cream/30" : "border-graphite/20 bg-white text-graphite")}
                          />
                          {changePinError && <p className="text-red-500 text-[10px] text-center">{changePinError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => { setChangePinStep(null); setChangePinInput(''); setChangePinNew(''); setChangePinError(''); }} className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest", settings.isDarkMode ? "bg-white/5 text-cream/60" : "bg-graphite/5 text-graphite/60")}>Cancel</button>
                            <button onClick={handleChangePinStep} className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>{changePinStep === 'confirm' ? 'Save' : 'Next'}</button>
                          </div>
                        </div>
                      )
                    )}

                    {/* Backup & Restore */}
                    <div className="space-y-2 pt-1">
                      <label className={cn("text-[10px] uppercase tracking-widest font-bold text-graphite/40", settings.isDarkMode && "text-cream/40")}>
                        Backup & Restore
                      </label>
                      <div className={cn("p-4 rounded-2xl space-y-3", settings.isDarkMode ? "bg-white/5" : "bg-graphite/5")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Local Backup</p>
                            <p className={cn("text-[9px] uppercase tracking-tighter", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>Saved as .vault files in Documents folder</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleBackupExport}
                            disabled={backupBusy !== 'idle'}
                            className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all", backupBusy === 'exporting' ? (settings.isDarkMode ? "bg-white/10 text-cream/30" : "bg-graphite/10 text-graphite/30") : (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream"))}
                          >
                            <Download className="w-3 h-3" />
                            {backupBusy === 'exporting' ? 'Exporting...' : 'Export'}
                          </button>
                          <button
                            onClick={handleBackupImportPick}
                            disabled={backupBusy !== 'idle'}
                            className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all", backupBusy === 'importing' ? (settings.isDarkMode ? "bg-white/10 text-cream/30" : "bg-graphite/10 text-graphite/30") : (settings.isDarkMode ? "bg-white/10 text-cream/60 hover:bg-white/20" : "bg-graphite/10 text-graphite/60 hover:bg-graphite/20"))}
                          >
                            <Upload className="w-3 h-3" />
                            {backupBusy === 'importing' ? 'Reading...' : 'Import'}
                          </button>
                        </div>
                      </div>
                      <div className={cn("p-4 rounded-2xl opacity-50", settings.isDarkMode ? "bg-white/5" : "bg-graphite/5")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", settings.isDarkMode ? "bg-white/10 text-cream/40" : "bg-graphite/10 text-graphite/40")}>
                            <Globe className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Cloud NFT Backup</p>
                              <span className={cn("text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded-full", settings.isDarkMode ? "bg-cream/10 text-cream/60" : "bg-graphite/10 text-graphite/60")}>Coming Soon</span>
                            </div>
                            <p className={cn("text-[9px] uppercase tracking-tighter", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>On-chain encrypted backup via cNFT</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {settingsScreen === 'preferences' && (
                  <motion.div
                    key="preferences"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Dark Mode */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-graphite/5 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold text-graphite", settings.isDarkMode && "text-cream")}>Dark Mode</p>
                          <p className={cn("text-[9px] uppercase tracking-tighter text-graphite/40", settings.isDarkMode && "text-cream/40")}>Invert Interface Colors</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, isDarkMode: !prev.isDarkMode }))}
                        className={cn("w-12 h-6 rounded-full relative transition-all duration-300", settings.isDarkMode ? "bg-cream" : "bg-graphite/20")}
                      >
                        <motion.div animate={{ x: settings.isDarkMode ? 24 : 4 }} className={cn("absolute top-1 w-4 h-4 rounded-full", settings.isDarkMode ? "bg-graphite" : "bg-white")} />
                      </button>
                    </div>

                    {/* Sound Effects */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-graphite/5 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", settings.soundEnabled !== false ? (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream") : (settings.isDarkMode ? "bg-white/10 text-cream/40" : "bg-graphite/10 text-graphite/40"))}>
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold text-graphite", settings.isDarkMode && "text-cream")}>Sound Effects</p>
                          <p className={cn("text-[9px] uppercase tracking-tighter text-graphite/40", settings.isDarkMode && "text-cream/40")}>App Sounds & Feedback</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, soundEnabled: prev.soundEnabled === false ? true : false }))}
                        className={cn("w-12 h-6 rounded-full relative transition-all duration-300", settings.soundEnabled !== false ? (settings.isDarkMode ? "bg-cream" : "bg-graphite") : (settings.isDarkMode ? "bg-white/20" : "bg-graphite/20"))}
                      >
                        <motion.div animate={{ x: settings.soundEnabled !== false ? 24 : 4 }} className={cn("absolute top-1 w-4 h-4 rounded-full", settings.soundEnabled !== false ? (settings.isDarkMode ? "bg-graphite" : "bg-white") : "bg-white")} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {settingsScreen === 'premium' && (
                  <motion.div
                    key="premium"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {settings.isPremium ? (
                      <div className={cn("p-6 rounded-2xl flex flex-col items-center gap-3 text-center", settings.isDarkMode ? "bg-amber-400/10" : "bg-amber-500/8")}>
                        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", settings.isDarkMode ? "bg-amber-400/20 text-amber-300" : "bg-amber-500/15 text-amber-600")}>
                          <Star className="w-8 h-8" />
                        </div>
                        <p className={cn("text-lg font-serif italic", settings.isDarkMode ? "text-cream" : "text-graphite")}>Premium Active</p>
                        <p className={cn("text-xs", settings.isDarkMode ? "text-cream/50" : "text-graphite/50")}>Private Vault is unlocked. Enjoy your encrypted hidden space.</p>
                      </div>
                    ) : (
                      <>
                        <div className={cn("p-5 rounded-2xl space-y-2", settings.isDarkMode ? "bg-white/5" : "bg-graphite/5")}>
                          <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Unlock Private Vault</p>
                          <p className={cn("text-xs leading-relaxed", settings.isDarkMode ? "text-cream/50" : "text-graphite/50")}>AES-256 encrypted file storage, invisible to other apps. One-time Solana payment, yours forever.</p>
                        </div>
                        <button
                          onClick={() => { setShowSettings(false); setSettingsScreen('main'); setShowCatalog(true); }}
                          className={cn("w-full btn-primary py-4", settings.isDarkMode && "bg-cream text-graphite")}
                        >
                          Upgrade to Premium
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={cn(
                "bg-cream rounded-[2.5rem] p-8 max-w-xs w-full shadow-2xl border border-graphite/5 space-y-6",
                settings.isDarkMode && "bg-graphite-light border-white/10"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className={cn("text-lg font-serif italic", settings.isDarkMode ? "text-cream" : "text-graphite")}>Contact Us</h3>
                <button
                  onClick={() => setShowContactModal(false)}
                  className={cn("p-2 rounded-full", settings.isDarkMode ? "bg-white/10" : "bg-graphite/5")}
                >
                  <X className={cn("w-4 h-4", settings.isDarkMode ? "text-cream" : "text-graphite")} />
                </button>
              </div>

              <p className={cn("text-sm leading-relaxed", settings.isDarkMode ? "text-cream/60" : "text-graphite/60")}>
                Found a bug or want to collaborate? Reach out to us!
              </p>

              <div className="flex justify-center gap-6">
                <button
                  onClick={() => { const a = document.createElement('a'); a.href = 'mailto:solana.seeker.vault@gmail.com'; a.click(); }}
                  className={cn(
                    "flex flex-col items-center gap-2 group transition-opacity hover:opacity-100",
                    settings.isDarkMode ? "text-cream/60 hover:text-cream" : "text-graphite/60 hover:text-graphite"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                    settings.isDarkMode ? "bg-white/10 group-hover:bg-white/20" : "bg-graphite/10 group-hover:bg-graphite/20"
                  )}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] uppercase tracking-widest">Email</span>
                </button>

                <button
                  onClick={async () => { try { await Browser.open({ url: 'https://t.me/Danik190' }); } catch { window.open('https://t.me/Danik190', '_blank'); } }}
                  className={cn(
                    "flex flex-col items-center gap-2 group transition-opacity hover:opacity-100",
                    settings.isDarkMode ? "text-cream/60 hover:text-cream" : "text-graphite/60 hover:text-graphite"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                    settings.isDarkMode ? "bg-white/10 group-hover:bg-white/20" : "bg-graphite/10 group-hover:bg-graphite/20"
                  )}>
                    <Send className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] uppercase tracking-widest">Telegram</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Biometric Reveal Modal */}
      <AnimatePresence>
        {biometricRevealTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-cream rounded-[2.5rem] p-8 max-w-sm w-full space-y-8 shadow-2xl border border-graphite/5 text-center"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-graphite/40">Security Verification</span>
                <h3 className="text-xl font-serif italic text-graphite">Confirm Identity</h3>
                <p className="text-xs text-graphite/60">Biometric authentication required to reveal sensitive information.</p>
              </div>

              <button
                onClick={handleBiometricRevealConfirm}
                disabled={isRevealScanning}
                className="relative w-32 h-32 mx-auto bg-graphite rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl group active:scale-95 transition-transform overflow-hidden"
              >
                <Fingerprint className={cn("w-10 h-10 text-cream transition-all", isRevealScanning && "animate-pulse")} strokeWidth={1} />
                <span className="text-cream font-medium tracking-widest uppercase text-[7px]">
                  {isRevealScanning ? 'Verifying...' : 'Tap to Verify'}
                </span>
                {isRevealScanning && (
                  <motion.div
                    animate={{ top: ['-10%', '110%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-cream/40 blur-sm pointer-events-none"
                  />
                )}
              </button>

              <button
                onClick={() => setBiometricRevealTarget(null)}
                className="w-full py-3 text-[10px] uppercase tracking-widest text-graphite/40 font-bold hover:text-graphite transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destroy Vault — PIN + Biometric confirmation */}
      <AnimatePresence>
        {showDestroyConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/90 backdrop-blur-sm z-[120] flex items-start justify-center p-6 pt-[10vh]"
            style={{ minHeight: '100dvh' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl",
                settings.isDarkMode ? "bg-graphite border border-cream/10" : "bg-cream border border-graphite/5"
              )}
            >
              <div className="text-center space-y-1 mb-4">
                <div className="text-3xl">⚠️</div>
                <h2 className="font-black uppercase tracking-widest text-sm text-red-500">DESTROY VAULT</h2>
                <p className={cn("text-[10px] uppercase tracking-tight", settings.isDarkMode ? "text-cream/50" : "text-graphite/50")}>
                  ENTER PIN TO CONFIRM DELETION
                </p>
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                autoComplete="off"
                value={destroyPinInput}
                onChange={e => { setDestroyPinInput(e.target.value.replace(/\D/g, '')); setDestroyPinError(''); }}
                placeholder="PIN"
                className={cn(
                  "w-full px-5 py-3 rounded-2xl text-sm font-mono tracking-widest text-center outline-none border mb-2",
                  settings.isDarkMode
                    ? "bg-cream/5 text-cream border-cream/10 placeholder:text-cream/20"
                    : "bg-graphite/5 text-graphite border-graphite/10 placeholder:text-graphite/20"
                )}
                autoFocus
              />
              {destroyPinError && (
                <p className="text-red-500 text-[10px] uppercase tracking-widest text-center font-bold mb-2">{destroyPinError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDestroyConfirm(false); setDestroyPinInput(''); setDestroyPinError(''); }}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95",
                    settings.isDarkMode ? "bg-cream/10 text-cream" : "bg-graphite/10 text-graphite"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (await isPinLocked()) {
                      const ms = await getPinLockRemainingMs();
                      const mm = Math.floor(ms / 60000);
                      const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
                      setDestroyPinError(`Too many attempts. Try in ${mm}:${ss}`);
                      return;
                    }
                    const ok = await unlockWithPin(destroyPinInput);
                    if (!ok) {
                      if (await isPinLocked()) {
                        const ms = await getPinLockRemainingMs();
                        const mm = Math.floor(ms / 60000);
                        const ss = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
                        setDestroyPinError(`Too many attempts. Locked for ${mm}:${ss}`);
                      } else {
                        setDestroyPinError('Wrong PIN');
                      }
                      setDestroyPinInput('');
                      return;
                    }
                    try {
                      const isAvailable = await NativeBiometric.isAvailable();
                      if (!isAvailable.isAvailable) {
                        setDestroyPinError('Biometric not available on this device');
                        return;
                      }
                      await NativeBiometric.verifyIdentity({
                        reason: 'Confirm Vault Destruction',
                        title: 'Seeker Security Stack',
                        subtitle: 'Biometric Confirmation',
                      });
                      Sounds.biometricSuccess();
                      if (await askConfirm('Last Chance', 'All vault data will be PERMANENTLY DELETED. This cannot be undone.', 'Destroy', true)) {
                        indexedDB.deleteDatabase('seeker_vault_idb');
                        try { await Filesystem.rmdir({ path: 'vault_temp', directory: Directory.Data, recursive: true }); } catch(e) {}
                        try { await Filesystem.rmdir({ path: '', directory: Directory.Data, recursive: true }); } catch(e) {}
                        localStorage.clear();
                        sessionStorage.clear();
                        try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch(e) {}
                        window.location.reload();
                      } else {
                        setShowDestroyConfirm(false);
                        setDestroyPinInput('');
                        setDestroyPinError('');
                      }
                    } catch {
                      Sounds.biometricFail();
                      setDestroyPinError('Biometric verification failed');
                      setDestroyPinInput('');
                    }
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-cream rounded-[2.5rem] p-8 max-w-sm w-full space-y-6 shadow-2xl border border-graphite/5"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-serif italic text-graphite">Delete Item?</h3>
                <p className="text-sm text-graphite/60">This action is permanent and cannot be undone. Are you absolutely sure?</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmDelete}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Confirm Deletion
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-4 bg-graphite/5 text-graphite rounded-2xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup file picker (hidden) */}
      <input
        ref={backupFileInputRef}
        type="file"
        accept=".vault,application/octet-stream"
        className="hidden"
        onChange={handleBackupFileSelected}
      />

      {/* Export Success Modal */}
      <AnimatePresence>
        {lastExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[200] flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "bg-cream rounded-[2rem] p-6 max-w-sm w-full space-y-5 shadow-2xl border border-graphite/5",
                settings.isDarkMode && "bg-graphite-light border-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}>
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className={cn("text-sm font-bold", settings.isDarkMode ? "text-cream" : "text-graphite")}>Backup Saved</p>
                  <p className={cn("text-[9px] uppercase tracking-tighter break-all", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>{lastExport.filename}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setLastExport(null);
                    if (pendingShareEnvelope) {
                      filePickerActive.current = true;
                      try { await exportAndShare(pendingShareEnvelope); } catch (e) { logError('backup-share', e); }
                      finally { filePickerActive.current = false; }
                      setPendingShareEnvelope(null);
                    }
                  }}
                  className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/10 text-graphite")}
                >
                  Share...
                </button>
                <button
                  onClick={() => setLastExport(null)}
                  className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")}
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup Restore Preview Modal */}
      <BackupRestoreModal
        isOpen={showBackupModal}
        envelope={previewBackupData}
        isDarkMode={settings.isDarkMode}
        onClose={handleBackupModalClose}
        onRestore={handleRestoreSelected}
      />

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[300] flex items-center justify-center p-6"
            onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={cn(
                "rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl border",
                settings.isDarkMode ? "bg-graphite-light border-white/10" : "bg-cream border-graphite/5"
              )}
            >
              <h3 className={cn("text-xl font-serif italic", settings.isDarkMode ? "text-cream" : "text-graphite")}>
                {confirmState.title}
              </h3>
              <p className={cn("text-sm leading-relaxed", settings.isDarkMode ? "text-cream/70" : "text-graphite/70")}>
                {confirmState.body}
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95",
                    settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/10 text-graphite"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95",
                    confirmState.danger ? "bg-red-500 text-white" : (settings.isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")
                  )}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Toast */}
      <AppToast
        isOpen={!!toast}
        type={toast?.type || 'info'}
        title={toast?.title}
        message={toast?.message || ''}
        isDarkMode={settings.isDarkMode}
        onClose={hideToast}
        autoCloseMs={toast?.type === 'success' || toast?.type === 'info' ? 3000 : undefined}
      />

      {/* Mobile Top Bar */}
      <header className={cn(
        "h-16 px-6 flex items-center justify-between border-b border-graphite/5 bg-cream/80 backdrop-blur-md sticky top-0 z-20 transition-colors",
        settings.isDarkMode && "bg-graphite/80 border-white/5"
      )}>
        <div className="flex items-center gap-3">
          <SeekerLogo className="scale-75 origin-left" isDarkMode={settings.isDarkMode} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
          {activeTab !== 'private' && (
            <button
              onClick={() => {
                let initialContent = '';
                let initialCategory = 'Other';
                if (activeTab === 'keys') {
                  initialContent = JSON.stringify({ type: 'Seed Phrase', ecosystem: 'Solana', words: Array.from({ length: 12 }, () => ''), privateKey: '' });
                  initialCategory = 'Solana';
                } else if (activeTab === 'passwords') {
                  initialContent = JSON.stringify({ login: '', password: '', category: 'Exchange' });
                  initialCategory = 'Exchange';
                }
                setSelectedNote({
                  id: '',
                  title: '',
                  content: initialContent,
                  type: activeTab,
                  category: initialCategory,
                  importance: 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
                setIsEditing(true);
              }}
              className={cn(
                "w-10 h-10 bg-graphite text-cream rounded-full flex items-center justify-center shadow-lg",
                settings.isDarkMode && "bg-cream text-graphite"
              )}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => {
              clearEncryptionKey();
              try { localStorage.removeItem('sv_locked'); localStorage.removeItem('sv_private_unlocked'); } catch {}
              setIsLocked(true);
              setAuthStep('biometric');
            }}
            className={cn(
              "w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all",
              !settings.isDarkMode && "shadow-red-500/20"
            )}
            title="Instant Lock"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-6 py-4">
        <div className={cn(
          "relative flex items-center bg-white/50 border border-graphite/5 rounded-2xl px-4 py-3 transition-all",
          settings.isDarkMode && "bg-white/5 border-white/10"
        )}>
          <Search className={cn("w-4 h-4 text-graphite/30 mr-3", settings.isDarkMode && "text-cream/30")} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "bg-transparent border-none outline-none text-sm w-full placeholder:text-graphite/30",
              settings.isDarkMode && "text-cream placeholder:text-cream/30"
            )}
          />
        </div>
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'private' ? (
            <motion.div
              key="private-space"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="min-h-full flex flex-col"
            >
              {!settings.isPremium ? (
                /* ── Need to purchase ── */
                <div className="flex-1 flex flex-col gap-5 py-6">

                  {/* Hero */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className={cn(
                      "relative overflow-hidden rounded-3xl px-6 py-8 flex flex-col items-center gap-3 text-center",
                      settings.isDarkMode
                        ? "bg-gradient-to-br from-white/10 to-white/5"
                        : "bg-gradient-to-br from-graphite/8 to-graphite/3"
                    )}
                  >
                    <div className={cn(
                      "absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10",
                      settings.isDarkMode ? "bg-cream" : "bg-graphite"
                    )} />
                    <div className={cn(
                      "w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl",
                      settings.isDarkMode ? "bg-white/15" : "bg-graphite/8"
                    )}>
                      <Shield className={cn("w-9 h-9", settings.isDarkMode ? "text-cream" : "text-graphite")} />
                    </div>
                    <h2 className={cn("text-2xl font-serif italic tracking-tight", settings.isDarkMode ? "text-cream" : "text-graphite")}>
                      Private Vault
                    </h2>
                    <p className={cn("text-xs leading-relaxed max-w-xs", settings.isDarkMode ? "text-cream/50" : "text-graphite/50")}>
                      Your personal encrypted space — completely invisible to other apps, protected by biometrics.
                    </p>
                  </motion.div>

                  {/* Feature list */}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className={cn(
                      "rounded-2xl divide-y",
                      settings.isDarkMode ? "bg-white/5 divide-white/8" : "bg-graphite/4 divide-graphite/8"
                    )}
                  >
                    {([
                      { icon: Lock,        label: 'AES-256 Encryption',      desc: 'Files encrypted locally on-device' },
                      { icon: Eye,         label: 'Invisible to other apps',  desc: 'Hidden from file managers & gallery' },
                      { icon: Upload,      label: 'Photos, videos, docs',     desc: 'Up to 20 MB per file · 500 MB total' },
                      { icon: Fingerprint, label: 'Biometric access only',    desc: 'Opens with your fingerprint or face' },
                      { icon: Zap,         label: 'One-time Solana payment',  desc: 'Yours forever, no subscription' },
                    ] as { icon: React.ElementType; label: string; desc: string }[]).map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex items-center gap-4 px-4 py-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          settings.isDarkMode ? "bg-white/10" : "bg-graphite/8"
                        )}>
                          <Icon className={cn("w-4 h-4", settings.isDarkMode ? "text-cream/70" : "text-graphite/60")} />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-xs font-medium", settings.isDarkMode ? "text-cream" : "text-graphite")}>{label}</p>
                          <p className={cn("text-[10px] leading-snug", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>

                  {/* How it works */}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="space-y-2"
                  >
                    <p className={cn("text-[10px] uppercase tracking-widest font-medium px-1", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>
                      How it works
                    </p>
                    <div className={cn(
                      "rounded-2xl px-4 py-4 space-y-4",
                      settings.isDarkMode ? "bg-white/5" : "bg-graphite/4"
                    )}>
                      {[
                        { step: '1', text: 'Pay via your Seeker Seed Vault wallet' },
                        { step: '2', text: 'Upload files — they encrypt automatically' },
                        { step: '3', text: 'Access only through biometric authentication' },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex items-start gap-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                            settings.isDarkMode ? "bg-cream/15 text-cream" : "bg-graphite/10 text-graphite"
                          )}>{step}</div>
                          <p className={cn("text-xs leading-relaxed pt-0.5", settings.isDarkMode ? "text-cream/60" : "text-graphite/60")}>{text}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Price card + CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="space-y-3"
                  >
                    <div className={cn(
                      "rounded-2xl px-5 py-4 flex items-center justify-between",
                      settings.isDarkMode ? "bg-white/5" : "bg-graphite/4"
                    )}>
                      <div>
                        <p className={cn("text-[10px] uppercase tracking-widest", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>One-time price</p>
                        <p className="text-emerald-500 font-bold text-lg leading-tight">
                          {prices.sol > 0 ? `${(PREMIUM_PRICE_USD / prices.sol).toFixed(6)} SOL` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[10px] uppercase tracking-widest", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>≈ USD</p>
                        <p className={cn("font-semibold text-sm", settings.isDarkMode ? "text-cream/70" : "text-graphite/70")}>
                          ${PREMIUM_PRICE_USD.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCatalog(true)}
                      className={cn("w-full btn-primary py-4", settings.isDarkMode && "bg-cream text-graphite")}
                    >
                      Unlock Private Vault
                    </button>
                  </motion.div>

                </div>
              ) : !isPrivateSpaceUnlocked ? (
                /* ── Biometric lock ── */
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-12">
                  <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl",
                    settings.isDarkMode ? "bg-white/10" : "bg-graphite/5")}>
                    <Fingerprint className={cn("w-12 h-12", settings.isDarkMode ? "text-cream/60" : "text-graphite/40")} />
                  </div>
                  <div className="text-center">
                    <h2 className={cn("text-xl font-serif italic", settings.isDarkMode ? "text-cream" : "text-graphite")}>
                      Private Vault
                    </h2>
                    <p className={cn("text-xs mt-1", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                      Verify to access your hidden files
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const isAvailable = await NativeBiometric.isAvailable();
                        if (isAvailable.isAvailable) {
                          await NativeBiometric.verifyIdentity({
                            reason: 'Access Private Vault',
                            title: 'Private Vault',
                            subtitle: 'Confirm your identity',
                          });
                        }
                        Sounds.biometricSuccess();
                        setPreviewCache({});
                        setIsPrivateSpaceUnlocked(true);
                        const files = await loadVaultFilesMetadata();
                        setVaultFiles(files);
                      } catch {
                        Sounds.biometricFail();
                      }
                    }}
                    className={cn("w-full btn-primary py-4", settings.isDarkMode && "bg-cream text-graphite")}
                  >
                    Authenticate
                  </button>
                </div>
              ) : (
                /* ── Full file vault UI ── */
                <div className="space-y-5 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className={cn("text-xs font-black uppercase tracking-[0.2em]",
                      settings.isDarkMode ? "text-cream/60" : "text-graphite/40")}>
                      Private Vault
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px]", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>
                        {vaultFiles.length} file{vaultFiles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Storage meter */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
                      <span className={cn("text-graphite/40", settings.isDarkMode && "text-cream/40")}>Storage</span>
                      <span className={cn("text-graphite/60", settings.isDarkMode && "text-cream/60")}>
                        {formatSize(getTotalFileSize())} / {formatSize(MAX_TOTAL_STORAGE_BYTES)}
                      </span>
                    </div>
                    <div className={cn("h-2 rounded-full overflow-hidden", settings.isDarkMode ? "bg-white/10" : "bg-graphite/10")}>
                      <div
                        className={cn("h-full rounded-full transition-all",
                          getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES > 0.9 ? "bg-red-500" :
                          getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES > 0.7 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${Math.min(100, (getTotalFileSize() / MAX_TOTAL_STORAGE_BYTES) * 100)}%` }}
                      />
                    </div>
                    <p className={cn("text-[10px]", settings.isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                      Max 20 MB per file · 500 MB total
                    </p>
                  </div>

                  {/* Upload button */}
                  <label className={cn(
                    "flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all hover:border-emerald-500",
                    settings.isDarkMode ? "border-white/10 text-cream/60" : "border-graphite/10 text-graphite/60"
                  )}>
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-bold">Add File / Photo / Document</span>
                    <input type="file" multiple className="hidden"
                                            onClick={() => { filePickerActive.current = true; setTimeout(() => { filePickerActive.current = false; }, 40000); }}
                                            onChange={async (e) => {
                        filePickerActive.current = false;
                        const files: File[] = Array.from(e.target.files || []);
                        if (!files.length) return;
                        const currentTotal = getTotalFileSize();
                        for (const file of files) {
                          if (file.size > MAX_FILE_SIZE_BYTES) {
                            showToast('error', `File "${file.name}" exceeds 20 MB limit`, 'Size limit');
                            e.target.value = '';
                            return;
                          }
                          if (currentTotal + file.size > MAX_TOTAL_STORAGE_BYTES) {
                            showToast('error', 'Storage full. Maximum 500 MB', 'Storage full');
                            e.target.value = '';
                            return;
                          }
                        }
                        // CRITICAL: free preview cache memory before reading large files.
                        // Image previews held as base64 in memory cause OOM crashes when
                        // adding videos (FileReader doubles file size in heap).
                        setPreviewCache({});
                        await new Promise(r => setTimeout(r, 50));
                        for (const file of files) {
                          await new Promise<void>(resolve => {
                            const reader = new FileReader();
                            reader.onload = async () => {
                              try {
                                let base64 = (reader.result as string).split(',')[1];
                                const encrypted = await encrypt(base64);
                                base64 = ''; // free memory before IDB write
                                const newFile: VaultFile = {
                                  id: crypto.randomUUID(), name: file.name,
                                  mimeType: file.type, size: file.size,
                                  data: encrypted, createdAt: new Date().toISOString(),
                                };
                                await saveFileToIDB(newFile);
                                const strippedFile = { ...newFile, data: '' };
                                setVaultFiles(prev => [strippedFile, ...prev]);
                              } catch (err) {
                                logError('file-upload-bulk', err); showToast('error', 'Upload failed', 'Upload error');
                              } finally {
                                resolve();
                              }
                            };
                            reader.onerror = () => { showToast('error', 'Failed to read file', 'Read error'); resolve(); };
                            reader.readAsDataURL(file);
                          });
                          // Yield to GC between files
                          await new Promise(r => setTimeout(r, 100));
                        }
                        Sounds.keyClick();
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {/* Restore All Files — sibling style with Add File */}
                  {vaultFiles.length > 0 && (
                    <button
                      onClick={handleRestoreAllFiles}
                      className={cn(
                        "w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-2xl cursor-pointer transition-all hover:border-emerald-500 active:scale-[0.98]",
                        settings.isDarkMode ? "border-white/10 text-cream/60" : "border-graphite/10 text-graphite/60"
                      )}
                    >
                      <Download className="w-5 h-5" />
                      <span className="text-sm font-bold">Restore All {vaultFiles.length} File{vaultFiles.length !== 1 ? 's' : ''} to Device</span>
                    </button>
                  )}

                  {/* Category filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'photos', label: 'Photos' },
                      { key: 'videos', label: 'Videos' },
                      { key: 'documents', label: 'Docs' },
                      { key: 'archives', label: 'Archives' },
                    ].map(cat => (
                      <button key={cat.key}
                        onClick={() => setFileCategory(cat.key)}
                        className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                          fileCategory === cat.key ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/60'
                        }`}
                      >{cat.label}</button>
                    ))}
                  </div>

                  {/* File grid */}
                  {filteredVaultFiles.length === 0 ? (
                    <div className={cn("text-center py-12", settings.isDarkMode ? "text-cream/20" : "text-graphite/20")}>
                      <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest">Vault is empty</p>
                      <p className="text-[10px] mt-1">Your files stay hidden from the system</p>
                    </div>
                  ) : (
                    <>
                      {/* Image/video grid — 2 columns */}
                      {filteredVaultFiles.some(f => f.mimeType.startsWith('image') || f.mimeType.startsWith('video')) && (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {filteredVaultFiles.filter(f => f.mimeType.startsWith('image') || f.mimeType.startsWith('video')).map(file => (
                            <div key={file.id} className={cn(
                              "rounded-2xl border overflow-hidden flex flex-col transition-all",
                              settings.isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-graphite/5 shadow-sm"
                            )}>
                              {/* Thumbnail */}
                              <div className="aspect-square w-full relative bg-black/10 overflow-hidden">
                                {file.mimeType.startsWith('image') ? (
                                  previewCache[file.id]
                                    ? <img src={previewCache[file.id]} alt={file.name} className="w-full h-full object-cover" />
                                    : <ImagePreviewLoader file={file} onLoad={(url: string) => addPreview(file.id, url)} decrypt={decrypt} loadFileData={loadFileData} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-graphite/10">
                                    <div className="relative">
                                      <File className="w-10 h-10 text-graphite/30" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center">
                                          <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[7px] border-t-transparent border-b-transparent border-l-graphite ml-0.5" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Format badge for videos */}
                                {file.mimeType.startsWith('video') && (
                                  <div className="absolute top-1.5 left-1.5">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-black/60 text-white">
                                      {getFileExtension(file.name) || 'VIDEO'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="p-2 flex-1 min-w-0">
                                <p className={cn("text-[10px] font-medium truncate", settings.isDarkMode && "text-cream")}>{file.name}</p>
                                <p className={cn("text-[9px]", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>{formatSize(file.size)}</p>
                              </div>
                              {/* Actions */}
                              <div className="flex gap-1 p-2 pt-0">
                                <button
                                  onClick={(e) => openFileFromVault(file, e)}
                                  className={cn("flex-1 p-1.5 rounded-xl transition-all active:scale-90 flex items-center justify-center",
                                    settings.isDarkMode ? "bg-cyan-500/10 text-cyan-400" : "bg-cyan-500/10 text-cyan-600")}
                                ><Eye className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={(e) => downloadFileFromVault(file, e)}
                                  className={cn("flex-1 p-1.5 rounded-xl transition-all active:scale-90 flex items-center justify-center",
                                    settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite")}
                                ><Download className="w-3.5 h-3.5" /></button>
                                <button
                                  onClick={async () => {
                                    if (await askConfirm('Delete file', `Are you sure you want to delete "${file.name}"?\n\nThis action is irreversible.`, 'Delete', true)) {
                                      deleteFileFromIDB(file.id).then(() => setVaultFiles(prev => prev.filter(f => f.id !== file.id)));
                                      setPreviewCache(prev => { const n = {...prev}; delete n[file.id]; return n; });
                                      Sounds.keyClick();
                                    }
                                  }}
                                  className="flex-1 p-1.5 rounded-xl bg-red-500/10 text-red-500 transition-all active:scale-90 flex items-center justify-center"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Non-image/video files — flat list */}
                      <div className="space-y-3">
                        {filteredVaultFiles.filter(f => !f.mimeType.startsWith('image') && !f.mimeType.startsWith('video')).map(file => (
                          <div key={file.id} className={cn(
                            "flex items-center gap-3 p-4 rounded-2xl border transition-all",
                            settings.isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-graphite/5 shadow-sm"
                          )}>
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: getExtColor(getFileExtension(file.name)) + '1a' }}>
                              <span className="text-[10px] font-bold uppercase" style={{ color: getExtColor(getFileExtension(file.name)) }}>
                                {getFileExtension(file.name) || 'FILE'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", settings.isDarkMode && "text-cream")}>{file.name}</p>
                              <p className={cn("text-[9px]", settings.isDarkMode ? "text-cream/30" : "text-graphite/30")}>
                                {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={(e) => downloadFileFromVault(file, e)}
                                className={cn("p-2 rounded-xl transition-all active:scale-90",
                                  settings.isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite")}
                              ><Download className="w-4 h-4" /></button>
                              <button
                                onClick={async () => {
                                  if (await askConfirm('Delete file', `Are you sure you want to delete "${file.name}"?\n\nThis action is irreversible.`, 'Delete', true)) {
                                    deleteFileFromIDB(file.id).then(() => setVaultFiles(prev => prev.filter(f => f.id !== file.id)));
                                    Sounds.keyClick();
                                  }
                                }}
                                className="p-2 rounded-xl bg-red-500/10 text-red-500 transition-all active:scale-90"
                              ><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => { try { localStorage.removeItem('sv_private_unlocked'); } catch {} setIsPrivateSpaceUnlocked(false); }}
                    className={cn("w-full py-3 rounded-2xl text-[10px] uppercase tracking-widest font-bold border transition-all",
                      settings.isDarkMode ? "border-white/10 text-cream/30" : "border-graphite/10 text-graphite/30")}
                  >Lock Vault</button>
                </div>
              )}
            </motion.div>

          ) : selectedNote ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={cn(
                "fixed inset-0 bg-cream z-30 flex flex-col",
                settings.isDarkMode && "bg-graphite"
              )}
            >
              <header className={cn(
                "px-6 flex items-center justify-between border-b border-graphite/5",
                settings.isDarkMode && "border-white/5"
              )} style={{ paddingTop: 'env(safe-area-inset-top, 24px)', height: 'calc(4rem + env(safe-area-inset-top, 24px))' }}>
                <button onClick={() => setSelectedNote(null)} className="p-2 -ml-2">
                  <ArrowLeft className={cn("w-5 h-5", settings.isDarkMode && "text-cream")} />
                </button>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button
                      onClick={() => {
                        if (selectedNote && (selectedNote.type === 'keys' || selectedNote.type === 'passwords' || selectedNote.type === 'secrets')) {
                          setBiometricRevealTarget('edit');
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      className="p-2"
                    >
                      <Pencil className={cn("w-4 h-4 text-graphite/40", settings.isDarkMode && "text-cream/40")} />
                    </button>
                  )}
                  <button onClick={() => deleteNote(selectedNote.id)} className="p-2">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </header>

              {/* Two-section flex layout: scrollable content + fixed save button */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6" style={isEditing ? { paddingBottom: 'calc(5rem + var(--kb-height, 0px))' } : undefined}>
                  {isEditing ? (
                    <EditorView
                      note={selectedNote}
                      onSave={(updatedNote) => saveNote(updatedNote)}
                      onCancel={() => setSelectedNote(null)}
                      isDarkMode={settings.isDarkMode}
                    />
                  ) : (
                    <DetailView
                      note={selectedNote}
                      showContent={showContent[selectedNote.id]}
                      onToggleShow={() => toggleShowContent(selectedNote.id)}
                      isDarkMode={settings.isDarkMode}
                    />
                  )}
                </div>
                {isEditing && (
                  <div className={cn(
                    'fixed left-0 right-0 px-6 py-4 border-t z-50',
                    settings.isDarkMode ? 'bg-graphite border-white/10' : 'bg-cream border-graphite/5'
                  )} style={{ bottom: 'var(--kb-height, 0px)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
                    <button
                      onClick={() => {
                        document.dispatchEvent(new Event('vault-editor-save'));
                      }}
                      className={cn(
                        'w-full btn-primary py-4 shadow-lg',
                        settings.isDarkMode && 'bg-cream text-graphite hover:bg-white'
                      )}
                    >
                      Save to Vault
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-[0.2em] text-graphite/40 font-bold flex items-center gap-2">
                  {activeTab !== 'notes' && <Lock className="w-3 h-3" />}
                  {activeTab === 'keys' ? 'Protected Keys' : activeTab === 'passwords' ? 'Secure Logins' : activeTab === 'secrets' ? 'Encrypted Secrets' : 'General Notes'}
                </h2>
                <span className="text-[10px] text-graphite/30">{filteredNotes.length} Items</span>
              </div>
              {filteredNotes.map(note => (
                <motion.button
                  layoutId={note.id}
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={cn(
                    "w-full text-left p-5 rounded-3xl border transition-all active:scale-[0.98] shadow-sm",
                    activeTab === 'notes'
                      ? (settings.isDarkMode ? "bg-graphite-light border-white/5" : "bg-white border-graphite/5")
                      : (settings.isDarkMode ? "bg-white/5 border-white/10 backdrop-blur-sm" : "bg-graphite/[0.02] border-graphite/10 backdrop-blur-sm")
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-[9px] uppercase tracking-widest px-2 py-1 rounded-md font-bold",
                      activeTab === 'notes'
                        ? (settings.isDarkMode ? "text-cream/40 bg-graphite" : "text-graphite/40 bg-cream")
                        : (settings.isDarkMode ? "text-cream/60 bg-white/5" : "text-graphite/60 bg-graphite/5")
                    )}>
                      {note.category}
                    </span>
                    {activeTab !== 'notes' ? (
                      <ShieldCheck className={cn("w-4 h-4 text-graphite/20", settings.isDarkMode && "text-cream/20")} />
                    ) : (
                      note.importance > 0 && <Zap className={cn("w-3 h-3 text-graphite", settings.isDarkMode && "text-cream")} />
                    )}
                  </div>
                  <h3 className={cn("font-medium text-sm truncate transition-all duration-300", settings.isDarkMode && "text-cream")}>
                    {note.title || 'Untitled'}
                  </h3>
                  <div className={cn("flex items-center gap-2 mt-2 text-graphite/30", settings.isDarkMode && "text-cream/30")}>
                    <Lock className={cn("w-3 h-3", settings.isDarkMode && "text-cream/30")} />
                    <span className="text-[9px] uppercase tracking-widest font-bold">
                      {activeTab === 'notes' ? 'Encrypted' : 'Protected Sector'}
                    </span>
                  </div>
                </motion.button>
              ))}
              {filteredNotes.length === 0 && (
                <div className={cn(
                  "py-20 flex flex-col items-center justify-center text-graphite/20 text-center space-y-4",
                  settings.isDarkMode && "text-cream/20"
                )}>
                  <Ghost className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] uppercase tracking-widest">Nothing found in {activeTab}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-2xl border-t border-graphite/5 px-4 flex flex-col z-40 transition-colors",
        settings.isDarkMode && "bg-graphite/95 border-white/5",
        selectedNote && activeTab !== 'private' && "hidden"
      )} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex-1 flex justify-center">
            <NavButton
              active={activeTab === 'notes'}
              onClick={() => {
                setActiveTab('notes');
                setSelectedNote(null);
                setIsEditing(false);
              }}
              icon={<FileText className="w-5 h-5" />}
              label="Notes"
              isDarkMode={settings.isDarkMode}
            />
          </div>

          <div className={cn("h-10 w-[1px] bg-graphite/10 mx-1", settings.isDarkMode && "bg-white/10")} />

          <div className={cn(
            "flex-[3.5] relative flex items-center justify-around bg-graphite/[0.03] rounded-[2rem] py-2 px-1 border border-graphite/5",
            settings.isDarkMode && "bg-white/5 border-white/10"
          )}>
            <div className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2 bg-cream px-3 flex items-center gap-1.5 whitespace-nowrap transition-colors", settings.isDarkMode && "bg-graphite")}>
              <Lock className={cn("w-2.5 h-2.5 text-graphite/40", settings.isDarkMode && "text-cream/40")} />
              <span className={cn("text-[7px] uppercase tracking-[0.2em] font-black text-graphite/40", settings.isDarkMode && "text-cream/40")}>Secure Sectors</span>
            </div>
            <NavButton
              active={activeTab === 'keys'}
              onClick={() => {
                setActiveTab('keys');
                setSelectedNote(null);
                setIsEditing(false);
              }}
              icon={<Key className="w-5 h-5" />}
              label="Keys"
              isDarkMode={settings.isDarkMode}
            />
            <NavButton
              active={activeTab === 'passwords'}
              onClick={() => {
                setActiveTab('passwords');
                setSelectedNote(null);
                setIsEditing(false);
              }}
              icon={<User className="w-5 h-5" />}
              label="Logins"
              isDarkMode={settings.isDarkMode}
            />
            <NavButton
              active={activeTab === 'secrets'}
              onClick={() => {
                setActiveTab('secrets');
                setSelectedNote(null);
                setIsEditing(false);
              }}
              icon={<Ghost className="w-5 h-5" />}
              label="Secrets"
              isDarkMode={settings.isDarkMode}
            />
            <div className={cn("h-8 w-[1px] bg-graphite/10 mx-1", settings.isDarkMode && "bg-white/10")} />
            {settings.isPremium ? (
              <NavButton
                active={activeTab === 'private'}
                onClick={() => {
                  setActiveTab('private');
                  setSelectedNote(null);
                  setIsEditing(false);
                }}
                icon={<Shield className="w-5 h-5" />}
                label="Private"
                isDarkMode={settings.isDarkMode}
              />
            ) : (
              <NavButton
                active={false}
                onClick={() => {
                  setShowCatalog(true);
                }}
                icon={<Library className="w-5 h-5" />}
                label="Catalog"
                isDarkMode={settings.isDarkMode}
              />
            )}
          </div>
        </div>
        <div className="h-6 flex items-center justify-center">
          <button
            onClick={() => setShowTermsOnly(true)}
            className={cn("text-[7px] uppercase tracking-[0.2em] text-graphite/30 hover:text-graphite transition-colors", settings.isDarkMode && "text-cream/30 hover:text-cream")}
          >
            Privacy Policy & EULA
          </button>
        </div>
      </nav>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header with back button */}
          <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm shrink-0" style={{paddingTop: 'env(safe-area-inset-top, 24px)'}}>
            <button
              onClick={() => setViewingFile(null)}
              className="p-3 rounded-xl bg-white/10 text-white active:scale-90 transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <p className="text-white text-sm font-medium truncate flex-1">{viewingFile.name}</p>
            <button
              onClick={(e) => downloadFileFromVault(viewingFile, e)}
              className="p-2 rounded-xl bg-white/10 text-white active:scale-90 transition-all"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          {/* File content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {viewingFile.mimeType.startsWith('image') ? (
              previewCache[viewingFile.id]
                ? <img
                    src={previewCache[viewingFile.id]}
                    alt={viewingFile.name}
                    className="max-w-full max-h-full object-contain"
                  />
                : (() => {
                    getPreview(viewingFile);
                    return <div className="text-white/40 text-sm">Loading...</div>;
                  })()
            ) : viewingFile.mimeType.startsWith('video') ? (
              previewCache[viewingFile.id]
                ? <video src={previewCache[viewingFile.id]} controls autoPlay className="max-w-full max-h-full" />
                : (() => {
                    getPreview(viewingFile);
                    return <div className="text-white/40 text-sm">Loading...</div>;
                  })()
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function EditorView({ note, onSave, onCancel, isDarkMode }: { note: Note, onSave: (note: Note) => void, onCancel: () => void, isDarkMode?: boolean }) {
  const [title, setTitle] = useState(note.title);
  const [type, setType] = useState(note.type);
  const [category, setCategory] = useState(note.category);

  // Structured content state
  const [initialData, setInitialData] = useState<any>(null);
  const [keyData, setKeyData] = useState<any>(note.type === 'keys' ? { type: 'Seed Phrase', ecosystem: 'Solana', words: Array.from({ length: 12 }, () => ''), privateKey: '', apiKey: '', serviceName: '' } : null);
  const [loginData, setLoginData] = useState<any>(note.type === 'passwords' ? { login: '', password: '', category: 'Exchange' } : null);
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([{ id: crypto.randomUUID(), text: '', checked: false }]);
  const checklistRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    if (!note.content) { setInitialData(null); return; }
    decrypt(note.content).then(plain => {
      let parsed: any;
      try { parsed = JSON.parse(plain || note.content); } catch { parsed = plain || note.content; }
      setInitialData(parsed);
      if (note.type === 'keys') setKeyData(parsed || { type: 'Seed Phrase', ecosystem: 'Solana', words: Array.from({ length: 12 }, () => ''), privateKey: '', apiKey: '', serviceName: '' });
      if (note.type === 'passwords') setLoginData(parsed || { login: '', password: '', category: 'Exchange' });
      if ((note.type === 'notes' || note.type === 'secrets') && typeof parsed === 'object' && parsed?.type === 'checklist') {
        setIsChecklist(true);
        setChecklistItems((parsed as ChecklistData).items || [{ id: crypto.randomUUID(), text: '', checked: false }]);
      } else if (note.type === 'notes' || note.type === 'secrets') {
        setTextContent(typeof parsed === 'string' ? parsed : (plain || ''));
      }
    });
  }, [note.content]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customWordCount, setCustomWordCount] = useState(() => {
    if (note.type === 'keys' && keyData && keyData.words) {
      return ![12, 24].includes(keyData.words.length) ? keyData.words.length.toString() : '12';
    }
    return '12';
  });

  const handleSave = () => {
    let finalContent = '';
    if (type === 'keys') finalContent = JSON.stringify(keyData);
    else if (type === 'passwords') finalContent = JSON.stringify(loginData);
    else if (isChecklist) finalContent = JSON.stringify({ type: 'checklist', items: checklistItems } as ChecklistData);
    else finalContent = textContent;

    onSave({ ...note, title, type, category, content: finalContent });
  };

  // Listen for save event dispatched from the sticky Save button outside this component
  useEffect(() => {
    const handler = () => handleSave();
    document.addEventListener('vault-editor-save', handler);
    return () => document.removeEventListener('vault-editor-save', handler);
  }, [title, type, category, keyData, loginData, textContent, isChecklist, checklistItems]);

  const handlePaste = (e: React.ClipboardEvent) => {
    // Clear clipboard after a short delay to ensure the paste operation completes
    // This prevents sensitive data from lingering in the system buffer.
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => { });
    }, 150);
  };

  const handleSeedPhrasePaste = (e: React.ClipboardEvent, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    const words = pastedText.trim().split(/\s+/);
    if (words.length > 1) {
      e.preventDefault();
      const newWords = [...keyData.words];
      for (let i = 0; i < words.length && (index + i) < newWords.length; i++) {
        newWords[index + i] = words[i];
      }
      setKeyData({ ...keyData, words: newWords });
    }
    handlePaste(e);
  };

  return (
    <div className="space-y-8 pb-4">
      <input
        className={cn(
          "text-4xl font-serif italic bg-transparent border-none outline-none w-full placeholder:text-graphite/10",
          isDarkMode && "text-cream placeholder:text-cream/10"
        )}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {type === 'keys' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Type</label>
              <select
                className={cn(
                  "w-full bg-white border border-graphite/10 rounded-xl px-4 py-3 text-sm outline-none appearance-none",
                  isDarkMode && "bg-graphite-light border-white/10 text-cream"
                )}
                value={keyData.type}
                onChange={(e) => setKeyData({ ...keyData, type: e.target.value })}
              >
                {KEY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>
                {keyData.type === 'API Key' ? 'Service Name' : 'Ecosystem'}
              </label>
              {keyData.type === 'API Key' ? (
                <input
                  className={cn(
                    "w-full bg-white border border-graphite/10 rounded-xl px-4 py-3 text-sm outline-none",
                    isDarkMode && "bg-graphite-light border-white/10 text-cream"
                  )}
                  placeholder="e.g. OpenAI, Binance..."
                  value={keyData.serviceName || ''}
                  onChange={(e) => { setKeyData({ ...keyData, serviceName: e.target.value }); setCategory(e.target.value || 'API'); }}
                />
              ) : (
                <select
                  className={cn(
                    "w-full bg-white border border-graphite/10 rounded-xl px-4 py-3 text-sm outline-none appearance-none",
                    isDarkMode && "bg-graphite-light border-white/10 text-cream"
                  )}
                  value={keyData.ecosystem}
                  onChange={(e) => { setKeyData({ ...keyData, ecosystem: e.target.value }); setCategory(e.target.value); }}
                >
                  {KEY_ECOSYSTEMS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              )}
            </div>
          </div>

          {keyData.type === 'Seed Phrase' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Seed Phrase Words</label>
                <div className="flex gap-2">
                  {[12, 24].map(n => (
                    <button key={n}
                      onClick={() => {
                        const w = [...keyData.words];
                        setKeyData({ ...keyData, words: n > w.length ? [...w, ...Array(n - w.length).fill('')] : w.slice(0, n) });
                      }}
                      className={cn("px-2 py-1 rounded-lg text-[9px] font-bold border transition-all",
                        keyData.words.length === n
                          ? (isDarkMode ? "bg-cream text-graphite border-cream" : "bg-graphite text-cream border-graphite")
                          : (isDarkMode ? "bg-white/5 text-cream border-white/10" : "bg-white text-graphite border-graphite/10")
                      )}
                    >{n}</button>
                  ))}
                  <button type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomInput(!showCustomInput); }}
                    className={cn("px-2 py-1 rounded-lg text-[9px] font-bold border transition-all",
                      (![12, 24].includes(keyData.words.length) || showCustomInput)
                        ? (isDarkMode ? "bg-cream text-graphite border-cream" : "bg-graphite text-cream border-graphite")
                        : (isDarkMode ? "bg-white/5 text-cream border-white/10" : "bg-white text-graphite border-graphite/10")
                    )}
                  >Custom</button>
                </div>
              </div>
              {showCustomInput && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className={cn("flex items-center gap-3 bg-graphite/5 p-3 rounded-xl", isDarkMode && "bg-white/5")}
                >
                  <span className={cn("text-[10px] uppercase tracking-widest text-graphite/40 font-bold", isDarkMode && "text-cream/40")}>Word Count:</span>
                  <input type="number" min="1" max="100" value={customWordCount}
                    onChange={(e) => {
                      setCustomWordCount(e.target.value);
                      const n = parseInt(e.target.value || '0');
                      if (n > 0 && n <= 100) {
                        const w = [...keyData.words];
                        setKeyData({ ...keyData, words: n > w.length ? [...w, ...Array(n - w.length).fill('')] : w.slice(0, n) });
                      }
                    }}
                    className={cn("w-16 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs outline-none", isDarkMode && "bg-graphite border-white/10 text-cream")}
                  />
                  <button onClick={() => setShowCustomInput(false)}
                    className={cn("text-[9px] uppercase font-bold text-graphite/40 hover:text-graphite", isDarkMode && "text-cream/40 hover:text-cream")}
                  >Done</button>
                </motion.div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {keyData.words.map((word: string, i: number) => (
                  <div key={i} className={cn("flex items-center bg-white border border-graphite/5 rounded-xl px-3 py-2", isDarkMode && "bg-graphite-light border-white/5")}>
                    <span className={cn("text-[10px] text-graphite/30 w-6 font-mono", isDarkMode && "text-cream/30")}>{i + 1}.</span>
                    <input
                      className={cn("bg-transparent border-none outline-none text-sm w-full font-mono", isDarkMode && "text-cream")}
                      value={word} placeholder="word"
                      onPaste={(e) => handleSeedPhrasePaste(e, i)}
                      onChange={(e) => { const w = [...keyData.words]; w[i] = e.target.value; setKeyData({ ...keyData, words: w }); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : keyData.type === 'API Key' ? (
            <div className="space-y-2">
              <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>API Key Value</label>
              <textarea
                className={cn("w-full h-28 bg-white border border-graphite/5 rounded-2xl px-4 py-3 text-sm font-mono outline-none resize-none",
                  isDarkMode && "bg-graphite-light border-white/5 text-cream")}
                placeholder="Paste your API key here..."
                value={keyData.apiKey || ''}
                onPaste={handlePaste}
                onChange={(e) => setKeyData({ ...keyData, apiKey: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Private Key</label>
              <textarea
                className={cn("w-full h-32 bg-white border border-graphite/5 rounded-2xl px-4 py-3 text-sm font-mono outline-none resize-none",
                  isDarkMode && "bg-graphite-light border-white/5 text-cream")}
                placeholder="Enter your private key here..."
                value={keyData.privateKey}
                onPaste={handlePaste}
                onChange={(e) => setKeyData({ ...keyData, privateKey: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {type === 'passwords' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Category</label>
            <select
              className={cn("w-full bg-white border border-graphite/10 rounded-xl px-4 py-3 text-sm outline-none appearance-none", isDarkMode && "bg-graphite-light border-white/10 text-cream")}
              value={loginData.category}
              onChange={(e) => { setLoginData({ ...loginData, category: e.target.value }); setCategory(e.target.value); }}
            >
              {LOGIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Login / Username</label>
            <input
              className={cn("w-full bg-white border border-graphite/5 rounded-xl px-4 py-3 text-sm outline-none", isDarkMode && "bg-graphite-light border-white/5 text-cream")}
              placeholder="Username or Email" value={loginData.login} onPaste={handlePaste}
              onChange={(e) => setLoginData({ ...loginData, login: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>Password</label>
            <input type="text"
              className={cn("w-full bg-white border border-graphite/5 rounded-xl px-4 py-3 text-sm outline-none", isDarkMode && "bg-graphite-light border-white/5 text-cream")}
              placeholder="Password" value={loginData.password} onPaste={handlePaste}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            />
          </div>
        </div>
      )}

      {(type === 'notes' || type === 'secrets') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { if (isChecklist) setTextContent(checklistItems.map(i => (i.checked ? '✓ ' : '• ') + i.text).join('\n')); setIsChecklist(false); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all',
                !isChecklist ? (isDarkMode ? 'bg-cream text-graphite' : 'bg-graphite text-cream') : (isDarkMode ? 'bg-white/10 text-cream/50' : 'bg-graphite/5 text-graphite/40')
              )}
            ><FileText className="w-3 h-3" /> Text</button>
            <button type="button"
              onClick={() => {
                if (!isChecklist) {
                  const lines = textContent.split('\n').filter(l => l.trim());
                  setChecklistItems(lines.length > 0
                    ? lines.map(l => ({ id: crypto.randomUUID(), text: l.replace(/^[•✓\-*]\s*/, '').trim(), checked: l.startsWith('✓') }))
                    : [{ id: crypto.randomUUID(), text: '', checked: false }]);
                }
                setIsChecklist(true);
              }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all',
                isChecklist ? (isDarkMode ? 'bg-cream text-graphite' : 'bg-graphite text-cream') : (isDarkMode ? 'bg-white/10 text-cream/50' : 'bg-graphite/5 text-graphite/40')
              )}
            ><ListChecks className="w-3 h-3" /> Checklist</button>
          </div>

          {isChecklist ? (
            <div className="space-y-1">
              {checklistItems.map((item, idx) => (
                <div key={item.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-2xl group transition-all',
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/3')}>
                  <button type="button"
                    onClick={() => { const u = [...checklistItems]; u[idx] = { ...item, checked: !item.checked }; setChecklistItems(u); }}
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {item.checked
                      ? <CheckSquare className={cn('w-5 h-5', isDarkMode ? 'text-cream/60' : 'text-graphite/60')} />
                      : <Square className={cn('w-5 h-5', isDarkMode ? 'text-cream/30' : 'text-graphite/30')} />}
                  </button>
                  <input
                    ref={el => { if (el) checklistRefs.current[idx] = el; }}
                    className={cn('flex-1 bg-transparent border-none outline-none text-sm leading-relaxed transition-all',
                      item.checked && 'line-through opacity-40',
                      isDarkMode ? 'text-cream placeholder:text-cream/20' : 'text-graphite/80 placeholder:text-graphite/20')}
                    placeholder={idx === 0 ? 'List item...' : 'Add item...'}
                    value={item.text}
                    onChange={e => { const u = [...checklistItems]; u[idx] = { ...item, text: e.target.value }; setChecklistItems(u); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const u = [...checklistItems]; u.splice(idx + 1, 0, { id: crypto.randomUUID(), text: '', checked: false });
                        setChecklistItems(u); setTimeout(() => checklistRefs.current[idx + 1]?.focus(), 30);
                      } else if (e.key === 'Backspace' && item.text === '' && checklistItems.length > 1) {
                        e.preventDefault();
                        setChecklistItems(checklistItems.filter((_, i) => i !== idx));
                        setTimeout(() => checklistRefs.current[Math.max(0, idx - 1)]?.focus(), 30);
                      }
                    }}
                  />
                  <button type="button"
                    onClick={() => { if (checklistItems.length > 1) setChecklistItems(checklistItems.filter((_, i) => i !== idx)); }}
                    className={cn('shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg',
                      isDarkMode ? 'text-cream/30 hover:text-red-400' : 'text-graphite/30 hover:text-red-400')}
                  ><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button type="button"
                onClick={() => setChecklistItems([...checklistItems, { id: crypto.randomUUID(), text: '', checked: false }])}
                className={cn('flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-all rounded-xl mt-1',
                  isDarkMode ? 'text-cream/30 hover:text-cream/60' : 'text-graphite/30 hover:text-graphite/60')}
              ><Plus className="w-3.5 h-3.5" /> Add item</button>
            </div>
          ) : (
            <textarea
              className={cn('w-full min-h-[200px] bg-transparent border-none outline-none resize-none font-sans leading-relaxed text-graphite/80', isDarkMode && 'text-cream/80')}
              placeholder={type === 'secrets' ? 'Enter your secret information...' : 'Start writing...'}
              value={textContent} onPaste={type === 'secrets' ? handlePaste : undefined}
              onChange={e => setTextContent(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DetailView({ note, showContent, onToggleShow, isDarkMode }: { note: Note, showContent: boolean, onToggleShow: () => void, isDarkMode?: boolean }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!note.content) { setData(null); return; }
    decrypt(note.content).then(plain => {
      try { setData(JSON.parse(plain || note.content)); } catch { setData(plain || note.content); }
    });
  }, [note.content]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!data) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className={cn("text-[10px] uppercase tracking-widest text-graphite/40", isDarkMode && "text-cream/40")}>{note.category}</span>
        <h2 className={cn("text-3xl font-serif italic", isDarkMode && "text-cream")}>{note.title || 'Untitled'}</h2>
      </div>

      <div className={cn(
        "p-6 bg-white rounded-3xl border border-graphite/5 relative",
        isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-graphite/5"
      )}>
        {note.type === 'keys' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className={cn("w-4 h-4 text-graphite/40", isDarkMode && "text-cream/40")} />
                <span className={cn("text-[10px] uppercase tracking-widest font-bold", isDarkMode && "text-cream/60")}>{data.ecosystem} {data.type}</span>
              </div>
              <button onClick={onToggleShow} className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-cream" : "text-graphite")}>
                {showContent ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showContent ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div className={cn(
              "transition-all duration-500",
              !showContent && "blur-xl select-none opacity-20"
            )}>
              {data.type === 'Seed Phrase' ? (
                <div className="grid grid-cols-2 gap-3">
                  {data.words.map((word: string, i: number) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2 bg-cream/50 rounded-xl px-3 py-2",
                      isDarkMode ? "bg-white/5 border border-white/5" : "bg-cream/50"
                    )}>
                      <span className={cn("text-[9px] text-graphite/30 font-mono", isDarkMode && "text-cream/30")}>{i + 1}.</span>
                      <span className={cn("text-sm font-mono font-medium break-all", isDarkMode && "text-cream")}>{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "font-mono text-sm break-all leading-loose p-4 bg-cream/50 rounded-2xl",
                  isDarkMode ? "bg-white/5 border border-white/5 text-cream" : "bg-cream/50 text-graphite"
                )}>
                  {data.type === 'API Key' ? data.apiKey : data.privateKey}
                </div>
              )}
            </div>

            {showContent && (
              <button
                onClick={() => {
                  const text = data.type === 'Seed Phrase' ? data.words.join(' ') : (data.type === 'API Key' ? data.apiKey : data.privateKey);
                  handleCopy(text, 'key');
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-all active:scale-95",
                  copiedId === 'key'
                    ? "bg-emerald-50 text-emerald-600"
                    : (isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite")
                )}
              >
                {copiedId === 'key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedId === 'key' ? 'Copied!' : `Copy ${data.type}`}
              </button>
            )}
          </div>
        ) : note.type === 'passwords' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className={cn("w-4 h-4 text-graphite/40", isDarkMode && "text-cream/40")} />
                <span className={cn("text-[10px] uppercase tracking-widest font-bold", isDarkMode && "text-cream/60")}>{data.category} Login</span>
              </div>
              <button onClick={onToggleShow} className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-cream" : "text-graphite")}>
                {showContent ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showContent ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className={cn("text-[9px] uppercase tracking-widest text-graphite/30", isDarkMode && "text-cream/30")}>Username / Login</label>
                <div className={cn(
                  "flex items-center justify-between bg-cream/50 rounded-xl px-4 py-3 gap-4",
                  isDarkMode ? "bg-white/5 border border-white/5" : "bg-cream/50"
                )}>
                  <span className={cn("text-sm font-medium break-all", isDarkMode && "text-cream")}>{data.login}</span>
                  <button
                    onClick={() => handleCopy(data.login, 'login')}
                    className={cn(
                      "p-1 rounded-md transition-all active:scale-90 shrink-0",
                      copiedId === 'login' ? "text-emerald-500" : (isDarkMode ? "text-cream/30" : "text-graphite/30")
                    )}
                  >
                    {copiedId === 'login' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className={cn("text-[9px] uppercase tracking-widest text-graphite/30", isDarkMode && "text-cream/30")}>Password</label>
                <div className={cn(
                  "flex items-center justify-between bg-cream/50 rounded-xl px-4 py-3 gap-4",
                  isDarkMode ? "bg-white/5 border border-white/5" : "bg-cream/50"
                )}>
                  <span className={cn(
                    "text-sm font-mono font-medium break-all",
                    !showContent && "blur-md select-none",
                    isDarkMode && "text-cream"
                  )}>
                    {showContent ? data.password : '••••••••••••'}
                  </span>
                  {showContent && (
                    <button
                      onClick={() => handleCopy(data.password, 'password')}
                      className={cn(
                        "p-1 rounded-md transition-all active:scale-90 shrink-0",
                        copiedId === 'password' ? "text-emerald-500" : (isDarkMode ? "text-cream/30" : "text-graphite/30")
                      )}
                    >
                      {copiedId === 'password' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : note.type === 'secrets' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className={cn("w-4 h-4 text-graphite/40", isDarkMode && "text-cream/40")} />
                <span className={cn("text-[10px] uppercase tracking-widest font-bold", isDarkMode && "text-cream/60")}>Encrypted Secret</span>
              </div>
              <button onClick={onToggleShow} className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-2", isDarkMode ? "text-cream" : "text-graphite")}>
                {showContent ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showContent ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div className={cn(
              "transition-all duration-500",
              !showContent && "blur-xl select-none opacity-20"
            )}>
              {typeof data === 'object' && data !== null && data.type === 'checklist' ? (
                <div className="space-y-1">
                  {(data as ChecklistData).items.map((item: ChecklistItem) => (
                    <div key={item.id} className="flex items-center gap-3 py-2">
                      {item.checked
                        ? <CheckSquare className={cn('w-5 h-5 shrink-0', isDarkMode ? 'text-cream/50' : 'text-graphite/50')} />
                        : <Square className={cn('w-5 h-5 shrink-0', isDarkMode ? 'text-cream/20' : 'text-graphite/20')} />}
                      <span className={cn(
                        'text-sm leading-relaxed',
                        item.checked && 'line-through opacity-40',
                        isDarkMode ? 'text-cream/80' : 'text-graphite/80'
                      )}>{item.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "font-sans leading-relaxed text-graphite/80 whitespace-pre-wrap break-all",
                  isDarkMode && "text-cream/80"
                )}>
                  {typeof data === 'string' ? data : JSON.stringify(data)}
                </div>
              )}
            </div>

            {showContent && (
              <button
                onClick={() => {
                  const text = typeof data === 'string' ? data : JSON.stringify(data);
                  handleCopy(text, 'secret');
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-all active:scale-95",
                  copiedId === 'secret'
                    ? "bg-emerald-50 text-emerald-600"
                    : (isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/5 text-graphite")
                )}
              >
                {copiedId === 'secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedId === 'secret' ? 'Copied!' : 'Copy Secret'}
              </button>
            )}
          </div>
        ) : (
          // notes / secrets (may be checklist)
          (() => {
            const isChecklistData = typeof data === 'object' && data !== null && data.type === 'checklist';
            if (isChecklistData) {
              return (
                <div className="space-y-1">
                  {(data as ChecklistData).items.map((item: ChecklistItem) => (
                    <div key={item.id} className="flex items-center gap-3 py-2">
                      {item.checked
                        ? <CheckSquare className={cn('w-5 h-5 shrink-0', isDarkMode ? 'text-cream/50' : 'text-graphite/50')} />
                        : <Square className={cn('w-5 h-5 shrink-0', isDarkMode ? 'text-cream/20' : 'text-graphite/20')} />}
                      <span className={cn(
                        'text-sm leading-relaxed',
                        item.checked && 'line-through opacity-40',
                        isDarkMode ? 'text-cream/80' : 'text-graphite/80'
                      )}>{item.text}</span>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div className={cn(
                "font-sans leading-relaxed text-graphite/80 whitespace-pre-wrap break-all",
                isDarkMode && "text-cream/80"
              )}>
                {typeof data === 'string' ? data : JSON.stringify(data)}
              </div>
            );
          })()
        )}
      </div>

      <div className={cn("text-[10px] uppercase tracking-widest text-graphite/30 text-center pt-8", isDarkMode && "text-cream/30")}>
        Last Updated {new Date(note.updated_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, isDarkMode }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isDarkMode?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative",
        active
          ? (isDarkMode ? "text-cream" : "text-graphite")
          : (isDarkMode ? "text-cream/30 hover:text-cream/50" : "text-graphite/30 hover:text-graphite/50")
      )}
    >
      <div className={cn("transition-transform duration-300", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-[7px] uppercase tracking-widest font-bold">{label}</span>
      {active && (
        <motion.div
          layoutId="nav-dot"
          className={cn("absolute -bottom-1 w-1 h-1 rounded-full", isDarkMode ? "bg-cream" : "bg-graphite")}
        />
      )}
    </button>
  );
}

function TermsScreen({ onAccept, isRevisiting = false, isDarkMode }: { onAccept: () => void, isRevisiting?: boolean, isDarkMode?: boolean }) {
  return (
    <div className={cn(
      "fixed inset-0 bg-cream z-[100] flex flex-col transition-colors",
      isDarkMode && "bg-graphite"
    )}>
      {/* Header — non-scrollable */}
      <div
        className="flex-shrink-0 px-8 pt-6 pb-4 max-w-md w-full mx-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}
      >
        <div className="flex justify-between items-start">
          <SeekerLogo className="justify-center" large isDarkMode={isDarkMode} />
          {isRevisiting && (
            <button
              onClick={onAccept}
              className={cn("p-2 bg-graphite/5 rounded-full", isDarkMode && "bg-white/10")}
            >
              <X className={cn("w-5 h-5 text-graphite", isDarkMode && "text-cream")} />
            </button>
          )}
        </div>
        <h2 className={cn("text-2xl font-serif italic text-graphite mt-6", isDarkMode && "text-cream")}>Privacy Policy & EULA</h2>
        <p className={cn("text-sm mt-2 text-graphite/60", isDarkMode && "text-cream/60")}>Welcome to Seeker Vault. By using this application, you agree to the following terms and conditions:</p>
      </div>

      {/* GitHub links */}
      <div className="flex-shrink-0 px-8 pb-2 max-w-md w-full mx-auto flex gap-3">
        <button
          onClick={async () => { try { await Browser.open({ url: 'https://github.com/imFiz/Seeker-Vault/blob/main/PRIVACY.md' }); } catch { window.open('https://github.com/imFiz/Seeker-Vault/blob/main/PRIVACY.md', '_blank'); } }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] uppercase tracking-widest font-medium transition-opacity hover:opacity-80",
            isDarkMode ? "border-white/20 text-cream/60" : "border-graphite/15 text-graphite/50"
          )}
        >
          <ExternalLink className="w-3 h-3" />
          Privacy Policy
        </button>
        <button
          onClick={async () => { try { await Browser.open({ url: 'https://github.com/imFiz/Seeker-Vault/blob/main/EULA.md' }); } catch { window.open('https://github.com/imFiz/Seeker-Vault/blob/main/EULA.md', '_blank'); } }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] uppercase tracking-widest font-medium transition-opacity hover:opacity-80",
            isDarkMode ? "border-white/20 text-cream/60" : "border-graphite/15 text-graphite/50"
          )}
        >
          <ExternalLink className="w-3 h-3" />
          EULA
        </button>
      </div>

      {/* Scrollable terms content */}
      <div className="flex-1 overflow-y-auto px-8 pb-4 max-w-md w-full mx-auto">
        <div className={cn(
          "bg-white/50 border border-graphite/5 rounded-2xl p-6 space-y-6 text-[11px] leading-relaxed",
          isDarkMode && "bg-white/5 border-white/10"
        )}>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>1. Zero-Knowledge Architecture</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>Seeker Vault is built on a zero-knowledge principle. We do not have access to your master password, biometrics, private keys, or any data stored within the application. All encryption and decryption happen locally on your device. We cannot reset your password or recover your data if lost.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>2. Local-Only Storage & Sovereignty</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>Your data is stored exclusively on your device's secure storage. No data is synchronized to our servers, cloud providers, or third-party databases. You maintain absolute sovereignty over your information. This means if you delete the app without a backup, your data is gone forever.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>3. Cryptographic Security & Risks</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>While we use industry-standard AES-256 encryption, no system is 100% secure. You acknowledge the inherent risks of storing sensitive cryptographic keys on a mobile device. You are responsible for ensuring your device is not compromised by malware, unauthorized physical access, or jailbreaking.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>4. No Liability & Financial Disclaimer</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>SEEKER VAULT IS PROVIDED AS IS WITHOUT WARRANTY OF ANY KIND. THE DEVELOPERS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT NOT LIMITED TO THE LOSS OF CRYPTOCURRENCY, DIGITAL ASSETS, OR ACCESS TO FINANCIAL ACCOUNTS. YOU USE THIS APPLICATION AT YOUR OWN RISK.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>5. Hardware Failure & User Responsibility</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>It is your absolute responsibility to maintain physical, offline backups of your seed phrases and critical secrets. We are NOT liable for phone failure, biometric sensor malfunction, or any hardware issues with your device or Seeker Vault components. You use this application at your own risk. Ideally, keep your most critical information in your head or on a physical piece of paper in a secure location. Never rely solely on a single digital device.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>6. Prohibited Uses</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>You agree not to use Seeker Vault for any illegal activities, including money laundering, terrorist financing, or storing stolen credentials. We reserve the right to discontinue support for the application at any time without notice.</p>
          </section>
          <section>
            <h3 className={cn("font-bold uppercase tracking-widest text-graphite mb-2", isDarkMode && "text-cream")}>7. Updates & Changes</h3>
            <p className={cn("text-graphite/60", isDarkMode && "text-cream/60")}>We may update these terms from time to time. Continued use of the application after such changes constitutes your acceptance of the new terms. You should periodically review the Privacy Policy and EULA within the app settings.</p>
          </section>
        </div>
      </div>

      {/* Sticky accept button — always visible at bottom */}
      <div
        className={cn(
          "flex-shrink-0 px-8 pt-4 max-w-md w-full mx-auto",
          isDarkMode
            ? "bg-gradient-to-t from-graphite via-graphite to-transparent"
            : "bg-gradient-to-t from-cream via-cream to-transparent"
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <button
          onClick={onAccept}
          className={cn(
            "w-full py-4 bg-graphite text-cream rounded-2xl font-bold uppercase tracking-widest text-xs shadow-2xl active:scale-[0.98] transition-all",
            isDarkMode && "bg-cream text-graphite shadow-cream/10"
          )}
        >
          {isRevisiting ? 'Close Terms' : 'I Accept the Terms & Conditions'}
        </button>
      </div>
    </div>
  );
}
