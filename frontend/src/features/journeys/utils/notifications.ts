import Constants from 'expo-constants';
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationsModule = {
  setNotificationHandler: (handler: Record<string, unknown>) => void;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  scheduleNotificationAsync: (notification: Record<string, unknown>) => Promise<string>;
};

function getNotifications(): NotificationsModule | null {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (Platform.OS === 'web' || isExpoGo) {
    return null;
  }

  return ExpoNotifications as NotificationsModule;
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

export async function requestNotificationPermission() {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }
  return true;
}

export async function sendDeviationNotification() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Route deviation detected',
      body: 'You have deviated from the recommended route.',
      sound: true,
    },
    trigger: null,
  });
}

export async function sendArrivalNotification() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Journey completed',
      body: 'You have arrived at your destination.',
      sound: true,
    },
    trigger: null,
  });
}