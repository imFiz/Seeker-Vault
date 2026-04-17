import { registerPlugin } from '@capacitor/core';

export interface SafSaverPlugin {
  saveFile(options: {
    filename: string;
    sourcePath?: string;  // absolute path to temp file on disk
    data?: string;        // base64 — alternative to sourcePath, plugin writes temp itself
    mimeType?: string;
  }): Promise<{ success: boolean; uri: string; bytes: number }>;
}

export const SafSaver = registerPlugin<SafSaverPlugin>('SafSaver');
