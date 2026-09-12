import type { ClientSession } from 'mongoose';

import type { IncidentCommunityState } from '../incidents/incident.types.js';
import { CommunityVerificationRepository } from './community-verification.repository.js';

export interface CommunityEvidenceRead {
  communityState: IncidentCommunityState;
  supportCount: number;
  activeFeedbackCount: number;
  evidenceRevision: number;
  evaluatedAt: string;
}

export class CommunityEvidenceReader {
  public constructor(private readonly verification: CommunityVerificationRepository) {}

  public async findByIncidentId(
    incidentId: string,
    session?: ClientSession,
  ): Promise<CommunityEvidenceRead | null> {
    const snapshot = await this.verification.findSnapshot(incidentId, session);
    if (!snapshot) return null;

    return {
      communityState: snapshot.communityState,
      supportCount: snapshot.supportCount,
      activeFeedbackCount:
        snapshot.activeCounts.support +
        snapshot.activeCounts.resolved +
        snapshot.activeCounts.dispute +
        snapshot.activeCounts.unsure,
      evidenceRevision: snapshot.evidenceRevision,
      evaluatedAt: snapshot.evaluatedAt.toISOString(),
    };
  }
}

export function createCommunityEvidenceReader(): CommunityEvidenceReader {
  return new CommunityEvidenceReader(new CommunityVerificationRepository());
}
