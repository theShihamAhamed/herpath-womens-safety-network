import { useLocalSearchParams } from 'expo-router';

import { ModerationCaseReviewScreen } from '@/src/features/moderation/screens/moderation-case-review-screen';

export default function ModerationCaseRoute() {
  const params = useLocalSearchParams();
  const caseId = typeof params.caseId === 'string' ? params.caseId : null;

  return <ModerationCaseReviewScreen caseId={caseId} />;
}
