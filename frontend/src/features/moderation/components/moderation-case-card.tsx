import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import {
  MODERATION_ASSIGNMENT_LABELS,
  MODERATION_CASE_STATE_LABELS,
  MODERATION_PRIORITY_LABELS,
} from '../moderation-labels';
import type { ModerationPriority, ModerationQueueCase } from '../moderation.types';

interface ModerationCaseCardProps {
  moderationCase: ModerationQueueCase;
  onReview(): void;
}

function readableEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function priorityStyle(priority: ModerationPriority) {
  if (priority === 'URGENT') return styles.priorityUrgent;
  if (priority === 'HIGH') return styles.priorityHigh;
  return styles.priorityNormal;
}

export function ModerationCaseCard({ moderationCase, onReview }: ModerationCaseCardProps) {
  const { incident } = moderationCase;
  const priorityLabel = MODERATION_PRIORITY_LABELS[moderationCase.priority];
  const stateLabel = MODERATION_CASE_STATE_LABELS[moderationCase.state];
  const assignmentLabel = MODERATION_ASSIGNMENT_LABELS[moderationCase.assignment.state];
  const categoryLabel = readableEnum(incident.category);
  const severityLabel = readableEnum(incident.severity);
  const flagLabel = `${moderationCase.flagCount} ${moderationCase.flagCount === 1 ? 'flag' : 'flags'}`;

  return (
    <Pressable
      accessibilityLabel={`${priorityLabel} priority ${stateLabel} case, ${categoryLabel}, ${severityLabel} severity, ${assignmentLabel}, ${flagLabel}. Review case.`}
      accessibilityRole="button"
      onPress={onReview}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.heading}>
        <View style={[styles.priorityBadge, priorityStyle(moderationCase.priority)]}>
          <Text style={styles.priorityText}>{priorityLabel}</Text>
        </View>
        <View style={styles.stateBadge}>
          <Text style={styles.stateText}>{stateLabel}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{categoryLabel}</Text>
          <Text style={styles.severity}>{severityLabel} severity</Text>
        </View>
        <MaterialIcons name="chevron-right" size={26} color={palette.textMuted} />
      </View>

      <View style={styles.metadata}>
        <MetadataRow icon="person-outline" text={assignmentLabel} />
        <MetadataRow icon="flag" text={flagLabel} />
        <MetadataRow
          icon="schedule"
          text={`Latest activity ${new Date(moderationCase.latestActivityAt).toLocaleString()}`}
        />
      </View>

      <Text style={styles.reviewText}>Review case</Text>
    </Pressable>
  );
}

function MetadataRow({
  icon,
  text,
}: {
  icon: 'flag' | 'person-outline' | 'schedule';
  text: string;
}) {
  return (
    <View style={styles.metadataRow}>
      <MaterialIcons name={icon} size={17} color={palette.textMuted} />
      <Text style={styles.metadataText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  cardPressed: { opacity: 0.78 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priorityBadge: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  priorityNormal: { backgroundColor: palette.primary },
  priorityHigh: { backgroundColor: palette.accent },
  priorityUrgent: { backgroundColor: palette.error },
  priorityText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  stateBadge: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surfaceMuted,
  },
  stateText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleCopy: { flex: 1, gap: spacing.xs },
  title: { color: palette.text, fontSize: 19, fontWeight: '900' },
  severity: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  metadata: { gap: spacing.sm },
  metadataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metadataText: { flex: 1, color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  reviewText: { color: palette.primary, fontSize: 14, fontWeight: '900' },
});
