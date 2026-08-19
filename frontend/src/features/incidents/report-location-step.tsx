import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, type MapPressEvent, type Region } from 'react-native-maps';

import { PrimaryButton } from '@/src/components/primary-button';
import { ApiError } from '@/src/services/api/errors';
import { palette, radius, spacing } from '@/src/theme';

import { incidentApi } from './incident-api';
import type { GeoJsonPoint, SelectableLocationCell } from './incident.types';

const REPORT_SELECTION_REGION: Region = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

interface ExactLocationSelectorProps {
  location: GeoJsonPoint | null;
  source: 'CURRENT' | 'MANUAL' | null;
  onSelect(location: GeoJsonPoint, source: 'CURRENT' | 'MANUAL'): void;
  onChooseApproximate(): void;
}

export function ExactLocationSelector({
  location,
  source,
  onSelect,
  onChooseApproximate,
}: ExactLocationSelectorProps) {
  const [selectionMethod, setSelectionMethod] = useState<'CURRENT' | 'MANUAL' | null>(source);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  async function locateCurrentPosition(): Promise<void> {
    if (isLocating) return;
    setSelectionMethod('CURRENT');
    setIsLocating(true);
    setLocationError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationError(
          'Location access is off, so current location cannot be used. Choose a point manually or switch to an approximate area.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onSelect(
        {
          type: 'Point',
          coordinates: [position.coords.longitude, position.coords.latitude],
        },
        'CURRENT',
      );
    } catch {
      setLocationError(
        'Current location could not be obtained. Choose a point manually or try again.',
      );
    } finally {
      setIsLocating(false);
    }
  }

  function selectManualPoint(event: MapPressEvent): void {
    if (selectionMethod !== 'MANUAL') return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onSelect({ type: 'Point', coordinates: [longitude, latitude] }, 'MANUAL');
  }

  const markerCoordinate = location
    ? { latitude: location.coordinates[1], longitude: location.coordinates[0] }
    : null;

  return (
    <View style={styles.sectionGap}>
      <Text style={styles.bodyText}>
        Your selected point is stored privately. HerPath publishes only an approximate area.
      </Text>
      <PrimaryButton
        label={isLocating ? 'Finding current location…' : 'Use my current location'}
        loading={isLocating}
        onPress={() => void locateCurrentPosition()}
      />
      <PrimaryButton
        label="Choose exact point manually"
        variant="secondary"
        onPress={() => {
          setSelectionMethod('MANUAL');
          setLocationError(null);
        }}
      />

      {locationError ? (
        <View accessibilityLiveRegion="polite" style={styles.errorCard}>
          <Text style={styles.errorText}>{locationError}</Text>
          <PrimaryButton label="Choose an approximate area" variant="secondary" onPress={onChooseApproximate} />
        </View>
      ) : null}

      {selectionMethod === 'MANUAL' ? (
        <View style={styles.mapBlock}>
          <Text style={styles.helperText}>Tap the map to choose the exact incident point.</Text>
          <MapView
            accessibilityLabel="Manual exact incident location map"
            initialRegion={REPORT_SELECTION_REGION}
            onPress={selectManualPoint}
            style={styles.map}>
            {markerCoordinate ? <Marker coordinate={markerCoordinate} /> : null}
          </MapView>
        </View>
      ) : null}

      {location ? (
        <View accessibilityLiveRegion="polite" style={styles.selectionCard}>
          <MaterialIcons name="check-circle" size={22} color={palette.primary} />
          <Text style={styles.selectionText}>
            {source === 'CURRENT' ? 'Current location selected privately.' : 'Manual exact point selected privately.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface ApproximateLocationSelectorProps {
  accessToken: string;
  selectedCellId: string | null;
  onSelectCell(cellId: string | null): void;
}

export function ApproximateLocationSelector({
  accessToken,
  selectedCellId,
  onSelectCell,
}: ApproximateLocationSelectorProps) {
  const [region, setRegion] = useState<Region>(REPORT_SELECTION_REGION);
  const [cells, setCells] = useState<SelectableLocationCell[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadVisibleAreas(): Promise<void> {
    if (isLoading) return;
    if (region.latitudeDelta > 0.1 || region.longitudeDelta > 0.1) {
      setErrorMessage('Zoom in to choose an approximate area.');
      return;
    }

    const viewport = {
      north: region.latitude + region.latitudeDelta / 2,
      south: region.latitude - region.latitudeDelta / 2,
      east: region.longitude + region.longitudeDelta / 2,
      west: region.longitude - region.longitudeDelta / 2,
    };
    if (viewport.west < -180 || viewport.east > 180) {
      setErrorMessage('Move away from the map edge to choose an approximate area.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const visibleCells = await incidentApi.locationCells(accessToken, viewport);
      setCells(visibleCells);
      if (!visibleCells.some((cell) => cell.cellId === selectedCellId)) onSelectCell(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.code === 'LOCATION_VIEWPORT_TOO_LARGE'
          ? 'Zoom in to choose an approximate area.'
          : 'Approximate areas could not be loaded. Check your connection and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function cellCoordinates(cell: SelectableLocationCell) {
    return cell.publicArea.coordinates[0]?.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })) ?? [];
  }

  return (
    <View style={styles.sectionGap}>
      <Text style={styles.bodyText}>
        This map starts in Colombo for display only. It does not request or capture your device location.
      </Text>
      <Text style={styles.helperText}>
        Pan and zoom, load the visible approximate areas, then select one area.
      </Text>
      <View style={styles.mapBlock}>
        <MapView
          accessibilityLabel="Approximate incident area selection map"
          initialRegion={REPORT_SELECTION_REGION}
          onRegionChangeComplete={setRegion}
          style={styles.map}>
          {cells.map((cell) => {
            const selected = cell.cellId === selectedCellId;
            return (
              <Polygon
                key={cell.cellId}
                coordinates={cellCoordinates(cell)}
                fillColor={selected ? 'rgba(23,107,91,0.42)' : 'rgba(23,107,91,0.13)'}
                strokeColor={selected ? palette.primary : 'rgba(23,107,91,0.55)'}
                strokeWidth={selected ? 3 : 1}
                tappable
                onPress={() => onSelectCell(cell.cellId)}
              />
            );
          })}
        </MapView>
      </View>

      <PrimaryButton
        label={isLoading ? 'Loading approximate areas…' : 'Load areas in this view'}
        loading={isLoading}
        onPress={() => void loadVisibleAreas()}
      />

      {errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {cells.length > 0 ? (
        <View style={styles.areaList}>
          <Text style={styles.helperText}>Accessible area choices</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaListContent}>
            {cells.map((cell, index) => {
              const selected = cell.cellId === selectedCellId;
              return (
                <Pressable
                  key={cell.cellId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectCell(cell.cellId)}
                  style={[styles.areaChoice, selected && styles.areaChoiceSelected]}>
                  <Text style={[styles.areaChoiceText, selected && styles.areaChoiceTextSelected]}>
                    Area {index + 1}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {selectedCellId ? (
        <View accessibilityLiveRegion="polite" style={styles.selectionCard}>
          <MaterialIcons name="check-circle" size={22} color={palette.primary} />
          <Text style={styles.selectionText}>Approximate area selected.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionGap: { gap: spacing.md },
  bodyText: { color: palette.text, fontSize: 15, lineHeight: 22 },
  helperText: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  mapBlock: {
    overflow: 'hidden',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  map: { height: 300, width: '100%' },
  errorCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#FDECEC' },
  errorText: { color: palette.error, fontSize: 14, lineHeight: 20 },
  selectionCard: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  selectionText: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '700' },
  areaList: { gap: spacing.sm },
  areaListContent: { gap: spacing.sm, paddingRight: spacing.md },
  areaChoice: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  areaChoiceSelected: { borderColor: palette.primary, backgroundColor: palette.primary },
  areaChoiceText: { color: palette.text, fontWeight: '700' },
  areaChoiceTextSelected: { color: palette.white },
});
