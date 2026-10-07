import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { AreaSummary } from './map.types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG, SEVERITY_LEVELS } from './map.types';

interface AreaSummarySheetProps {
  visible: boolean;
  summary: AreaSummary | null;
  unavailable: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function AreaSummarySheet({ visible, summary, unavailable, onClose, onRetry }: AreaSummarySheetProps) {
  const { fontScale } = useWindowDimensions();
  const useStackedStats = fontScale >= 1.35;
  if (!summary && !unavailable) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false} style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Area Safety Context</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close area safety context"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {unavailable ? (
            <View accessible accessibilityRole="alert" style={styles.unavailableState}>
              <Text style={styles.unavailableText}>Safety information is temporarily unavailable.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry area safety context"
                onPress={onRetry}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : summary ? (
            <>
              <Text style={styles.disclaimerText}>{summary.dataDisclaimer}</Text>

              <View style={[styles.statsContainer, useStackedStats && styles.statsContainerStacked]}>
                <View style={[styles.statBox, useStackedStats && styles.statBoxStacked]}>
                  <Text style={styles.statNumber}>{summary.totalIncidents}</Text>
                  <Text style={styles.statLabel}>Total Reports</Text>
                </View>
                <View style={[styles.statBox, useStackedStats && styles.statBoxStacked]}>
                  <Text style={styles.statNumber}>{summary.recentCount}</Text>
                  <Text style={styles.statLabel}>Recent (30 days)</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Incidents by Category</Text>
              {Object.entries(summary.byCategory).map(([cat, count]) => {
                const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                if (!config || count === 0) return null;
                return (
                  <View key={cat} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <View style={[styles.dot, { backgroundColor: config.color }]} />
                      <Text style={styles.categoryName}>{config.label}</Text>
                    </View>
                    <Text style={styles.categoryCount}>{count}</Text>
                  </View>
                );
              })}

              {summary.totalIncidents > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Severity</Text>
                  {SEVERITY_LEVELS.slice().reverse().map((severity) => {
                    const count = summary.bySeverity[severity];
                    const config = SEVERITY_CONFIG[severity];
                    if (count === 0) return null;

                    return (
                      <View
                        key={severity}
                        accessible
                        accessibilityLabel={`${config.label}: ${count} reports`}
                        style={styles.severityRow}>
                        <View style={styles.categoryInfo}>
                          <View style={[styles.dot, { backgroundColor: config.color }]} />
                          <Text style={styles.categoryName}>{config.label}</Text>
                        </View>
                        <Text style={styles.categoryCount}>{count}</Text>
                      </View>
                    );
                  })}
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  sheetContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#18201E',
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#5F6C68',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#5F6C68',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  unavailableState: {
    gap: 12,
    paddingVertical: 8,
  },
  unavailableText: {
    color: '#18201E',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#176B5B',
  },
  retryText: {
    color: '#176B5B',
    fontSize: 13,
    fontWeight: '800',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsContainerStacked: {
    flexDirection: 'column',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#EEF2F1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statBoxStacked: {
    width: '100%',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#176B5B',
  },
  statLabel: {
    fontSize: 12,
    color: '#5F6C68',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18201E',
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F1',
  },
  categoryInfo: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    flexShrink: 1,
    fontSize: 14,
    color: '#18201E',
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5F6C68',
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F1',
  },
});
