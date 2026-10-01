import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import JourneyIntroScreen from '../../src/features/journeys/screens/JourneyIntroScreen';

function safeJsonParse<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export default function Intro() {
    const router = useRouter();
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

    const handleConsented = () => {
        router.replace({
            pathname: '/journey/tracking',
            params: {
                routeId: routeParams.routeId,
                origin: JSON.stringify(routeParams.origin),
                destination: JSON.stringify(routeParams.destination),
                polyline: routeParams.polyline,
                distance: routeParams.distance !== undefined ? String(routeParams.distance) : undefined,
                duration: routeParams.duration !== undefined ? String(routeParams.duration) : undefined,
                riskScore: routeParams.riskScore !== undefined ? String(routeParams.riskScore) : undefined,
            },
        });
    };

    return <JourneyIntroScreen params={routeParams} onConsented={handleConsented} />;
}