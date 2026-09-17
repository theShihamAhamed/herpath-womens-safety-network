import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';
import { clampReportSheetOffset, resolveReportSheetSnapOffset } from '@/src/features/map/report-sheet-motion';

import type { DestinationSuggestion } from './types';

const COLLAPSED_SHEET_HEIGHT = 82;
const LARGE_TEXT_COLLAPSED_SHEET_HEIGHT = 102;
const SHEET_HEIGHT_RATIO = 0.58;
const SETTLE_ANIMATION = { duration: 220, easing: Easing.out(Easing.cubic) };

interface DestinationResultsSheetProps {
  query: string;
  results: DestinationSuggestion[];
  selectedResult: DestinationSuggestion | null;
  expanded: boolean;
  onSelectResult: (result: DestinationSuggestion) => void;
  onSetDestination: (result: DestinationSuggestion) => void;
  onClear: () => void;
  onExpandedChange: (expanded: boolean) => void;
}

/** Temporary Map-owned presentation for submitted destination search results. */
export function DestinationResultsSheet({
  query,
  results,
  selectedResult,
  expanded,
  onSelectResult,
  onSetDestination,
  onClear,
  onExpandedChange,
}: DestinationResultsSheetProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const collapsedSheetHeight = fontScale >= 1.35 ? LARGE_TEXT_COLLAPSED_SHEET_HEIGHT : COLLAPSED_SHEET_HEIGHT;
  const sheetHeight = Math.round(windowHeight * SHEET_HEIGHT_RATIO);
  const collapsedOffset = Math.max(sheetHeight - collapsedSheetHeight, 0);
  const sheetOffset = useSharedValue(expanded ? 0 : collapsedOffset);
  const dragStartOffset = useSharedValue(expanded ? 0 : collapsedOffset);

  useEffect(() => {
    const offset = expanded ? 0 : collapsedOffset;
    sheetOffset.value = withTiming(offset, SETTLE_ANIMATION);
    dragStartOffset.value = offset;
  }, [collapsedOffset, dragStartOffset, expanded, sheetOffset]);

  const settleSheet = useCallback((nextExpanded: boolean) => {
    onExpandedChange(nextExpanded);
  }, [onExpandedChange]);
  const handleGestureEnd = useCallback((offset: number, velocityY: number) => {
    const snapOffset = resolveReportSheetSnapOffset(offset, velocityY, collapsedOffset);
    settleSheet(snapOffset === 0);
  }, [collapsedOffset, settleSheet]);
  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-32, 32])
      .onBegin(() => {
        dragStartOffset.value = sheetOffset.value;
      })
      .onUpdate((event) => {
        sheetOffset.value = clampReportSheetOffset(dragStartOffset.value + event.translationY, collapsedOffset);
      })
      .onEnd((event) => runOnJS(handleGestureEnd)(sheetOffset.value, event.velocityY)),
    [collapsedOffset, dragStartOffset, handleGestureEnd, sheetOffset],
  );
  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.value }] }));

  return (
    <Animated.View style={[styles.sheet, { height: sheetHeight }, animatedSheetStyle]}>
      <GestureDetector gesture={panGesture}>
        <View collapsable={false}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} search results`}
              accessibilityState={{ expanded }}
              accessibilityActions={[{ name: expanded ? 'collapse' : 'expand', label: expanded ? 'Collapse search results' : 'Expand search results' }]}
              onAccessibilityAction={(event) => settleSheet(event.nativeEvent.actionName === 'expand')}
              onPress={() => settleSheet(!expanded)}
              style={[styles.headerButton, { minHeight: collapsedSheetHeight - 10 }]}>
              <View style={styles.headerCopy}>
                <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.query}>{query}</Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.count}>{results.length} {results.length === 1 ? 'result' : 'results'}</Text>
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
        </View>
      </GestureDetector>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
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
    </Animated.View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerCopy: { flex: 1, gap: 2 },
  query: { color: palette.text, fontSize: 16, fontWeight: '800' },
  count: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  listContainer: { flex: 1 },
  list: { gap: spacing.sm, paddingBottom: spacing.sm, flexGrow: 1 },
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
