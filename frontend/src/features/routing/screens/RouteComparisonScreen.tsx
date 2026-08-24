// frontend/src/features/routing/screens/RouteComparisonScreen.tsx
// Updated to use the backend's HS-87 recommendation + HS-88 risk scores
// instead of the earlier placeholder "lowest incident count" heuristic.
// Business logic lives here; the Expo Router page in frontend/app/journey/
// stays thin and just renders this component.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouteRecommendation } from '../hooks/useRouteRecommendation';
import { RouteCard } from '../components/RouteCard';
import { RecommendationBanner } from '../components/RecommendationBanner';
import { LatLng } from '../types/routing.types';

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
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);

  const handleCompareRoutes = async () => {
    setHasRequested(true);
    await requestRecommendation(origin, destination);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare routes</Text>
      <Text style={styles.subtitle}>
        See travel time, distance, and recent report activity for each option
        before you go.
      </Text>

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
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              isRecommended={item.routeId === recommendation.recommendedRouteId}
              selected={item.routeId === selectedRouteId}
              onPress={() => setSelectedRouteId(item.routeId)}
            />
          )}
        />
      )}
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
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
});
