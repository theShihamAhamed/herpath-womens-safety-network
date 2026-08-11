import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

export function RoutePlanningEntry() {
  return (
    <View
      accessible
      accessibilityLabel="Where are you going? Destination search is not yet available."
      style={styles.searchSurface}>
      <MaterialIcons name="search" size={24} color={palette.primary} />
      <View style={styles.searchCopy}>
        <Text style={styles.searchTitle}>Where are you going?</Text>
        <Text style={styles.searchHint}>Destination search will be available here.</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={palette.textMuted} />
    </View>
  );
}

export function RouteResultsPlaceholder() {
  return (
    <View style={styles.resultsCard}>
      <Text style={styles.sectionTitle}>Route options</Text>
      <Text style={styles.bodyText}>
        Route comparisons will appear here after you choose a destination.
      </Text>
      <Text style={styles.evidenceNote}>Based on available community data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSurface: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  searchCopy: { flex: 1, gap: spacing.xs },
  searchTitle: { color: palette.text, fontSize: 17, fontWeight: '700' },
  searchHint: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  resultsCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  bodyText: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  evidenceNote: { color: palette.primary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
