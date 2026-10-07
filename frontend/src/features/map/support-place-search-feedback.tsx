import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { SupportPlaceSearchStatus } from './use-support-place-search';

interface SupportPlaceSearchFeedbackProps {
  status: SupportPlaceSearchStatus;
  resultCount: number;
  errorMessage: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Compact feedback for the current nearby-support search state. */
export function SupportPlaceSearchFeedback({
  status,
  resultCount,
  errorMessage,
  onRetry,
  onDismiss,
}: SupportPlaceSearchFeedbackProps) {
  const { fontScale } = useWindowDimensions();
  const useStackedUnavailableLayout = fontScale >= 1.35;
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Finding nearby support places" style={styles.card}>
        <ActivityIndicator size="small" color="#176B5B" />
        <Text maxFontSizeMultiplier={1.35} style={styles.copy}>Finding nearby support places…</Text>
      </View>
    );
  }

  if (status === 'location_unavailable') {
    return (
      <View accessible accessibilityRole="summary" style={styles.card}>
        <MaterialIcons name="location-off" size={19} color="#5F6C68" />
        <Text maxFontSizeMultiplier={1.35} style={styles.copy}>Your location is needed to find nearby support places.</Text>
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View accessible accessibilityRole="alert" style={styles.card}>
        <MaterialIcons name="cloud-off" size={19} color="#5F6C68" />
        <View style={[styles.unavailableCopy, useStackedUnavailableLayout && styles.unavailableCopyStacked]}>
          <Text maxFontSizeMultiplier={1.35} style={styles.copy}>{errorMessage ?? 'Nearby support places are temporarily unavailable.'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry nearby support place search" onPress={onRetry} style={styles.retryButton}>
            <Text maxFontSizeMultiplier={1.2} style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const message = status === 'empty'
    ? 'No nearby support places were found in this area.'
    : `${resultCount} nearby support ${resultCount === 1 ? 'place was' : 'places were'} found.`;

  return (
    <View accessible accessibilityRole="summary" style={styles.card}>
      <MaterialIcons name="support-agent" size={19} color="#176B5B" />
      <View style={styles.resultCopy}>
        <Text maxFontSizeMultiplier={1.35} style={styles.copy}>{message}</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.attribution}>© OpenStreetMap contributors</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss nearby support places"
        hitSlop={6}
        onPress={onDismiss}
        style={styles.dismissButton}>
        <MaterialIcons name="close" size={20} color="#5F6C68" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 204,
    width: '84%',
    maxWidth: 360,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  copy: { flexShrink: 1, color: '#18201E', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  resultCopy: { flex: 1, gap: 2 },
  attribution: { color: '#5F6C68', fontSize: 11 },
  unavailableCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unavailableCopyStacked: { alignItems: 'flex-start', flexDirection: 'column' },
  retryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#176B5B' },
  retryText: { color: '#176B5B', fontSize: 13, fontWeight: '800' },
  dismissButton: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});
