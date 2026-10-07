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
import { RouteComparisonIntroModal } from './components/RouteComparisonIntroModal';
import { useRouteRecommendation } from './hooks/useRouteRecommendation';
import { useRouteComparisonIntro } from './hooks/useRouteComparisonIntro';
import { RouteOrigin } from './types';

import { validateRouteForJourney } from './utils/route-validation';

interface RoutePlanningEntryProps {
  userLocation?: { latitude: number; longitude: number } | null;
  onDestinationSelected?: (destination: { latitude: number; longitude: number }) => void;
  onOriginSelected?: (origin: { latitude: number; longitude: number }) => void;
}

export function RoutePlanningEntry({
  userLocation,
  onDestinationSelected,
  onOriginSelected,
}: RoutePlanningEntryProps) {
  const {
    selectedDestination,
    setSelectedDestination,
    origin,
    setOrigin,
    isSearching,
    setIsSearching,
    isPlanning,
    setIsPlanning,
    submittedSearchQuery,
    searchMapResults,
    submitSearchMapResults,
    clearSearchMapResults,
    clearRoutePlanning,
  } = useRouteContext();

  const [destinationModalVisible, setDestinationModalVisible] = useState(false);
  const [originModalVisible, setOriginModalVisible] = useState(false);

  useEffect(() => {
    if (userLocation && !origin?.isManual) {
      setOrigin({
        name: 'Current Location',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        isManual: false,
      });
    }
  }, [setOrigin, userLocation, origin?.isManual]);

  const handleOpenDestinationSearch = () => {
    setIsSearching(true);
    setDestinationModalVisible(true);
  };

  const handleCloseDestinationSearch = () => {
    setIsSearching(false);
    setDestinationModalVisible(false);
  };

  const handleOpenOriginSearch = () => {
    setOriginModalVisible(true);
  };

  const handleCloseOriginSearch = () => {
    setOriginModalVisible(false);
  };

  const handleSelectDestination = (dest: any) => {
    clearSearchMapResults();
    setSelectedDestination(dest);
    setIsSearching(false);
    setDestinationModalVisible(false);
    onDestinationSelected?.({ latitude: dest.latitude, longitude: dest.longitude });
  };

  const handleSelectOrigin = (selectedOrigin: RouteOrigin) => {
    setOrigin(selectedOrigin);
    setOriginModalVisible(false);
    onOriginSelected?.({ latitude: selectedOrigin.latitude, longitude: selectedOrigin.longitude });
  };

  const handleSubmitResults = (query: string, results: Parameters<typeof submitSearchMapResults>[1]) => {
    submitSearchMapResults(query, results);
    setIsSearching(false);
    setDestinationModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {selectedDestination ? (
        <SelectedDestinationCard
          destination={selectedDestination}
          origin={origin}
          onChangeDestination={handleOpenDestinationSearch}
          onChangeOrigin={handleOpenOriginSearch}
          onClearDestination={clearRoutePlanning}
          onPlanRoute={() => setIsPlanning(true)}
        />
      ) : searchMapResults.length > 0 && submittedSearchQuery ? (
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Edit destination search"
          onPress={handleOpenDestinationSearch}
          style={({ pressed }) => [styles.activeSearchChip, pressed && styles.pressed]}>
          <MaterialIcons name="search" size={18} color={palette.primary} />
          <Text numberOfLines={1} style={styles.activeSearchText}>
            {submittedSearchQuery}
          </Text>
          <MaterialIcons name="edit" size={18} color={palette.textMuted} />
        </Pressable>
      ) : (
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Where are you going? Tap to search destination or address."
          onPress={handleOpenDestinationSearch}
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
        <RouteResultsPlaceholder onOpenOriginSearch={handleOpenOriginSearch} />
      ) : null}

      {/* Destination Search Modal */}
      <DestinationSearchModal
        visible={destinationModalVisible || isSearching}
        mode="destination"
        onClose={handleCloseDestinationSearch}
        onSelectDestination={handleSelectDestination}
        onSubmitResults={handleSubmitResults}
        userLocation={userLocation}
      />

      {/* Origin Selection Modal */}
      <DestinationSearchModal
        visible={originModalVisible}
        mode="origin"
        title="Select Starting Location"
        placeholder="Search starting location or address..."
        onClose={handleCloseOriginSearch}
        onSelectOrigin={handleSelectOrigin}
        onSubmitResults={() => {}}
        userLocation={userLocation}
      />
    </View>
  );
}

interface RouteResultsPlaceholderProps {
  onOpenOriginSearch?: () => void;
}

