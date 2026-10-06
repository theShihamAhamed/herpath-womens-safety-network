/// <reference types="jest" />

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { journeyApi } from '../api/journeyApi';
import type { IncomingRouteParams, Journey } from '../types';
import JourneyTrackingScreen from './JourneyTrackingScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({ accessToken: 'access-token', status: 'ready' }),
}));

jest.mock('../api/journeyApi', () => ({
  journeyApi: {
    start: jest.fn(),
    cancel: jest.fn(),
    updateLocation: jest.fn(),
    checkIn: jest.fn(),
    reportDeviation: jest.fn(),
    finish: jest.fn(),
    history: jest.fn(),
  },
}));

jest.mock('../components/JourneyMap', () => () => null);
jest.mock('../components/FeedbackOverlay', () => () => null);
jest.mock('../components/ArrivalPrompt', () => () => null);
jest.mock('../utils/polyline', () => ({ decodePolyline: () => [] }));
jest.mock('../utils/geo', () => ({
  distanceBetween: () => 1_000,
  distanceToPath: () => 0,
}));
jest.mock('../utils/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => true),
  sendDeviationNotification: jest.fn(async () => undefined),
  sendArrivalNotification: jest.fn(async () => undefined),
}));

const requestForegroundPermissionsAsync = jest.mocked(Location.requestForegroundPermissionsAsync);
const watchPositionAsync = jest.mocked(Location.watchPositionAsync);
const startJourney = jest.mocked(journeyApi.start);
const cancelJourney = jest.mocked(journeyApi.cancel);
const updateLocation = jest.mocked(journeyApi.updateLocation);
const finishJourney = jest.mocked(journeyApi.finish);

const params: IncomingRouteParams = {
  routeId: 'route-1',
  origin: { latitude: 6.9271, longitude: 79.8612 },
  destination: { latitude: 6.95, longitude: 79.88 },
  polyline: 'encoded-route',
};

const startedJourney: Journey = {
  _id: 'journey-ABC',
  origin: params.origin,
  destination: params.destination,
  selectedRoute: { polyline: params.polyline },
  distanceTravelled: 0,
  duration: 0,
  currentPath: [],
  checkIns: [],
  deviationDetected: false,
  deviationLocation: null,
  outcome: null,
  status: 'ACTIVE',
};

function location(latitude: number, longitude: number): Location.LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

describe('JourneyTrackingScreen', () => {
  const remove = jest.fn();
  let emitLocation: Location.LocationCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    watchPositionAsync.mockImplementation(async (_options, callback) => {
      emitLocation = callback;
      return { remove };
    });
    startJourney.mockResolvedValue(startedJourney);
    cancelJourney.mockResolvedValue({ ...startedJourney, status: 'COMPLETED', outcome: 'UNKNOWN' });
    updateLocation.mockResolvedValue(startedJourney);
    finishJourney.mockResolvedValue({ ...startedJourney, status: 'COMPLETED' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  async function startRenderedJourney() {
    const screen = render(<JourneyTrackingScreen params={params} />);
    fireEvent.press(screen.getByLabelText('Start journey'));
    await waitFor(() => expect(watchPositionAsync).toHaveBeenCalledTimes(1));
    return screen;
  }

  it('uses the journey ID returned by start for the first location sample', async () => {
    await startRenderedJourney();

    expect(requestForegroundPermissionsAsync.mock.invocationCallOrder[0]).toBeLessThan(
      startJourney.mock.invocationCallOrder[0],
    );
    expect(startJourney.mock.invocationCallOrder[0]).toBeLessThan(
      watchPositionAsync.mock.invocationCallOrder[0],
    );

    act(() => emitLocation(location(6.93, 79.87)));

    await waitFor(() => {
      expect(updateLocation).toHaveBeenCalledWith(
        'access-token',
        'journey-ABC',
        { latitude: 6.93, longitude: 79.87 },
      );
    });
  });

  it('shows delayed synchronization and clears it after the next successful update', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    updateLocation
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(startedJourney);
    const screen = await startRenderedJourney();

    act(() => emitLocation(location(6.93, 79.87)));
    await waitFor(() => {
      expect(screen.getByText(/location syncing is delayed/i)).toBeTruthy();
    });

    act(() => emitLocation(location(6.94, 79.88)));
    await waitFor(() => {
      expect(screen.queryByText(/location syncing is delayed/i)).toBeNull();
    });
    warn.mockRestore();
  });

  it('does not create a backend journey when foreground permission is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });
    const screen = render(<JourneyTrackingScreen params={params} />);

    fireEvent.press(screen.getByLabelText('Start journey'));

    await waitFor(() => expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1));
    expect(startJourney).not.toHaveBeenCalled();
    expect(watchPositionAsync).not.toHaveBeenCalled();
  });

  it('prevents racing start actions from creating duplicate journeys or watchers', async () => {
    const screen = render(<JourneyTrackingScreen params={params} />);
    const startButton = screen.getByLabelText('Start journey');

    fireEvent.press(startButton);
    fireEvent.press(startButton);

    await waitFor(() => expect(watchPositionAsync).toHaveBeenCalledTimes(1));
    expect(startJourney).toHaveBeenCalledTimes(1);
  });

  it('cancels the created backend journey if watcher startup fails', async () => {
    watchPositionAsync.mockRejectedValueOnce(new Error('watch unavailable'));
    const screen = render(<JourneyTrackingScreen params={params} />);

    fireEvent.press(screen.getByLabelText('Start journey'));

    await waitFor(() => {
      expect(cancelJourney).toHaveBeenCalledWith('access-token', 'journey-ABC');
    });
    expect(screen.getByLabelText('Start journey')).toBeTruthy();
  });

  it('stops tracking and ignores late samples after cancellation', async () => {
    const screen = await startRenderedJourney();
    fireEvent.press(screen.getByLabelText('Cancel journey'));

    const confirmation = jest.mocked(Alert.alert).mock.calls.find(
      ([title]) => title === 'Cancel journey?',
    );
    const destructiveAction = confirmation?.[2]?.find((button) => button.style === 'destructive');
    await act(async () => {
      await destructiveAction?.onPress?.();
    });

    expect(cancelJourney).toHaveBeenCalledWith('access-token', 'journey-ABC');
    expect(remove).toHaveBeenCalledTimes(1);
    updateLocation.mockClear();
    act(() => emitLocation(location(6.94, 79.88)));
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it('stops tracking and ignores late samples after a successful finish', async () => {
    const screen = await startRenderedJourney();

    fireEvent.press(screen.getByLabelText('End journey'));
    await waitFor(() => expect(finishJourney).toHaveBeenCalledWith('access-token', 'journey-ABC'));

    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/journey/outcome',
      params: { journeyId: 'journey-ABC' },
    });
    updateLocation.mockClear();
    act(() => emitLocation(location(6.94, 79.88)));
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it('removes the watcher and ignores late samples when unmounted', async () => {
    const screen = await startRenderedJourney();

    screen.unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    act(() => emitLocation(location(6.94, 79.88)));
    expect(updateLocation).not.toHaveBeenCalled();
  });
});
