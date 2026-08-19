import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import JourneyMap from '../components/JourneyMap';
import JourneyControls from '../components/JourneyControls';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { journeyApi } from '../api/journeyApi';
import { decodePolyline } from '../utils/polyline';
import { distanceBetween, distanceToPath } from '../utils/geo';
import { IncomingRouteParams, Coordinate } from '../types';
import { DEVIATION_THRESHOLD_M, ARRIVAL_THRESHOLD_M } from '../../../config/journeyConstants';
// TODO(verify): confirm this import path for useAuth matches the real auth-provider location.
import { useAuth } from '../../auth/auth-provider';

export default function JourneyTrackingScreen({ params }: { params: IncomingRouteParams }) {
  const router = useRouter();
  const { accessToken, status } = useAuth();
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeyStatus, setJourneyStatus] = useState<'IDLE' | 'ACTIVE' | 'COMPLETED'>('IDLE');
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [travelledPath, setTravelledPath] = useState<Coordinate[]>([]);
  const [deviated, setDeviated] = useState(false);
  const [loading, setLoading] = useState(false);

  const routePath = useMemo(() => decodePolyline(params.polyline), [params.polyline]);

  const handleLocation = useCallback(
    async (point: Coordinate) => {
      setCurrentLocation(point);
      setTravelledPath((prev) => [...prev, point]);

      if (!journeyId || !accessToken) return;

      try {
        await journeyApi.updateLocation(accessToken, journeyId, point);
      } catch (e) {
        console.warn('Failed to sync location', e);
      }

      const distFromRoute = distanceToPath(point, routePath);
      if (distFromRoute > DEVIATION_THRESHOLD_M && !deviated) {
        setDeviated(true);
        Alert.alert('Route deviation', 'You have deviated from the recommended route.');
        try {
          await journeyApi.reportDeviation(accessToken, journeyId, point);
        } catch (e) {
          console.warn('Failed to report deviation', e);
        }
      }

      const distToDestination = distanceBetween(point, params.destination);
      if (distToDestination <= ARRIVAL_THRESHOLD_M) {
        await handleEnd();
      }
    },
    [journeyId, routePath, deviated, accessToken]
  );

  const { start: startTracking, stop: stopTracking } = useLocationTracking(handleLocation);

  const handleStart = async () => {
    if (!accessToken) {
      Alert.alert('Not signed in', 'Please wait for your session to be ready.');
      return;
    }
    setLoading(true);
    try {
      const journey = await journeyApi.start(accessToken, params);
      setJourneyId(journey._id);
      setJourneyStatus('ACTIVE');
      await startTracking();
    } catch (e) {
      Alert.alert('Error', 'Could not start the journey. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!journeyId || !currentLocation || !accessToken) return;
    setLoading(true);
    try {
      await journeyApi.checkIn(accessToken, journeyId, currentLocation);
      Alert.alert('Checked in', 'Your check-in was recorded.');
    } catch {
      Alert.alert('Error', 'Could not record check-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!journeyId || !accessToken) return;
    stopTracking();
    setJourneyStatus('COMPLETED');
    try {
      await journeyApi.finish(accessToken, journeyId);
    } catch (e) {
      console.warn('Failed to finish journey', e);
    }
    router.push({ pathname: '/journey/outcome', params: { journeyId } });
  };

  useEffect(() => stopTracking, [stopTracking]);

  if (status !== 'ready') {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <JourneyMap
        origin={params.origin}
        destination={params.destination}
        routePath={routePath}
        currentLocation={currentLocation}
        travelledPath={travelledPath}
      />
      <JourneyControls
        status={journeyStatus}
        onStart={handleStart}
        onCheckIn={handleCheckIn}
        onEnd={handleEnd}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });