import type { CapacitorConfig } from '@capacitor/cli'; 
const config: CapacitorConfig = { 
  appId: 'com.aibat.seekervault',
  appName: 'Seeker Vault', 
  webDir: 'dist', 
  server: { allowNavigation: ['mainnet.helius-rpc.com', 'seekervault.whoim.space'] }
}; 
export default config; 
