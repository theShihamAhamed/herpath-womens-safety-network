import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { palette, radius, spacing } from '@/src/theme';

export interface RouteComparisonIntroModalProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function RouteComparisonIntroModal({
  visible,
  onComplete,
  onSkip,
}: RouteComparisonIntroModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel="Route comparison introduction"
          style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerIconCircle}>
              <MaterialIcons name="alt-route" size={24} color={palette.primary} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Route Comparison</Text>
              <Text style={styles.headerSubtitle}>How to evaluate your options</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close introduction"
              hitSlop={10}
              onPress={onSkip}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <MaterialIcons name="close" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Feature 1: Multiple route options */}
            <View style={styles.featureRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="directions" size={20} color={palette.primary} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>Multiple route options</Text>
                <Text style={styles.featureDescription}>
                  HerPath displays multiple route choices to your destination so you can compare options side by side.
                </Text>
              </View>
            </View>

            {/* Feature 2: Compare travel time, distance, and risk */}
            <View style={styles.featureRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="compare-arrows" size={20} color={palette.primary} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>Compare time, distance & risk</Text>
                <Text style={styles.featureDescription}>
                  See estimated travel time, distance, and reported safety context based on community incident reports.
                </Text>
              </View>
            </View>

            {/* Feature 3: Dynamic community data & decision making */}
            <View style={styles.featureRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="update" size={20} color={palette.primary} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>Dynamic safety data</Text>
                <Text style={styles.featureDescription}>
                  Risk information updates as new incidents are reported, helping you make your own informed travel decision.
                </Text>
              </View>
            </View>

            {/* Feature 4: Safety Disclaimer */}
            <View style={styles.disclaimerCard}>
              <View style={styles.disclaimerHeader}>
                <MaterialIcons name="info-outline" size={18} color={palette.accent} />
                <Text style={styles.disclaimerTitle}>Safety Context Notice</Text>
              </View>
              <Text style={styles.disclaimerText}>
                Risk is calculated from reported incidents and available safety data. A lower reported risk is{' '}
                <Text style={styles.disclaimerHighlight}>not a guarantee of safety</Text>. Always stay alert and choose the path where you feel most secure.
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <PrimaryButton label="Got it" onPress={onComplete} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip route comparison introduction"
              onPress={onSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
              <Text style={styles.skipButtonText}>Skip intro</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 32, 30, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 1,
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF6F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  featureDescription: {
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 18,
  },
  disclaimerCard: {
    backgroundColor: '#FDF4F3',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F6D2CD',
    padding: spacing.md,
    gap: spacing.xs,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.accent,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5C2D27',
  },
  disclaimerHighlight: {
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
