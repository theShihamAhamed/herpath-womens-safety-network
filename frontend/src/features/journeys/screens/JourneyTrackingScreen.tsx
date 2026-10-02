import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import JourneyMap from '../components/JourneyMap';
import JourneyControls from '../components/JourneyControls';
import ArrivalPrompt from '../components/ArrivalPrompt';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { journeyApi } from '../api/journeyApi';
import { decodePolyline } from '../utils/polyline';
import { distanceBetween, distanceToPath } from '../utils/geo';
import { IncomingRouteParams, Coordinate } from '../types';
import { DEVIATION_THRESHOLD_M, ARRIVAL_THRESHOLD_M } from '../../../config/journeyConstants';
import { useAuth } from '../../auth/auth-provider';
import { requestNotificationPermission, sendDeviationNotification, sendArrivalNotification } from '../utils/notifications';
import FeedbackOverlay from '../components/FeedbackOverlay';
import { palette } from '@/src/theme';
import { ApiError, messageFromError } from '@/src/services/api/errors';

export default function JourneyTrackingScreen({ params }: { params: IncomingRouteParams }) {
  const router = useRouter();
  const { accessToken, status } = useAuth();
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeyStatus, setJourneyStatus] = useState<'IDLE' | 'ACTIVE' | 'COMPLETED'>('IDLE');
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [travelledPath, setTravelledPath] = useState<Coordinate[]>([]);
  const [deviated, setDeviated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCheckInFeedback, setShowCheckInFeedback] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [showArrivalPrompt, setShowArrivalPrompt] = useState(false);
  const arrivalPromptShownRef = useRef(false);
  const stopTrackingRef = useRef<() => void>(() => undefined);

  const routePath = useMemo(() => decodePolyline(params.polyline), [params.polyline]);

  const handleEnd = useCallback(async () => {
    if (!journeyId || !accessToken) return;
    setLoading(true);
    setEndError(null);
    try {
      await journeyApi.finish(accessToken, journeyId);
      stopTrackingRef.current();
      setJourneyStatus('COMPLETED');
      router.push({ pathname: '/journey/outcome', params: { journeyId } });
    } catch {
      setEndError('Could not finish the journey. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, journeyId, router]);

  const handleCancel = useCallback(() => {
    if (!journeyId || !accessToken) return;
    Alert.alert('Cancel journey?', 'This will end tracking and mark the journey as unresolved.', [
      { text: 'Keep tracking', style: 'cancel' },
      {
        text: 'Cancel journey',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await journeyApi.cancel(accessToken, journeyId);
            stopTrackingRef.current();
            setJourneyStatus('COMPLETED');
            Alert.alert('Journey cancelled', 'Your journey was cancelled and marked unresolved.');
            router.replace('/journey/history');
          } catch {
            Alert.alert('Error', 'Could not cancel the journey. Try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [accessToken, journeyId, router]);

  // Arrival is only a proposal — the user must explicitly confirm it.
  const handleConfirmArrival = useCallback(async () => {
    setShowArrivalPrompt(false);
    await sendArrivalNotification();
    await handleEnd();
  }, [handleEnd]);

  const handleContinueJourney = useCallback(() => {
    setShowArrivalPrompt(false);
    arrivalPromptShownRef.current = false; // allow re-prompting if they re-approach later
  }, []);

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
        await sendDeviationNotification();
        try {
          await journeyApi.reportDeviation(accessToken, journeyId, point);
        } catch (e) {
          console.warn('Failed to report deviation', e);
        }
      }

      const distToDestination = distanceBetween(point, params.destination);
      if (distToDestination <= ARRIVAL_THRESHOLD_M && !arrivalPromptShownRef.current) {
        arrivalPromptShownRef.current = true;
        setShowArrivalPrompt(true);
      }
    },
    [journeyId, routePath, deviated, accessToken, params.destination]
  );

  const { start: startTracking, stop: stopTracking } = useLocationTracking(handleLocation);
  useEffect(() => {
    stopTrackingRef.current = stopTracking;
  }, [stopTracking]);

  const handleStart = async () => {
    if (!accessToken) {
      Alert.alert('Not signed in', 'Please wait for your session to be ready.');
      return;
    }

    setLoading(true);
    try {
      // Consent already given on the Intro screen; here we confirm the OS
      // permission is actually granted BEFORE creating the journey, so a
      // denial never leaves an orphaned ACTIVE journey behind.
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert('Location permission needed', 'HerPath needs location access to track your journey.');
        return;
      }

      await requestNotificationPermission();

      const journey = await journeyApi.start(accessToken, params);
      setJourneyId(journey._id);

      const trackingStarted = await startTracking();
      if (!trackingStarted) {
        await journeyApi.cancel(accessToken, journey._id);
        setJourneyId(null);
        throw new Error('Location tracking could not be started.');
      }

      setJourneyStatus('ACTIVE');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACTIVE_JOURNEY_EXISTS') {
        try {
          const activeJourney = (await journeyApi.history(accessToken)).find(
            (journey) => journey.status === 'ACTIVE',
          );
          if (activeJourney) {
            Alert.alert(
              'Active journey found',
              'A previous journey is still marked as active. Would you like to cancel it?',
              [
                { text: 'Keep it', style: 'cancel' },
                {
                  text: 'Cancel journey',
                  style: 'destructive',
                  onPress: () => {
                    void journeyApi.cancel(accessToken, activeJourney._id)
                      .then(() => Alert.alert('Journey cancelled', 'You can now start a new journey.'))
                      .catch((cancelError) => Alert.alert('Error', messageFromError(cancelError)));
                  },
                },
              ],
            );
            return;
          }
        } catch (historyError) {
          Alert.alert('Error', messageFromError(historyError));
          return;
        }
      }
      Alert.alert('Error', messageFromError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!journeyId || !currentLocation || !accessToken) return;
    setLoading(true);
    try {
      await journeyApi.checkIn(accessToken, journeyId, currentLocation);
      setShowCheckInFeedback(true);
    } catch {
      Alert.alert('Error', 'Could not record check-in.');
    } finally {
      setLoading(false);
    }
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
        onCancel={handleCancel}
        loading={loading}
        error={endError}
      />
      <FeedbackOverlay
        visible={showCheckInFeedback}
        icon="check-circle"
        iconColor={palette.primary}
        title="Checked in"
        message="Your check-in was recorded."
        onHide={() => setShowCheckInFeedback(false)}
      />
      {showArrivalPrompt && (
        <ArrivalPrompt onConfirm={handleConfirmArrival} onContinue={handleContinueJourney} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });