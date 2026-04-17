// No imports needed — types are self-contained

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ChecklistData {
  type: 'checklist';
  items: ChecklistItem[];
}

export interface VaultFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64 encoded, encrypted
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Encrypted JSON string for structured data
  type: 'notes' | 'keys' | 'passwords' | 'secrets';
  category: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface VaultSettings {
  autoLockTimeout: number; // in minutes
  isDarkMode: boolean;
  isPremium: boolean;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  walletEnabled: boolean;
  soundEnabled: boolean;
}

export const KEY_ECOSYSTEMS = ['Solana', 'Cosmos', 'EVM', 'Bitcoin', 'Other'];
export const KEY_TYPES = ['Seed Phrase', 'Private Key', 'API Key'];

export const LOGIN_TYPES = ['Exchange', 'DeFi', 'Email', 'Social', 'Other'];

// Recipient wallet for premium payments
export const PAYMENT_WALLET_ADDRESS = "4KrB3n9NBogHwB9fByFPxw9XrK4z21UcD3748GP4WTT9";

// Premium price: $9 USD
export const PREMIUM_PRICE_USD = 9;

// Max file sizes for vault storage
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
export const MAX_TOTAL_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB total

export const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};
