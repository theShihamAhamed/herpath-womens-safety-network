import { apiRequest } from '@/src/services/api/client';

import { fetchRouteAlternatives } from './routingApi';
import { fetchRouteRecommendation } from './recommendationApi';

jest.mock('@/src/services/api/client', () => ({ apiRequest: jest.fn() }));

const mockedApiRequest = jest.mocked(apiRequest);

describe('routing API clients', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('uses the canonical alternatives endpoint and returns the unwrapped payload', async () => {
    const payload = { count: 1, routes: [] };
    mockedApiRequest.mockResolvedValue(payload);

    await expect(
      fetchRouteAlternatives({ lat: 6.9, lng: 79.8 }, { lat: 7.1, lng: 80.0 }),
    ).resolves.toBe(payload);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/routes/alternatives?origin=6.9%2C79.8&destination=7.1%2C80&mode=walking',
    );
  });

  it('uses the canonical recommendation endpoint and preserves the selected mode', async () => {
    const payload = { recommendedRouteId: 'route-1', routes: [], explanation: 'safe' };
    mockedApiRequest.mockResolvedValue(payload);

    await expect(
      fetchRouteRecommendation({ lat: 6.9, lng: 79.8 }, { lat: 7.1, lng: 80.0 }, 'driving'),
    ).resolves.toBe(payload);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/routes/recommendation?origin=6.9%2C79.8&destination=7.1%2C80&mode=driving',
    );
  });
});
