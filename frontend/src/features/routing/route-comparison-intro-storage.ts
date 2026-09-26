import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ROUTE_COMPARISON_INTRO_SEEN_KEY = 'herpath.onboarding.route-comparison-seen';

let inMemoryFallback: boolean | null = null;

export interface RouteComparisonIntroStorage {
  isIntroSeen(): Promise<boolean>;
  setIntroSeen(seen?: boolean): Promise<void>;
  resetIntro(): Promise<void>;
}

export const routeComparisonIntroStorage: RouteComparisonIntroStorage = {
  async isIntroSeen(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(ROUTE_COMPARISON_INTRO_SEEN_KEY) === 'true';
        }
        return inMemoryFallback ?? false;
      }
      const value = await SecureStore.getItemAsync(ROUTE_COMPARISON_INTRO_SEEN_KEY);
      return value === 'true';
    } catch {
      return inMemoryFallback ?? false;
    }
  },

  async setIntroSeen(seen = true): Promise<void> {
    try {
      inMemoryFallback = seen;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ROUTE_COMPARISON_INTRO_SEEN_KEY, seen ? 'true' : 'false');
        }
        return;
      }
      await SecureStore.setItemAsync(ROUTE_COMPARISON_INTRO_SEEN_KEY, seen ? 'true' : 'false');
    } catch {
      // Graceful fallback if storage write fails
    }
  },

  async resetIntro(): Promise<void> {
    try {
      inMemoryFallback = false;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(ROUTE_COMPARISON_INTRO_SEEN_KEY);
        }
        return;
      }
      await SecureStore.deleteItemAsync(ROUTE_COMPARISON_INTRO_SEEN_KEY);
    } catch {
      // Graceful fallback if storage delete fails
    }
  },
};
