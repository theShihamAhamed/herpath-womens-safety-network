import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AreaSummary } from './map.types';
import { CATEGORY_CONFIG } from './map.types';

interface AreaSummarySheetProps {
  visible: boolean;
  summary: AreaSummary | null;
  onClose: () => void;
}

export function AreaSummarySheet({ visible, summary, onClose }: AreaSummarySheetProps) {
  if (!summary) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
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

          <Text style={styles.disclaimerText}>{summary.dataDisclaimer}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{summary.totalIncidents}</Text>
              <Text style={styles.statLabel}>Total Reports</Text>
            </View>
            <View style={styles.statBox}>
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
        </View>
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
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#EEF2F1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
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
    fontSize: 14,
    color: '#18201E',
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5F6C68',
  },
});
