import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

import { getBackendTileUrlTemplate } from '../../map/backend-tile-url';

import { Coordinate } from '../types';

interface Props {
  origin: Coordinate;
  destination: Coordinate;
  routePath: Coordinate[];
  currentLocation: Coordinate | null;
  travelledPath: Coordinate[];
}

export default function JourneyMap({ origin, destination, routePath, currentLocation, travelledPath }: Props) {
  const androidTileUrlTemplate = getBackendTileUrlTemplate();

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        mapType={Platform.OS === 'android' ? 'none' : undefined}
        initialRegion={{
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {Platform.OS === 'android' ? (
          <UrlTile urlTemplate={androidTileUrlTemplate} tileSize={256} maximumZ={20} />
        ) : null}
        <Marker coordinate={origin} title="Start" pinColor="green" />
        <Marker coordinate={destination} title="Destination" pinColor="red" />
        {currentLocation && <Marker coordinate={currentLocation} title="You" pinColor="blue" />}
        {routePath.length > 1 && <Polyline coordinates={routePath} strokeWidth={4} strokeColor="#6C5CE7" />}
        {travelledPath.length > 1 && <Polyline coordinates={travelledPath} strokeWidth={4} strokeColor="#00B894" />}
      </MapView>
      {Platform.OS === 'android' ? (
        <View pointerEvents="none" style={styles.tileAttribution}>
          <Text style={styles.tileAttributionText}>© OpenStreetMap contributors · Geoapify</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  tileAttribution: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  tileAttributionText: {
    color: '#3E4C48',
    fontSize: 10,
  },
});
