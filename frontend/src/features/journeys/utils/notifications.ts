import {
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

export const JOURNEY_NOTIFICATION_CHANNEL_ID = 'journey-safety-alerts';

if (Platform.OS !== 'web') {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isExpoGo() {
  return Constants.appOwnership === AppOwnership.Expo;
}

async function configureJourneyNotificationChannel() {
  if (Platform.OS !== 'android' || isExpoGo()) return false;

  try {
    await setNotificationChannelAsync(JOURNEY_NOTIFICATION_CHANNEL_ID, {
      name: 'Journey safety alerts',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
    return true;
  } catch (error) {
    console.warn('Could not configure the journey notification channel', error);
    return false;
  }
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  // Android 13 only presents the permission prompt after a channel exists.
  // Expo Go owns its native channels, so it must use the fallback channel.
  await configureJourneyNotificationChannel();

  const { status } = await getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await requestPermissionsAsync();
    if (newStatus !== 'granted') return false;
    return true;
  }
  return true;
}

export async function sendDeviationNotification() {
  return sendJourneyNotification('Route deviation detected', 'You have deviated from the recommended route.');
}

export async function sendArrivalNotification() {
  return sendJourneyNotification('Journey completed', 'You have arrived at your destination.');
}

async function sendJourneyNotification(title: string, body: string) {
  if (Platform.OS === 'web') return false;

  try {
    const { status } = await getPermissionsAsync();
    if (status !== 'granted') return false;

    const channelConfigured = await configureJourneyNotificationChannel();
    await scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: channelConfigured ? { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID } : null,
    });
    return true;
  } catch (error) {
    // A local alert is supplementary and must never interrupt live tracking.
    console.warn('Could not send a journey notification', error);
    return false;
  }
}
