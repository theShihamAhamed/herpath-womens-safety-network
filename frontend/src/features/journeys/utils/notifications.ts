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

async function configureJourneyNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await setNotificationChannelAsync(JOURNEY_NOTIFICATION_CHANNEL_ID, {
    name: 'Journey safety alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  const { status } = await getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await requestPermissionsAsync();
    if (newStatus !== 'granted') return false;
    await configureJourneyNotificationChannel();
    return true;
  }
  await configureJourneyNotificationChannel();
  return true;
}

export async function sendDeviationNotification() {
  if (Platform.OS === 'web') return;

  await configureJourneyNotificationChannel();
  await scheduleNotificationAsync({
    content: {
      title: 'Route deviation detected',
      body: 'You have deviated from the recommended route.',
      sound: true,
    },
    trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
  });
}

export async function sendArrivalNotification() {
  if (Platform.OS === 'web') return;

  await configureJourneyNotificationChannel();
  await scheduleNotificationAsync({
    content: {
      title: 'Journey completed',
      body: 'You have arrived at your destination.',
      sound: true,
    },
    trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
  });
}
