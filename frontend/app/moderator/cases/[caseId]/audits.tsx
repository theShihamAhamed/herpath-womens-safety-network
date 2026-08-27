import { useLocalSearchParams } from 'expo-router';

import { ModerationAuditHistoryScreen } from '@/src/features/moderation/screens/moderation-audit-history-screen';

export default function ModerationAuditHistoryRoute() {
  const params = useLocalSearchParams();
  const caseId = typeof params.caseId === 'string' ? params.caseId : null;

  return <ModerationAuditHistoryScreen caseId={caseId} />;
}
