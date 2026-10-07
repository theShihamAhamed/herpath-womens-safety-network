import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import { Platform } from 'react-native';
import {
  JOURNEY_NOTIFICATION_CHANNEL_ID,
  requestNotificationPermission,
  sendArrivalNotification,
  sendDeviationNotification,
} from './notifications';

jest.mock('expo-notifications', () => {
  throw new Error('The push-capable expo-notifications entrypoint must not load');
});
jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));
jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
}));
jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  AppOwnership: { Expo: 'expo' },
  default: { appOwnership: 'expo' },
}));

const mockGetPermissionsAsync = jest.mocked(getPermissionsAsync);
const mockRequestPermissionsAsync = jest.mocked(requestPermissionsAsync);
const mockScheduleNotificationAsync = jest.mocked(scheduleNotificationAsync);
const mockSetNotificationChannelAsync = jest.mocked(setNotificationChannelAsync);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);

function permissionStatus(status: PermissionStatus) {
  return {
    status,
    expires: 'never' as const,
    granted: status === PermissionStatus.GRANTED,
    canAskAgain: status !== PermissionStatus.DENIED,
  };
}

describe('journey local notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Constants, 'appOwnership', { configurable: true, value: 'expo' });
  });

  it('uses Expo Go fallback channels instead of its unavailable channel manager', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(PermissionStatus.GRANTED));

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('does not configure or schedule notifications when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(PermissionStatus.DENIED));
    mockRequestPermissionsAsync.mockResolvedValue(permissionStatus(PermissionStatus.DENIED));

    await expect(requestNotificationPermission()).resolves.toBe(false);
    await expect(sendDeviationNotification()).resolves.toBe(false);
    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('configures a dedicated channel before requesting permission in Android builds', async () => {
    Object.defineProperty(Constants, 'appOwnership', { configurable: true, value: null });
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(PermissionStatus.GRANTED));

    await expect(requestNotificationPermission()).resolves.toBe(true);

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      JOURNEY_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({ name: 'Journey safety alerts', importance: 6 }),
    );
  });

  it('schedules deviation and arrival alerts on the journey channel in Android builds', async () => {
    Object.defineProperty(Constants, 'appOwnership', { configurable: true, value: null });
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(PermissionStatus.GRANTED));

    await sendDeviationNotification();
    await sendArrivalNotification();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(1, expect.objectContaining({
      trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
    }));
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({
      trigger: { channelId: JOURNEY_NOTIFICATION_CHANNEL_ID },
    }));
  });
});
