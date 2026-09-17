import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import type { DestinationSuggestion } from './types';

interface DestinationResultsSheetProps {
  query: string;
  results: DestinationSuggestion[];
  selectedResult: DestinationSuggestion | null;
  onSelectResult: (result: DestinationSuggestion) => void;
  onSetDestination: (result: DestinationSuggestion) => void;
  onClear: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/** Temporary Map-owned presentation for submitted destination search results. */
export function DestinationResultsSheet({
  query,
  results,
  selectedResult,
  onSelectResult,
  onSetDestination,
  onClear,
  onExpandedChange,
}: DestinationResultsSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => {
    setExpanded((current) => {
      onExpandedChange?.(!current);
      return !current;
    });
  };

  return (
    <View style={[styles.sheet, expanded && styles.sheetExpanded]}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} search results`}
          accessibilityState={{ expanded }}
          onPress={toggleExpanded}
          style={styles.headerButton}>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.query}>{query}</Text>
            <Text style={styles.count}>{results.length} {results.length === 1 ? 'result' : 'results'}</Text>
          </View>
          <MaterialIcons name={expanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} size={24} color={palette.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear destination search results"
          hitSlop={8}
          onPress={onClear}
          style={styles.clearButton}>
          <MaterialIcons name="close" size={21} color={palette.textMuted} />
        </Pressable>
      </View>

      {expanded ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {selectedResult ? (
            <View accessible accessibilityRole="summary" style={styles.detailCard}>
              <Text style={styles.detailTitle}>{selectedResult.name}</Text>
              <Text style={styles.address}>{selectedResult.address}</Text>
              {selectedResult.category ? <Text style={styles.category}>{formatCategory(selectedResult.category)}</Text> : null}
              {formatDistance(selectedResult.distanceMeters) ? <Text style={styles.distance}>{formatDistance(selectedResult.distanceMeters)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Set ${selectedResult.name} as destination`}
                onPress={() => onSetDestination(selectedResult)}
                style={styles.destinationButton}>
                <Text style={styles.destinationButtonText}>Set as destination</Text>
              </Pressable>
            </View>
          ) : null}
          {results.map((result) => {
            const selected = result.id === selectedResult?.id;
            return (
              <Pressable
                key={result.id}
                accessibilityRole="button"
                accessibilityLabel={`${result.name}, search result`}
                accessibilityState={{ selected }}
                onPress={() => onSelectResult(result)}
                style={[styles.resultCard, selected && styles.resultCardSelected]}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  <Text style={styles.address}>{result.address}</Text>
                  {result.category ? <Text style={styles.category}>{formatCategory(result.category)}</Text> : null}
                  {formatDistance(result.distanceMeters) ? <Text style={styles.distance}>{formatDistance(result.distanceMeters)}</Text> : null}
                </View>
                <MaterialIcons name="chevron-right" size={22} color={palette.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function formatDistance(distanceMeters?: number) {
  if (distanceMeters === undefined) return null;
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)} m away` : `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function formatCategory(category: string) {
  return category.split(/[._]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' · ');
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    maxHeight: '58%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  sheetExpanded: { height: '58%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerButton: { minHeight: 64, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerCopy: { flex: 1, gap: 2 },
  query: { color: palette.text, fontSize: 16, fontWeight: '800' },
  count: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.sm },
  detailCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surfaceMuted },
  detailTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  resultCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.background },
  resultCardSelected: { borderColor: palette.primary, backgroundColor: palette.surfaceMuted },
  resultCopy: { flex: 1, gap: 2 },
  resultName: { color: palette.text, fontSize: 15, fontWeight: '800' },
  address: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  category: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  distance: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  destinationButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: palette.primary },
  destinationButtonText: { color: palette.white, fontSize: 13, fontWeight: '800' },
});
