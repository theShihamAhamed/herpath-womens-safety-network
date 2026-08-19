import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import { AreaSummarySheet } from './area-summary-sheet';
import { FilterBar } from './filter-bar';
import { IncidentMarker } from './incident-marker';
import { mapApi } from './map-api';
import type { AreaSummary, MapFilter, PublicIncidentMarker, ViewportBounds } from './map.types';
import { FALLBACK_LOCATION, useUserLocation } from './use-user-location';

export function MapScreen() {
  const { location, isLoading: isLocationLoading } = useUserLocation();
  const [incidents, setIncidents] = useState<PublicIncidentMarker[]>([]);
  const [filter, setFilter] = useState<MapFilter>({ category: 'ALL', severity: 'ALL', dateRange: 'all', timeOfDay: 'all' });
  const [isMapDataUnavailable, setIsMapDataUnavailable] = useState(false);
  const [selectedAreaSummary, setSelectedAreaSummary] = useState<AreaSummary | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  const initialRegion = {
    latitude: location?.latitude ?? FALLBACK_LOCATION.latitude,
    longitude: location?.longitude ?? FALLBACK_LOCATION.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const handleRegionChangeComplete = async (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    const bounds: ViewportBounds = {
      swLat: region.latitude - region.latitudeDelta / 2,
      swLng: region.longitude - region.longitudeDelta / 2,
      neLat: region.latitude + region.latitudeDelta / 2,
      neLng: region.longitude + region.longitudeDelta / 2,
    };

    try {
      const liveIncidents = await mapApi.getIncidents(bounds, filter);
      setIncidents(liveIncidents);
      setIsMapDataUnavailable(false);
    } catch {
      setIsMapDataUnavailable(true);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filter.category !== 'ALL' && inc.category !== filter.category) return false;
    if (filter.severity !== 'ALL' && inc.severity !== filter.severity) return false;
    const ageMs = Date.now() - new Date(inc.occurredAt).getTime();
    const maxAge = filter.dateRange === '24h' ? 86_400_000 : filter.dateRange === '7d' ? 604_800_000 : filter.dateRange === '30d' ? 2_592_000_000 : Infinity;
    if (ageMs > maxAge) return false;
    const hour = new Date(inc.occurredAt).getHours();
    if (filter.timeOfDay === 'daytime' && (hour < 6 || hour > 17)) return false;
    if (filter.timeOfDay === 'nighttime' && hour >= 6 && hour <= 17) return false;
    return true;
  });

  const handleLongPress = async (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    try {
      const summary = await mapApi.getAreaSummary(latitude, longitude);
      setSelectedAreaSummary(summary);
      setIsSummaryVisible(true);
    } catch {
      // Fallback mock area summary
      setSelectedAreaSummary({
        center: { latitude, longitude },
        radiusMeters: 1000,
        totalIncidents: filteredIncidents.length,
        byCategory: Object.fromEntries(['HARASSMENT', 'THEFT', 'ASSAULT', 'STALKING', 'OTHER'].map((category) => [category, filteredIncidents.filter((incident) => incident.category === category).length])) as AreaSummary['byCategory'],
        bySeverity: Object.fromEntries(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => [severity, filteredIncidents.filter((incident) => incident.severity === severity).length])) as AreaSummary['bySeverity'],
        recentCount: filteredIncidents.filter((incident) => Date.now() - new Date(incident.occurredAt).getTime() <= 2_592_000_000).length,
        dataDisclaimer: 'Based on available community data',
      });
      setIsSummaryVisible(true);
    }
  };

  if (isLocationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B5B" />
        <Text style={styles.loadingText}>Locating safety map context...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FilterBar filter={filter} onChangeFilter={setFilter} />

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={handleRegionChangeComplete}
        onLongPress={handleLongPress}
      >
        {filteredIncidents.map((incident) => (
          <IncidentMarker key={incident.id} incident={incident} />
        ))}
      </MapView>

      {filteredIncidents.length === 0 ? (
        <View accessible accessibilityRole="summary" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{isMapDataUnavailable ? 'Safety information is unavailable' : 'No reports are visible in this area'}</Text>
          <Text style={styles.emptyText}>{isMapDataUnavailable ? 'Check your connection and try moving the map again. Safety information may be limited while the service is unavailable.' : 'This does not mean the area is safe. Adjust your filters or move the map to explore available community data.'}</Text>
        </View>
      ) : null}

      <AreaSummarySheet
        visible={isSummaryVisible}
        summary={selectedAreaSummary}
        onClose={() => setIsSummaryVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5F6C68',
  },
  emptyCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { color: '#18201E', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#5F6C68', fontSize: 13, lineHeight: 18 },
});
