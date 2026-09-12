import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, radius, spacing } from '@/src/theme';

import { DestinationSearchModal } from './destination-search-modal';
import { useRouteContext } from './RouteContext';
import { SelectedDestinationCard } from './selected-destination-card';
import { RecommendationBanner } from './components/RecommendationBanner';
import { RouteCard } from './components/RouteCard';
import { useRouteRecommendation } from './hooks/useRouteRecommendation';

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
    setOrigin,
    isSearching,
    setIsSearching,
    isPlanning,
    setIsPlanning,
    clearRoutePlanning,
  } = useRouteContext();

  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (userLocation) {
      setOrigin({
        name: 'Current Location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    }
  }, [setOrigin, userLocation]);

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
  const { selectedDestination, origin } = useRouteContext();
  const { recommendation, loading, error, requestRecommendation } = useRouteRecommendation();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (selectedDestination && origin) {
      void requestRecommendation(
        { lat: origin.latitude, lng: origin.longitude },
        { lat: selectedDestination.latitude, lng: selectedDestination.longitude },
      );
    }
  }, [origin, requestRecommendation, selectedDestination]);

  const handleStartJourney = () => {
    const route = recommendation?.routes.find((r) => r.routeId === selectedRouteId);
    if (!route || !origin || !selectedDestination) return;

    router.push({
      pathname: '/journey/tracking',
      params: {
        routeId: route.routeId,
        origin: JSON.stringify({
          latitude: origin.latitude,
          longitude: origin.longitude,
          address: origin.name,
        }),
        destination: JSON.stringify({
          latitude: selectedDestination.latitude,
          longitude: selectedDestination.longitude,
          address: selectedDestination.name,
        }),
        polyline: route.polyline,
        distance: String(route.distanceMeters),
        duration: String(route.durationSeconds),
        riskScore: 'riskScore' in route ? String((route as { riskScore: number }).riskScore) : undefined,
      },
    });
  };

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
        {loading ? 'Comparing route options to ' : 'Route options to '}
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

      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.evidenceNote}>Checking recent community reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try route recommendation again"
            onPress={() => {
              if (origin) {
                void requestRecommendation(
                  { lat: origin.latitude, lng: origin.longitude },
                  { lat: selectedDestination.latitude, lng: selectedDestination.longitude },
                );
              }
            }}
            style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : recommendation ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.resultsList}>
          <RecommendationBanner recommendation={recommendation} />
          {recommendation.routes.map((route) => (
            <RouteCard
              key={route.routeId}
              route={route}
              isRecommended={route.routeId === recommendation.recommendedRouteId}
              selected={route.routeId === selectedRouteId}
              onPress={() => setSelectedRouteId(route.routeId)}
            />
          ))}

          {selectedRouteId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start journey on selected route"
              onPress={handleStartJourney}
              style={({ pressed }) => [styles.startJourneyButton, pressed && styles.pressed]}>
              <MaterialIcons name="navigation" size={18} color={palette.white} />
              <Text style={styles.startJourneyText}>Start Journey</Text>
            </Pressable>
          )}

          <View style={styles.evidenceRow}>
            <MaterialIcons name="info-outline" size={16} color={palette.primary} />
            <Text style={styles.evidenceNote}>
              Based on community-reported context, not a guarantee of safety.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.stateBlock}>
          <Text style={styles.evidenceNote}>Allow location access to compare routes.</Text>
        </View>
      )}
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
    maxHeight: 520,
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
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: palette.accent,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.primary,
  },
  retryText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  resultsList: {
    maxHeight: 340,
  },
  evidenceNote: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  startJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  startJourneyText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
});