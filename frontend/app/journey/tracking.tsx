import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import JourneyTrackingScreen from '../../src/features/journeys/screens/JourneyTrackingScreen';

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function Tracking() {
  const params = useLocalSearchParams();
  const routeParams = {
    routeId: params.routeId ? String(params.routeId) : '',
    origin: safeJsonParse(params.origin, { latitude: 0, longitude: 0, address: 'Origin' }),
    destination: safeJsonParse(params.destination, { latitude: 0, longitude: 0, address: 'Destination' }),
    polyline: params.polyline ? String(params.polyline) : '',
    distance: params.distance ? Number(params.distance) : undefined,
    duration: params.duration ? Number(params.duration) : undefined,
    riskScore: params.riskScore ? Number(params.riskScore) : undefined,
  };
  return <JourneyTrackingScreen params={routeParams} />;
}