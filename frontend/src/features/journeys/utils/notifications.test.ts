import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  JOURNEY_NOTIFICATION_CHANNEL_ID,
  requestNotificationPermission,
  sendArrivalNotification,
  sendDeviationNotification,
} from './notifications';

jest.mock('expo-constants', () => ({ default: { appOwnership: 'expo' } }));
jest.mock('expo-notifications', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
}));

const mockGetPermissionsAsync = jest.mocked(ExpoNotifications.getPermissionsAsync);
const mockRequestPermissionsAsync = jest.mocked(ExpoNotifications.requestPermissionsAsync);
const mockScheduleNotificationAsync = jest.mocked(ExpoNotifications.scheduleNotificationAsync);
const mockSetNotificationChannelAsync = jest.mocked(ExpoNotifications.setNotificationChannelAsync);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);

function permissionStatus(status: ExpoNotifications.PermissionStatus) {
  return {
    status,
    expires: 'never' as const,
    granted: status === ExpoNotifications.PermissionStatus.GRANTED,
    canAskAgain: status !== ExpoNotifications.PermissionStatus.DENIED,
  };
}

describe('journey local notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  it('keeps local notifications available in Expo Go and configures an Android channel', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(ExpoNotifications.PermissionStatus.GRANTED));

    await expect(requestNotificationPermission()).resolves.toBe(true);

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      JOURNEY_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Journey safety alerts',
        importance: 6,
      }),
    );
  });

  it('does not configure or schedule notifications when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permissionStatus(ExpoNotifications.PermissionStatus.DENIED));
    mockRequestPermissionsAsync.mockResolvedValue(permissionStatus(ExpoNotifications.PermissionStatus.DENIED));

    await expect(requestNotificationPermission()).resolves.toBe(false);
    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('schedules deviation and arrival alerts on the journey channel', async () => {
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
