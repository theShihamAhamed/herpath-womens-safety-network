import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = typeof ExpoNotifications;
export const JOURNEY_NOTIFICATION_CHANNEL_ID = 'journey-safety-alerts';

function getNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  return ExpoNotifications;
}

const Notifications = getNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
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
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(JOURNEY_NOTIFICATION_CHANNEL_ID, {
    name: 'Journey safety alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission() {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return false;
    await configureJourneyNotificationChannel();
    return true;
  }
  await configureJourneyNotificationChannel();
  return true;
}

export async function sendDeviationNotification() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await configureJourneyNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Route deviation detected',
      body: 'You have deviated from the recommended route.',
      sound: true,
    },
    trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
  });
}

export async function sendArrivalNotification() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await configureJourneyNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Journey completed',
      body: 'You have arrived at your destination.',
      sound: true,
    },
    trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
  });
}
