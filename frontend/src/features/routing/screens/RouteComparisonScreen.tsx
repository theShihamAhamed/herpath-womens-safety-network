import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouteRecommendation } from '../hooks/useRouteRecommendation';
import { useRouteComparisonIntro } from '../hooks/useRouteComparisonIntro';
import { RouteCard } from '../components/RouteCard';
import { RecommendationBanner } from '../components/RecommendationBanner';
import { RouteComparisonIntroModal } from '../components/RouteComparisonIntroModal';
import { LatLng } from '../types/routing.types';

import { validateLatLng, validateRouteForJourney } from '../utils/route-validation';

interface RouteComparisonScreenProps {
  // Normally comes from the map feature (selected pins) or device location
  origin: LatLng;
  destination: LatLng;
}

export function RouteComparisonScreen({
  origin,
  destination,
}: RouteComparisonScreenProps) {
  const router = useRouter();
  const { recommendation, loading, error, requestRecommendation } =
    useRouteRecommendation();
  const { introVisible, completeIntro, skipIntro, showIntro } =
    useRouteComparisonIntro();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeRouteId = selectedRouteId ?? recommendation?.recommendedRouteId ?? null;

  const originValidation = validateLatLng(origin);
  const destValidation = validateLatLng(destination);
  const areCoordinatesValid = originValidation.isValid && destValidation.isValid;

  const handleCompareRoutes = async () => {
    if (!areCoordinatesValid) return;
    setValidationError(null);
    setHasRequested(true);
    await requestRecommendation(origin, destination);
  };

  const handleStartJourney = () => {
    setValidationError(null);

    const route = recommendation?.routes.find((r) => r.routeId === activeRouteId);
    const validation = validateRouteForJourney({
      route,
      origin: {
        latitude: origin.lat,
        longitude: origin.lng,
        name: 'Starting Point',
      },
      destination: {
        latitude: destination.lat,
        longitude: destination.lng,
        name: 'Destination',
      },
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Compare routes</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Learn about route comparison"
          hitSlop={8}
          onPress={showIntro}
          style={styles.infoButton}>
          <MaterialIcons name="help-outline" size={20} color="#1F4B4A" />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Compare travel time, distance, and community-reported risk across available options to make your own travel decision.
      </Text>

      {!areCoordinatesValid ? (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>
            Invalid starting point or destination coordinates. Please select valid locations to compare routes.
          </Text>
        </View>
      ) : (
        <>
          {!hasRequested && (
            <View style={styles.ctaWrapper}>
              <Text style={styles.ctaText} onPress={handleCompareRoutes}>
                Find routes
              </Text>
            </View>
          )}

          {loading && (
            <View style={styles.centeredState}>
              <ActivityIndicator size="small" color="#1F4B4A" />
              <Text style={styles.stateText}>Comparing route safety context…</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.centeredState}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText} onPress={handleCompareRoutes}>
                Try again
              </Text>
            </View>
          )}

          {!loading && !error && hasRequested && recommendation?.routes.length === 0 && (
            <View style={styles.centeredState}>
              <Text style={styles.stateText}>No routes found for this trip.</Text>
            </View>
          )}

          {validationError && (
            <View style={styles.validationErrorBox}>
              <MaterialIcons name="error-outline" size={16} color="#C1512E" />
              <Text style={styles.validationErrorText}>{validationError}</Text>
            </View>
          )}

          {!loading && recommendation && recommendation.routes.length > 0 && (
            <FlatList
              data={recommendation.routes}
              keyExtractor={(item) => item.routeId}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <RecommendationBanner recommendation={recommendation} />
              }
              ListFooterComponent={
                <View style={styles.footerContainer}>
                  {activeRouteId && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Start journey on selected route"
                      onPress={handleStartJourney}
                      style={({ pressed }) => [styles.startJourneyButton, pressed && styles.pressed]}>
                      <MaterialIcons name="navigation" size={18} color="#FFFFFF" />
                      <Text style={styles.startJourneyText}>Start Journey</Text>
                    </Pressable>
                  )}
                  <View style={styles.footerNoteBox}>
                    <MaterialIcons name="shield" size={16} color="#1F4B4A" style={styles.footerNoteIcon} />
                    <Text style={styles.footerNoteText}>
                      Risk estimates reflect reported incidents and available community data. Having no recent reports or lower reported risk does not guarantee complete safety.
                    </Text>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <RouteCard
                  route={item}
                  isRecommended={item.routeId === recommendation.recommendedRouteId}
                  selected={item.routeId === activeRouteId}
                  onPress={() => {
                    setSelectedRouteId(item.routeId);
                    setValidationError(null);
                  }}
                />
              )}
            />
          )}
        </>
      )}

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
    flex: 1,
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  ctaWrapper: {
    backgroundColor: '#1F4B4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 32,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  stateText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#C1512E',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F4B4A',
  },
  footerContainer: {
    marginTop: 8,
    gap: 8,
  },
  startJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F4B4A',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  startJourneyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  validationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: '#FDF0ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C2B8',
    marginBottom: 12,
  },
  validationErrorText: {
    flex: 1,
    color: '#C1512E',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF6F4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D2E6DF',
  },
  footerNoteIcon: {
    marginTop: 2,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#2F4F48',
  },
});
