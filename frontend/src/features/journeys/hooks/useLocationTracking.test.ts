/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { useLocationTracking } from './useLocationTracking';

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  watchPositionAsync: jest.fn(),
}));

const watchPositionAsync = jest.mocked(Location.watchPositionAsync);

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

describe('useLocationTracking', () => {
  const remove = jest.fn();
  let emitLocation: Location.LocationCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    watchPositionAsync.mockImplementation(async (_options, callback) => {
      emitLocation = callback;
      return { remove };
    });
  });

  it('dispatches native samples to the latest handler without recreating the watcher', async () => {
    const firstHandler = jest.fn();
    const latestHandler = jest.fn();
    const { result, rerender } = renderHook(
      ({ handler }: { handler: (coords: { latitude: number; longitude: number }) => void }) =>
        useLocationTracking(handler),
      { initialProps: { handler: firstHandler } },
    );

    await act(async () => {
      await result.current.start();
    });
    rerender({ handler: latestHandler });

    act(() => emitLocation(location(6.9271, 79.8612)));

    expect(watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledWith({ latitude: 6.9271, longitude: 79.8612 });
  });

  it('shares a racing start and creates only one native watcher', async () => {
    let resolveSubscription!: (subscription: Location.LocationSubscription) => void;
    watchPositionAsync.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSubscription = resolve;
      }),
    );
    const { result } = renderHook(() => useLocationTracking(jest.fn()));

    let firstStart!: Promise<boolean>;
    let secondStart!: Promise<boolean>;
    act(() => {
      firstStart = result.current.start();
      secondStart = result.current.start();
    });

    expect(firstStart).toBe(secondStart);
    expect(watchPositionAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubscription({ remove });
      await firstStart;
    });
  });

  it('removes the native watcher on unmount and ignores late samples', async () => {
    const handler = jest.fn();
    const { result, unmount } = renderHook(() => useLocationTracking(handler));

    await act(async () => {
      await result.current.start();
    });
    unmount();
    act(() => emitLocation(location(6.9, 79.8)));

    expect(remove).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
