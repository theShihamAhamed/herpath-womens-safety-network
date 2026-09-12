import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'herpath.auth.refresh-token';

export interface RefreshTokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export const refreshTokenStorage: RefreshTokenStorage = {
  async get() {
    if (Platform.OS === 'web') return null;
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async set(token) {
    if (Platform.OS === 'web') return;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async clear() {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
