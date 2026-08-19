import { IncidentRepository } from './incident.repository.js';
import {
  toPublicIncident,
  type PublicIncident,
  type PublicIncidentRadiusRead,
  type PublicIncidentViewportRead,
} from './incident.public.js';

export interface PublicIncidentReader {
  findInViewport(query: PublicIncidentViewportRead): Promise<PublicIncident[]>;
  findWithinRadius(query: PublicIncidentRadiusRead): Promise<PublicIncident[]>;
}

export class IncidentPublicReader implements PublicIncidentReader {
  public constructor(private readonly incidents = new IncidentRepository()) {}

  public async findInViewport(query: PublicIncidentViewportRead): Promise<PublicIncident[]> {
    const incidents = await this.incidents.findPublicInViewport(query);
    return incidents.map(toPublicIncident);
  }

  public async findWithinRadius(query: PublicIncidentRadiusRead): Promise<PublicIncident[]> {
    const incidents = await this.incidents.findPublicWithinRadius(query);
    return incidents.map(toPublicIncident);
  }
}
