import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteWithRiskContext } from '../types/routing.types';
import { palette, radius, spacing } from '@/src/theme';

interface RouteCardProps {
  route: RouteWithRiskContext;
  isRecommended: boolean;
  selected: boolean;
  onPress: () => void;
}

interface RiskLevelInfo {
  label: string;
  badgeBg: string;
  textColor: string;
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  explanation: string;
}

function getRiskLevelInfo(count: number, isRecommended: boolean): RiskLevelInfo {
  if (count === 0) {
    return {
      label: 'Lower reported risk',
      badgeBg: '#EAF4F0',
      textColor: '#165B4C',
      iconName: 'shield',
      explanation: isRecommended
        ? 'No recent community reports nearby — lowest risk profile.'
        : 'No recent safety reports recorded along this corridor.',
    };
  }

  if (count <= 3) {
    return {
      label: `${count} recent ${count === 1 ? 'report' : 'reports'}`,
      badgeBg: '#FFF6E6',
      textColor: '#8C570D',
      iconName: 'info-outline',
      explanation: isRecommended
        ? 'Fewer recent reports than alternatives.'
        : 'A few recent reports recorded nearby.',
    };
  }

  return {
    label: `${count} recent reports`,
    badgeBg: '#FDF0ED',
    textColor: '#B23A22',
    iconName: 'warning-amber',
    explanation: 'Multiple safety reports recorded along this corridor.',
  };
}

export function RouteCard({
  route,
  isRecommended,
  selected,
  onPress,
}: RouteCardProps) {
  const riskInfo = getRiskLevelInfo(route.nearbyIncidentCount, isRecommended);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Route ${route.summaryLabel}, ${route.durationText}, ${route.distanceText}, ${riskInfo.label}${selected ? ', selected' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}>
      {/* Header: Route Name & Selection/Recommended Badges */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <MaterialIcons
            name="alt-route"
            size={18}
            color={selected ? palette.primary : palette.text}
            style={styles.routeIcon}
          />
          <Text style={[styles.summaryLabel, selected && styles.summaryLabelSelected]} numberOfLines={2}>
            {route.summaryLabel}
          </Text>
        </View>

        <View style={styles.headerBadges}>
          {isRecommended && (
            <View style={styles.recommendedBadge}>
              <MaterialIcons name="verified" size={12} color="#1F4B4A" />
              <Text style={styles.recommendedBadgeText}>Recommended</Text>
            </View>
          )}

          <View style={[styles.selectionIndicator, selected && styles.selectionIndicatorActive]}>
            {selected ? (
              <MaterialIcons name="check" size={14} color={palette.white} />
            ) : null}
          </View>
        </View>
      </View>

      {/* Metrics Row: Travel Time & Distance */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <MaterialIcons name="schedule" size={16} color={palette.primary} />
          <Text style={styles.durationValue}>{route.durationText}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <MaterialIcons name="straighten" size={16} color={palette.textMuted} />
          <Text style={styles.distanceValue}>{route.distanceText}</Text>
        </View>

        {/* Risk Badge */}
        <View style={[styles.riskBadge, { backgroundColor: riskInfo.badgeBg }]}>
          <MaterialIcons name={riskInfo.iconName} size={13} color={riskInfo.textColor} />
          <Text style={[styles.riskBadgeText, { color: riskInfo.textColor }]}>
            {riskInfo.label}
          </Text>
        </View>
      </View>

      {/* Risk Context Explanation */}
      <View style={styles.explanationRow}>
        <Text style={styles.explanationText}>
          {riskInfo.explanation}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: palette.primary,
    borderWidth: 2,
    backgroundColor: '#FAFDFB',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.88,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.xs,
  },
  routeIcon: {
    marginTop: 1,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    flexShrink: 1,
  },
  summaryLabelSelected: {
    color: palette.primary,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E4F1EC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F4B4A',
  },
  selectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  selectionIndicatorActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
    marginBottom: 6,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: palette.border,
  },
  distanceValue: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '600',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  explanationRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E6ECE9',
    paddingTop: 6,
    marginTop: 2,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.textMuted,
  },
});
