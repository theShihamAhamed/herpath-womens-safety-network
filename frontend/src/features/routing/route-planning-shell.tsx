import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { DestinationSearchModal } from './destination-search-modal';
import { useRouteContext } from './RouteContext';
import { SelectedDestinationCard } from './selected-destination-card';

interface RoutePlanningEntryProps {
  userLocation?: { latitude: number; longitude: number } | null;
  onDestinationSelected?: (destination: { latitude: number; longitude: number }) => void;
}

export function RoutePlanningEntry({
  userLocation,
  onDestinationSelected,
}: RoutePlanningEntryProps) {
  const {
    selectedDestination,
    setSelectedDestination,
    isSearching,
    setIsSearching,
    isPlanning,
    setIsPlanning,
    clearRoutePlanning,
  } = useRouteContext();

  const [modalVisible, setModalVisible] = useState(false);

  const handleOpenSearch = () => {
    setIsSearching(true);
    setModalVisible(true);
  };

  const handleCloseSearch = () => {
    setIsSearching(false);
    setModalVisible(false);
  };

  const handleSelectDestination = (dest: any) => {
    setSelectedDestination(dest);
    setIsSearching(false);
    setModalVisible(false);
    onDestinationSelected?.({ latitude: dest.latitude, longitude: dest.longitude });
  };

  return (
    <View style={styles.container}>
      {selectedDestination ? (
        <SelectedDestinationCard
          destination={selectedDestination}
          onChangeDestination={handleOpenSearch}
          onClearDestination={clearRoutePlanning}
          onPlanRoute={() => setIsPlanning(true)}
        />
      ) : (
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Where are you going? Tap to search destination or address."
          onPress={handleOpenSearch}
          style={({ pressed }) => [styles.searchSurface, pressed && styles.pressed]}>
          <View style={styles.searchIconCircle}>
            <MaterialIcons name="search" size={20} color={palette.primary} />
          </View>
          <View style={styles.searchCopy}>
            <Text style={styles.searchTitle}>Where are you going?</Text>
            <Text style={styles.searchHint}>Search destination, place, or address...</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color={palette.textMuted} />
        </Pressable>
      )}

      {selectedDestination && isPlanning ? (
        <RouteResultsPlaceholder />
      ) : null}

      <DestinationSearchModal
        visible={modalVisible || isSearching}
        onClose={handleCloseSearch}
        onSelectDestination={handleSelectDestination}
        userLocation={userLocation}
      />
    </View>
  );
}

export function RouteResultsPlaceholder() {
  const { selectedDestination } = useRouteContext();

  if (!selectedDestination) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="Route planning options"
      style={styles.resultsCard}>
      <View style={styles.resultsHeader}>
        <View style={styles.statusIndicator} />
        <Text style={styles.sectionTitle}>Route Safety Analysis</Text>
      </View>

      <Text style={styles.bodyText}>
        Preparing safe route alternatives to{' '}
        <Text style={styles.destinationHighlight}>{selectedDestination.name}</Text>.
      </Text>

      <View style={styles.routeHandoffBox}>
        <View style={styles.routePointRow}>
          <MaterialIcons name="my-location" size={16} color={palette.primary} />
          <Text style={styles.routePointText}>Origin: Current Location</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routePointRow}>
          <MaterialIcons name="place" size={16} color={palette.accent} />
          <Text style={styles.routePointText}>
            Destination: {selectedDestination.name} ({selectedDestination.latitude.toFixed(4)},{' '}
            {selectedDestination.longitude.toFixed(4)})
          </Text>
        </View>
      </View>

      <View style={styles.evidenceRow}>
        <MaterialIcons name="info-outline" size={16} color={palette.primary} />
        <Text style={styles.evidenceNote}>Based on available community data</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  searchSurface: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCopy: { flex: 1, gap: 2 },
  searchTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  searchHint: { color: palette.textMuted, fontSize: 13, lineHeight: 17 },
  pressed: { opacity: 0.8 },
  resultsCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  sectionTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  bodyText: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  destinationHighlight: { color: palette.text, fontWeight: '700' },
  routeHandoffBox: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
    marginTop: 2,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routePointText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  routeConnector: {
    width: 2,
    height: 8,
    backgroundColor: palette.border,
    marginLeft: 7,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  evidenceNote: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
