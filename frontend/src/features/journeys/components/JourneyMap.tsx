import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Coordinate } from '../types';

interface Props {
  origin: Coordinate;
  destination: Coordinate;
  routePath: Coordinate[];
  currentLocation: Coordinate | null;
  travelledPath: Coordinate[];
}

export default function JourneyMap({ origin, destination, routePath, currentLocation, travelledPath }: Props) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      <Marker coordinate={origin} title="Start" pinColor="green" />
      <Marker coordinate={destination} title="Destination" pinColor="red" />
      {currentLocation && <Marker coordinate={currentLocation} title="You" pinColor="blue" />}
      {routePath.length > 1 && <Polyline coordinates={routePath} strokeWidth={4} strokeColor="#6C5CE7" />}
      {travelledPath.length > 1 && <Polyline coordinates={travelledPath} strokeWidth={4} strokeColor="#00B894" />}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });