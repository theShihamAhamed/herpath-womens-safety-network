import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SupportPlaceSearchStatus } from './use-support-place-search';

interface SupportPlaceSearchFeedbackProps {
  status: SupportPlaceSearchStatus;
  resultCount: number;
  errorMessage: string | null;
  onRetry: () => void;
}

/** Compact search feedback only; support-place markers and details belong to later work. */
export function SupportPlaceSearchFeedback({
  status,
  resultCount,
  errorMessage,
  onRetry,
}: SupportPlaceSearchFeedbackProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Finding nearby support places" style={styles.card}>
        <ActivityIndicator size="small" color="#176B5B" />
        <Text style={styles.copy}>Finding nearby support places…</Text>
      </View>
    );
  }

  if (status === 'location_unavailable') {
    return (
      <View accessible accessibilityRole="summary" style={styles.card}>
        <MaterialIcons name="location-off" size={19} color="#5F6C68" />
        <Text style={styles.copy}>Your location is needed to find nearby support places.</Text>
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View accessible accessibilityRole="alert" style={styles.card}>
        <MaterialIcons name="cloud-off" size={19} color="#5F6C68" />
        <View style={styles.unavailableCopy}>
          <Text style={styles.copy}>{errorMessage ?? 'Nearby support places are temporarily unavailable.'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry nearby support place search" onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
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
        <Text style={styles.copy}>{message}</Text>
        <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 204,
    left: 16,
    right: 16,
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
  retryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#176B5B' },
  retryText: { color: '#176B5B', fontSize: 13, fontWeight: '800' },
});
