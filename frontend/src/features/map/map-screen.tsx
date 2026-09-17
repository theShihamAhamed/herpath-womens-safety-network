import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

import { AreaSummarySheet } from './area-summary-sheet';
import { FilterBar } from './filter-bar';
import { IncidentArea } from './incident-area';
import { IncidentMarker } from './incident-marker';
import { mapApi } from './map-api';
import type { AreaSummary, MapFilter, PublicIncidentMarker, ViewportBounds } from './map.types';
import { ReportContextSheet } from './report-context-sheet';
import { SupportPlaceSearchFeedback } from './support-place-search-feedback';
import { getSupportPlaceDistanceMetres } from './support-place-distance';
import { SupportPlaceMarker } from './support-place-marker';
import { DestinationMarker, useRouteContext } from '@/src/features/routing';
import { FALLBACK_LOCATION, type UseUserLocationResult } from './use-user-location';
import { useSupportPlaceSearch } from './use-support-place-search';

interface MapScreenProps {
  controlsTopOffset?: number;
  locationState: UseUserLocationResult;
}

export function MapScreen({ controlsTopOffset = 8, locationState }: MapScreenProps) {
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const useCompactFloatingControls = fontScale >= 1.35;
  const { location, permissionStatus, error: locationError, isLoading: isLocationLoading, requestLocation } = locationState;
  const [incidents, setIncidents] = useState<PublicIncidentMarker[]>([]);
  const [filter, setFilter] = useState<MapFilter>({ category: 'ALL', severity: 'ALL', dateRange: 'all', timeOfDay: 'all' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapDataUnavailable, setIsMapDataUnavailable] = useState(false);
  const [selectedAreaSummary, setSelectedAreaSummary] = useState<AreaSummary | null>(null);
  const [areaSummaryLocation, setAreaSummaryLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isAreaSummaryUnavailable, setIsAreaSummaryUnavailable] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [isReportSheetExpanded, setIsReportSheetExpanded] = useState(false);
  const [selectedSupportPlaceId, setSelectedSupportPlaceId] = useState<string | null>(null);
  const lastViewportRef = useRef<ViewportBounds | null>(null);
  const mapRef = useRef<MapView>(null);
  const supportPlaceSearch = useSupportPlaceSearch({
    location,
    hasUsableLocation:
      permissionStatus === Location.PermissionStatus.GRANTED && locationError === null,
  });

  let selectedDestination = null;
  try {
    const routeContext = useRouteContext();
    selectedDestination = routeContext.selectedDestination;
  } catch {
    // Graceful fallback if rendered without RouteProvider
  }

  React.useEffect(() => {
    if (selectedDestination && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedDestination.latitude,
          longitude: selectedDestination.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        400,
      );
    }
  }, [selectedDestination]);

  React.useEffect(() => {
    setSelectedSupportPlaceId((current) =>
      current && !supportPlaceSearch.supportPlaces.some((place) => place.id === current)
        ? null
        : current,
    );
  }, [supportPlaceSearch.supportPlaces]);

  const initialRegion = {
    latitude: location?.latitude ?? FALLBACK_LOCATION.latitude,
    longitude: location?.longitude ?? FALLBACK_LOCATION.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const loadIncidents = useCallback(async (bounds: ViewportBounds, activeFilter: MapFilter) => {
    setIsRefreshing(true);
    try {
      const liveIncidents = await mapApi.getIncidents(bounds, activeFilter);
      setIncidents(liveIncidents);
      setIsMapDataUnavailable(false);
    } catch {
      setIsMapDataUnavailable(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const bounds = lastViewportRef.current;
      if (bounds) void loadIncidents(bounds, filter);
    }, [filter, loadIncidents]),
  );

  const handleRegionChangeComplete = (region: {
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
    lastViewportRef.current = bounds;
    void loadIncidents(bounds, filter);
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

  const showAreaSummary = async (latitude: number, longitude: number) => {
    setAreaSummaryLocation({ latitude, longitude });
    try {
      const summary = await mapApi.getAreaSummary(latitude, longitude);
      setSelectedAreaSummary(summary);
      setIsAreaSummaryUnavailable(false);
      setIsSummaryVisible(true);
    } catch {
      setSelectedAreaSummary(null);
      setIsAreaSummaryUnavailable(true);
      setIsSummaryVisible(true);
    }
  };

  const retryAreaSummary = () => {
    if (!areaSummaryLocation) return;
    void showAreaSummary(areaSummaryLocation.latitude, areaSummaryLocation.longitude);
  };

  const handleLongPress = (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    void showAreaSummary(latitude, longitude);
  };

  const handleUseCurrentLocation = async () => {
    const currentLocation = await requestLocation();
    if (!currentLocation) return;
    mapRef.current?.animateToRegion({ ...currentLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 300);
  };

  const handleNearbySupport = async () => {
    const currentLocation = await requestLocation();
    await supportPlaceSearch.searchSupportPlaces(currentLocation);
  };

  const handleCurrentAreaSummary = () => {
    const bounds = lastViewportRef.current;
    if (!bounds) return;
    void showAreaSummary((bounds.swLat + bounds.neLat) / 2, (bounds.swLng + bounds.neLng) / 2);
  };

  const handleFocusIncident = (incident: PublicIncidentMarker) => {
    const [longitude, latitude] = incident.publicLocation.coordinates;
    mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
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
      <FilterBar
        compactTrigger={useCompactFloatingControls}
        filter={filter}
        onChangeFilter={setFilter}
        topOffset={controlsTopOffset}
      />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={permissionStatus === Location.PermissionStatus.GRANTED}
        onRegionChangeComplete={handleRegionChangeComplete}
        onLongPress={handleLongPress}
      >
        {filteredIncidents.map((incident) => (
          <IncidentArea key={`area-${incident.id}`} incident={incident} />
        ))}
        {filteredIncidents.map((incident) => (
          <IncidentMarker key={`marker-${incident.id}`} incident={incident} />
        ))}
        {supportPlaceSearch.supportPlaces.map((place) => (
          <SupportPlaceMarker
            key={`support-place-${place.id}`}
            place={place}
            distanceMetres={
              supportPlaceSearch.searchOrigin
                ? getSupportPlaceDistanceMetres(supportPlaceSearch.searchOrigin, place.location)
                : null
            }
            selected={place.id === selectedSupportPlaceId}
            onSelect={() => setSelectedSupportPlaceId(place.id)}
          />
        ))}
        {selectedDestination ? (
          <DestinationMarker destination={selectedDestination} />
        ) : null}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[
          styles.actionControls,
          { bottom: isReportSheetExpanded ? Math.round(windowHeight * 0.58) + 16 : 128 },
        ]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Use my current location" onPress={() => void handleUseCurrentLocation()} style={styles.mapAction}>
          <MaterialIcons name="my-location" size={22} color="#176B5B" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Show area safety context" onPress={handleCurrentAreaSummary} style={styles.mapAction}>
          <MaterialIcons name="analytics" size={22} color="#176B5B" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            supportPlaceSearch.status === 'loading'
              ? 'Finding nearby support places'
              : 'Find nearby support places'
          }
          accessibilityState={{
            disabled: supportPlaceSearch.status === 'loading',
            busy: supportPlaceSearch.status === 'loading',
            selected: supportPlaceSearch.status === 'success',
          }}
          disabled={supportPlaceSearch.status === 'loading'}
          onPress={() => void handleNearbySupport()}
          style={({ pressed }) => [
            styles.mapAction,
            supportPlaceSearch.status === 'success' && styles.mapActionActive,
            pressed && supportPlaceSearch.status !== 'loading' && styles.mapActionPressed,
          ]}>
          {supportPlaceSearch.status === 'loading' ? (
            <ActivityIndicator size="small" color="#176B5B" />
          ) : (
            <MaterialIcons name="support-agent" size={22} color={supportPlaceSearch.status === 'success' ? '#FFFFFF' : '#176B5B'} />
          )}
        </Pressable>
      </View>

      {isRefreshing ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Refreshing incident reports" style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color="#176B5B" />
          <Text style={styles.refreshText}>Refreshing reports</Text>
        </View>
      ) : null}

      <SupportPlaceSearchFeedback
        status={supportPlaceSearch.status}
        resultCount={supportPlaceSearch.supportPlaces.length}
        errorMessage={supportPlaceSearch.errorMessage}
        onRetry={() => void supportPlaceSearch.retrySupportPlaces()}
        onDismiss={supportPlaceSearch.dismissSupportPlaces}
      />

      {isMapDataUnavailable ? (
        <View accessible accessibilityRole="summary" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Safety information is unavailable</Text>
          <Text style={styles.emptyText}>Check your connection and try moving the map again. Safety information may be limited while the service is unavailable.</Text>
        </View>
      ) : null}

      <ReportContextSheet
        incidents={filteredIncidents}
        onSelectIncident={handleFocusIncident}
        onExpandedChange={setIsReportSheetExpanded}
      />

      <AreaSummarySheet
        visible={isSummaryVisible}
        summary={selectedAreaSummary}
        unavailable={isAreaSummaryUnavailable}
        onClose={() => setIsSummaryVisible(false)}
        onRetry={retryAreaSummary}
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
  actionControls: {
    position: 'absolute',
    right: 16,
    gap: 8,
  },
  mapAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7DEDC',
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#18201E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  mapActionPressed: { opacity: 0.72 },
  mapActionActive: { borderColor: '#176B5B', backgroundColor: '#176B5B' },
  refreshIndicator: {
    position: 'absolute',
    top: 204,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  refreshText: { color: '#176B5B', fontSize: 13, fontWeight: '700' },
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
    bottom: 128,
    gap: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { color: '#18201E', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#5F6C68', fontSize: 13, lineHeight: 18 },
});
