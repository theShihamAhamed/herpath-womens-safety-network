import { useLocalSearchParams } from 'expo-router';

import { ModerationDecisionScreen } from '@/src/features/moderation/screens/moderation-decision-screen';

export default function ModerationDecisionRoute() {
  const params = useLocalSearchParams();
  const caseId = typeof params.caseId === 'string' ? params.caseId : null;

  return <ModerationDecisionScreen caseId={caseId} />;
}
