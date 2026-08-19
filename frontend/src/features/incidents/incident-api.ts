import { apiRequest } from '@/src/services/api/client';
import { apiEndpoints } from '@/src/services/api/endpoints';

import type {
  CreateIncidentInput,
  LocationCellViewport,
  OwnerIncident,
  OwnerIncidentPage,
  SelectableLocationCell,
} from './incident.types';

export const incidentApi = {
  create(accessToken: string, input: CreateIncidentInput): Promise<OwnerIncident> {
    return apiRequest<OwnerIncident>(apiEndpoints.incidents.create, {
      method: 'POST',
      accessToken,
      body: input,
    });
  },

  async locationCells(
    accessToken: string,
    viewport: LocationCellViewport,
  ): Promise<SelectableLocationCell[]> {
    const query = new URLSearchParams(
      Object.entries(viewport).map(([key, value]) => [key, value.toString()]),
    );
    const data = await apiRequest<{ items: SelectableLocationCell[] }>(
      `${apiEndpoints.incidents.locationCells}?${query.toString()}`,
      { accessToken },
    );
    return data.items;
  },

  mine(accessToken: string, limit = 20, cursor?: string): Promise<OwnerIncidentPage> {
    const query = new URLSearchParams({ limit: limit.toString() });
    if (cursor) query.set('cursor', cursor);
    return apiRequest<OwnerIncidentPage>(
      `${apiEndpoints.incidents.mine}?${query.toString()}`,
      { accessToken },
    );
  },
};
