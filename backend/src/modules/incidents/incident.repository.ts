import { Types } from 'mongoose';

import { IncidentModel, type IncidentDocument } from './incident.model.js';
import type { CreateIncidentPersistenceInput } from './incident.types.js';
import { normalizeIncidentLocation } from './location-privacy.service.js';

export class IncidentRepository {
  public async create(input: CreateIncidentPersistenceInput): Promise<IncidentDocument> {
    const location = normalizeIncidentLocation(input.location);
    const incident = {
      reporterId: new Types.ObjectId(input.reporterId),
      clientSubmissionId: input.clientSubmissionId,
      category: input.category,
      severity: input.severity,
      occurredAt: input.occurredAt,
      ...location,
      ...(input.description === undefined ? {} : { description: input.description }),
    };

    return IncidentModel.create(incident);
  }
}
