import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

import { validateLatLng } from '../utils/route-validation';

interface RouteComparisonScreenProps {
  // Normally comes from the map feature (selected pins) or device location
  origin: LatLng;
  destination: LatLng;
}

export function RouteComparisonScreen({
  origin,
  destination,
}: RouteComparisonScreenProps) {
  const { recommendation, loading, error, requestRecommendation } =
    useRouteRecommendation();
  const { introVisible, completeIntro, skipIntro, showIntro } =
    useRouteComparisonIntro();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);

  const activeRouteId = selectedRouteId ?? recommendation?.recommendedRouteId ?? null;

  const originValidation = validateLatLng(origin);
  const destValidation = validateLatLng(destination);
  const areCoordinatesValid = originValidation.isValid && destValidation.isValid;

  const handleCompareRoutes = async () => {
    if (!areCoordinatesValid) return;
    setHasRequested(true);
    await requestRecommendation(origin, destination);
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

          {!loading && recommendation && recommendation.routes.length > 0 && (
            <FlatList
              data={recommendation.routes}
              keyExtractor={(item) => item.routeId}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <RecommendationBanner recommendation={recommendation} />
              }
              ListFooterComponent={
                <View style={styles.footerNoteBox}>
                  <MaterialIcons name="shield" size={16} color="#1F4B4A" style={styles.footerNoteIcon} />
                  <Text style={styles.footerNoteText}>
                    Risk estimates reflect reported incidents and available community data. Having no recent reports or lower reported risk does not guarantee complete safety.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <RouteCard
                  route={item}
                  isRecommended={item.routeId === recommendation.recommendedRouteId}
                  selected={item.routeId === activeRouteId}
                  onPress={() => setSelectedRouteId(item.routeId)}
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
  footerNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF6F4',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
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
