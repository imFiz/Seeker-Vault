import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  NativeModules,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

// Native Module for Android 15 Private Space (Managed Profile API)
const { PrivateSpaceModule } = NativeModules;
const rnBiometrics = new ReactNativeBiometrics();

const RECEIVER_ADDRESS = '7K8Q4zGvJ4X5z1tW4PqE8yX89p8b9VzPzXzPzXzPzXzP'; // Replace with real merchant address
const SOL_AMOUNT = 0.35; // ~$50 USD equivalent

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Real Biometric Verification
  const authenticateBiometrics = async (): Promise<boolean> => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (available && biometryType === BiometryTypes.Biometrics) {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Confirm Identity for Private Space',
          cancelButtonText: 'Cancel',
        });
        return success;
      } else {
        Alert.alert('Error', 'Biometrics not available on this device.');
        return false;
      }
    } catch (error) {
      console.error('Biometric Error:', error);
      return false;
    }
  };

  // 2. Real Seed Vault Hardware Signature (Solana Mobile Stack)
  const payWithSeedVault = async (): Promise<boolean> => {
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      let isSuccess = false;

      await transact(async (wallet) => {
        // Authorize with the hardware wallet
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'Seeker Vault Premium',
            uri: 'https://seekervault.app',
            icon: 'favicon.ico', // Must be a valid URI in production
          },
        });

        const account = authResult.accounts[0];

        // Create a real transaction to pay for the Private Space
        const latestBlockhash = await connection.getLatestBlockhash();
        const tx = new Transaction({
          feePayer: new PublicKey(account.address),
          ...latestBlockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(account.address),
            toPubkey: new PublicKey(RECEIVER_ADDRESS),
            lamports: SOL_AMOUNT * 1e9, // Convert SOL to Lamports
          })
        );

        // Request hardware signature from Seed Vault
        const signedTxs = await wallet.signTransactions({
          transactions: [tx],
        });

        // Send the signed transaction to the network
        const txId = await connection.sendRawTransaction(signedTxs[0].serialize());
        console.log('Transaction successful! Signature:', txId);

        // Wait for confirmation
        await connection.confirmTransaction({
          signature: txId,
          ...latestBlockhash
        });

        isSuccess = true;
      });

      return isSuccess;
    } catch (error: any) {
      console.error('Seed Vault Error:', error);
      Alert.alert('Transaction Failed', error.message || 'Hardware signature rejected.');
      return false;
    }
  };

  // 3. Unlock Flow
  const unlockPrivateSpace = async () => {
    setIsLoading(true);

    // Step 1: Biometrics
    const bioSuccess = await authenticateBiometrics();
    if (!bioSuccess) {
      setIsLoading(false);
      return;
    }

    // Step 2: Seed Vault Payment / Signature
    const paymentSuccess = await payWithSeedVault();
    if (paymentSuccess) {
      // Step 3: Call Android 15 Native Module to disable Quiet Mode
      try {
        await PrivateSpaceModule.unlockPrivateSpace();
        setIsUnlocked(true);
        Alert.alert('Success', 'Private Space is now active and isolated.');
      } catch (e: any) {
        Alert.alert('OS Error', 'Failed to interact with Android 15 Managed Profile API.');
      }
    }

    setIsLoading(false);
  };

  // 4. Lock Flow
  const lockPrivateSpace = async () => {
    try {
      // Call Android 15 Native Module to enable Quiet Mode (Lock)
      await PrivateSpaceModule.lockPrivateSpace();
      setIsUnlocked(false);
      Alert.alert('Locked', 'Private Space has been secured.');
    } catch (error) {
      console.error('Failed to lock private space:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seeker Vault</Text>
      <Text style={styles.subtitle}>Hardware-Secured Environment</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#10B981" />
      ) : !isUnlocked ? (
        <TouchableOpacity style={styles.button} onPress={unlockPrivateSpace}>
          <Text style={styles.buttonText}>Pay 0.35 SOL & Unlock Space</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.unlockedContainer}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>ISOLATED</Text>
          </View>
          <Text style={styles.successText}>Private Space Active</Text>
          <TouchableOpacity style={[styles.button, styles.lockButton]} onPress={lockPrivateSpace}>
            <Text style={styles.buttonText}>Close & Lock Space</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#F5F2ED',
    fontFamily: 'serif',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#8E9299',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  lockButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unlockedContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successText: {
    color: '#10B981',
    fontSize: 20,
    fontFamily: 'serif',
    marginBottom: 20,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    marginBottom: 12,
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
