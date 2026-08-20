import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import JourneyTrackingScreen from '../../src/features/journeys/screens/JourneyTrackingScreen';

export default function Tracking() {
  const params = useLocalSearchParams();
  // TODO(verify): the routing module's contract for these params doesn't
  // exist yet (per your README, journey routes await the journey feature
  // contract). Confirm with Sandaruwan whether origin/destination/polyline
  // arrive as JSON-stringified params like this, or as separate primitives.
  const routeParams = {
    routeId: String(params.routeId),
    origin: JSON.parse(String(params.origin)),
    destination: JSON.parse(String(params.destination)),
    polyline: String(params.polyline),
    distance: params.distance ? Number(params.distance) : undefined,
    duration: params.duration ? Number(params.duration) : undefined,
    riskScore: params.riskScore ? Number(params.riskScore) : undefined,
  };
  return <JourneyTrackingScreen params={routeParams} />;
}