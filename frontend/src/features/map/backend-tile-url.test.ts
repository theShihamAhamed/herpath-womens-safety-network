import { getBackendTileUrlTemplate } from './backend-tile-url';

jest.mock('@/src/config/environment', () => ({
  environment: { apiBaseUrl: 'https://api.example.test/api/v1' },
}));

describe('backend map tile URL', () => {
  it('targets the HerPath tile proxy path', () => {
    expect(getBackendTileUrlTemplate()).toBe(
      'https://api.example.test/api/v1/map/tiles/{z}/{x}/{y}',
    );
  });
});