export function RouteResultsPlaceholder({ onOpenOriginSearch }: RouteResultsPlaceholderProps) {
  const { selectedDestination, origin } = useRouteContext();
  const { recommendation, loading, error, requestRecommendation } = useRouteRecommendation();
  const { introVisible, completeIntro, skipIntro, showIntro } = useRouteComparisonIntro();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  const activeRouteId = selectedRouteId ?? recommendation?.recommendedRouteId ?? null;

  useEffect(() => {
    if (selectedDestination && origin) {
      void requestRecommendation(
        { lat: origin.latitude, lng: origin.longitude },
        { lat: selectedDestination.latitude, lng: selectedDestination.longitude },
      );
    }
  }, [origin, requestRecommendation, selectedDestination]);

  const handleStartJourney = () => {
    setValidationError(null);

    const route = recommendation?.routes.find((r) => r.routeId === activeRouteId);
    const validation = validateRouteForJourney({
      route,
      origin,
      destination: selectedDestination,
    });

    if (!validation.isValid || !validation.handoffParams) {
      setValidationError(
        validation.errors.length > 0
          ? validation.errors.join('. ')
          : 'Selected route has incomplete or invalid route information.',
      );
      return;
    }

    router.push({
      pathname: '/journey/intro',
      params: validation.handoffParams,
    });
  };

  if (!selectedDestination) {
    return null;
  }

  const isManualOrigin = Boolean(origin?.isManual);

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="Route planning options"
      style={styles.resultsCard}>
      <View style={styles.resultsHeader}>
        <View style={styles.resultsHeaderLeft}>
          <View style={styles.statusIndicator} />
          <Text style={styles.sectionTitle}>Route Safety Analysis</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Learn about route comparison"
          hitSlop={8}
          onPress={showIntro}
          style={({ pressed }) => [styles.guideButton, pressed && styles.pressed]}>
          <MaterialIcons name="help-outline" size={18} color={palette.primary} />
          <Text style={styles.guideButtonText}>Guide</Text>
        </Pressable>
      </View>

      <Text style={styles.bodyText}>
        {loading ? 'Comparing route options to ' : 'Route options to '}
        <Text style={styles.destinationHighlight}>{selectedDestination.name}</Text>.
      </Text>

      {/* Origin and Destination Handoff Box with Change Origin action */}
      <View style={styles.routeHandoffBox}>
        <View style={styles.routePointRow}>
          <MaterialIcons name="trip-origin" size={16} color={palette.primary} />
          <View style={styles.routePointDetails}>
            <Text style={styles.routePointText} numberOfLines={1}>
              Origin: {origin ? origin.name : 'Not set'}
              {isManualOrigin ? ' (Manual)' : ''}
            </Text>
            {origin?.address && origin.name !== origin.address ? (
              <Text style={styles.routePointSubtext} numberOfLines={1}>
                {origin.address}
              </Text>
            ) : origin ? (
              <Text style={styles.routePointSubtext}>
                {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
              </Text>
            ) : null}
          </View>
          {onOpenOriginSearch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change starting location"
              hitSlop={8}
              onPress={onOpenOriginSearch}
              style={({ pressed }) => [styles.changeOriginSmallButton, pressed && styles.pressed]}>
              <Text style={styles.changeOriginSmallButtonText}>Change</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routePointRow}>
          <MaterialIcons name="place" size={16} color={palette.accent} />
          <View style={styles.routePointDetails}>
            <Text style={styles.routePointText} numberOfLines={1}>
              Destination: {selectedDestination.name}
            </Text>
            <Text style={styles.routePointSubtext} numberOfLines={1}>
              {selectedDestination.address} ({selectedDestination.latitude.toFixed(4)},{' '}
              {selectedDestination.longitude.toFixed(4)})
            </Text>
          </View>
        </View>
      </View>

      {validationError && (
        <View style={styles.validationErrorBox}>
          <MaterialIcons name="error-outline" size={16} color={palette.accent} />
          <Text style={styles.validationErrorText}>{validationError}</Text>
        </View>
      )}

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
      ) : !origin ? (
        <View style={styles.missingOriginContainer}>
          <MaterialIcons name="location-off" size={28} color={palette.accent} />
          <Text style={styles.missingOriginTitle}>Starting location required</Text>
          <Text style={styles.missingOriginNote}>
            Allow device location access or select a starting location manually to compare routes.
          </Text>
          {onOpenOriginSearch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select starting location manually"
              onPress={onOpenOriginSearch}
              style={({ pressed }) => [styles.selectOriginActionButton, pressed && styles.pressed]}>
              <MaterialIcons name="add-location" size={16} color={palette.white} />
              <Text style={styles.selectOriginActionText}>Select Starting Location</Text>
            </Pressable>
          ) : null}
        </View>
      ) : recommendation ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.resultsList}>
          <RecommendationBanner recommendation={recommendation} />
          {recommendation.routes.map((route) => (
            <RouteCard
              key={route.routeId}
              route={route}
              isRecommended={route.routeId === recommendation.recommendedRouteId}
              selected={route.routeId === activeRouteId}
              onPress={() => {
                setSelectedRouteId(route.routeId);
                setValidationError(null);
              }}
            />
          ))}

          {activeRouteId && (
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
            <MaterialIcons
              name="info-outline"
              size={15}
              color={palette.primary}
              style={styles.evidenceIcon}
            />
            <Text style={styles.evidenceNote}>
              Reported risk is based on available community safety data and may change. Lower reported risk or absence of reports does not guarantee safety—use this to help make your own travel decision.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      <RouteComparisonIntroModal
        visible={introVisible}
        onComplete={completeIntro}
        onSkip={skipIntro}
      />
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
  activeSearchChip: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  activeSearchText: { flexShrink: 1, color: palette.text, fontSize: 14, fontWeight: '800' },
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
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  resultsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  guideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F3F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  guideButtonText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
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
  routePointDetails: {
    flex: 1,
    gap: 1,
  },
  routePointText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  routePointSubtext: {
    color: palette.textMuted,
    fontSize: 11,
  },
  changeOriginSmallButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E8F3F1',
    borderRadius: radius.sm,
  },
  changeOriginSmallButtonText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  routeConnector: {
    width: 2,
    height: 8,
    backgroundColor: palette.border,
    marginLeft: 7,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: '#E8F3F1',
    borderRadius: radius.sm,
  },
  evidenceIcon: {
    marginTop: 1,
  },
  evidenceNote: {
    flex: 1,
    color: palette.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
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
  missingOriginContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  missingOriginTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  missingOriginNote: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  selectOriginActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  selectOriginActionText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  resultsList: {
    maxHeight: 340,
  },
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
  validationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    backgroundColor: '#FDF0ED',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#F5C2B8',
    marginTop: spacing.xs,
  },
  validationErrorText: {
    flex: 1,
    color: palette.accent,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
