/// <reference types="jest" />

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { journeyApi } from '../api/journeyApi';
import type { Journey } from '../types';
import JourneyDetailsScreen from './JourneyDetailsScreen';

let mockJourneyMapProps: Record<string, unknown> | undefined;

jest.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({ accessToken: 'access-token', status: 'ready' }),
}));
jest.mock('../api/journeyApi', () => ({
  journeyApi: { getById: jest.fn() },
}));
jest.mock('../utils/polyline', () => ({
  decodePolyline: () => [{ latitude: 6.9, longitude: 79.8 }],
}));
jest.mock('../components/JourneyMap', () => (props: Record<string, unknown>) => {
  mockJourneyMapProps = props;
  return null;
});

const completedJourney: Journey = {
  _id: '0123456789abcdef01234567',
  origin: { latitude: 6.9, longitude: 79.8 },
  destination: { latitude: 7, longitude: 79.9 },
  selectedRoute: { polyline: 'planned-route' },
  startTime: '2026-10-06T10:00:00.000Z',
  endTime: '2026-10-06T10:20:00.000Z',
  distanceTravelled: 1_200,
  duration: 1_200,
  currentPath: [],
  checkIns: [],
  checkInCount: 3,
  deviationDetected: true,
  deviationLocation: null,
  outcome: 'UNKNOWN',
  status: 'COMPLETED',
};

describe('JourneyDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJourneyMapProps = undefined;
    jest.mocked(journeyApi.getById).mockResolvedValue(completedJourney);
  });

  it('renders the retained planned route and terminal summaries without a travelled path', async () => {
    const screen = render(<JourneyDetailsScreen id={completedJourney._id} />);

    await waitFor(() => expect(journeyApi.getById).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Check-ins: 3')).toBeTruthy());
    expect(screen.getByText(/detailed tracking coordinates were removed/i)).toBeTruthy();
    expect(mockJourneyMapProps?.routePath).toEqual([{ latitude: 6.9, longitude: 79.8 }]);
    expect(mockJourneyMapProps?.travelledPath).toEqual([]);
  });
});
