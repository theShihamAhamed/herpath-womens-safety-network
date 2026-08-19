import { randomUUID } from 'node:crypto';

import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import {
  createIncidentBodySchema,
  locationCellsQuerySchema,
  mineQuerySchema,
} from '../../src/modules/incidents/incident.validation.js';

function exactBody(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: randomUUID(),
    category: 'HARASSMENT',
    severity: 'HIGH',
    occurredAt: '2026-08-18T20:15:00+05:30',
    location: {
      mode: 'EXACT_PRIVATE',
      privateLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
    },
    ...overrides,
  };
}

describe('incident API validation', () => {
  it('normalizes UUID, timestamp, and optional description', () => {
    const id = randomUUID().toUpperCase();
    const result = createIncidentBodySchema.parse(
      exactBody({ clientSubmissionId: ` ${id} `, description: '  safe details  ' }),
    );

    expect(result.clientSubmissionId).toBe(id.toLowerCase());
    expect(result.occurredAt.toISOString()).toBe('2026-08-18T14:45:00.000Z');
    expect(result.description).toBe('safe details');
    expect(createIncidentBodySchema.parse(exactBody({ description: '   ' })).description).toBeUndefined();
  });

  it('requires a UUIDv4 and a timestamp with an explicit zone', () => {
    expect(() => createIncidentBodySchema.parse(exactBody({ clientSubmissionId: randomUUID().replace('-4', '-1') }))).toThrow();
    expect(() => createIncidentBodySchema.parse(exactBody({ occurredAt: '2026-08-18T20:15:00' }))).toThrow();
    expect(() => createIncidentBodySchema.parse(exactBody({ occurredAt: 'not-a-date+05:30' }))).toThrow();
  });

  it('rejects timestamps more than five minutes in the future', () => {
    const future = new Date(Date.now() + 5 * 60_000 + 5_000).toISOString();
    expect(() => createIncidentBodySchema.parse(exactBody({ occurredAt: future }))).toThrow(/5 minutes/);
  });

  it('enforces strict, mutually exclusive location modes', () => {
    const cellId = latLngToCell(6.9271, 79.8612, 8);
    expect(() => createIncidentBodySchema.parse({ ...exactBody(), reporterId: 'injected' })).toThrow();
    expect(() => createIncidentBodySchema.parse(exactBody({ location: { ...exactBody().location, selectedAreaCellId: cellId } }))).toThrow();
    expect(() => createIncidentBodySchema.parse(exactBody({ location: { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: cellId, privateLocation: exactBody().location.privateLocation } }))).toThrow();
    expect(() => createIncidentBodySchema.parse(exactBody({ location: { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: latLngToCell(6.9271, 79.8612, 7) } }))).toThrow(/resolution 8/);
  });

  it('validates viewport bounds and non-wrapping size limits', () => {
    expect(locationCellsQuerySchema.parse({ north: '6.95', south: '6.90', east: '79.90', west: '79.85' })).toEqual({ north: 6.95, south: 6.9, east: 79.9, west: 79.85 });
    expect(() => locationCellsQuerySchema.parse({ north: 7.1, south: 6.9, east: 79.9, west: 79.85 })).toThrow(/latitude span/);
    expect(() => locationCellsQuerySchema.parse({ north: 6.95, south: 6.9, east: 79.8, west: 79.9 })).toThrow(/wrapped/);
  });

  it('applies owner-history pagination bounds', () => {
    expect(mineQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(mineQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(() => mineQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => mineQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => mineQuerySchema.parse({ reporterId: 'injected' })).toThrow();
  });
});
