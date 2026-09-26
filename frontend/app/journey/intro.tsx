import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import JourneyIntroScreen from '../../src/features/journeys/screens/JourneyIntroScreen';

export default function Intro() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const routeParams = {
        routeId: String(params.routeId),
        origin: JSON.parse(String(params.origin)),
        destination: JSON.parse(String(params.destination)),
        polyline: String(params.polyline),
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
                distance: routeParams.distance ? String(routeParams.distance) : undefined,
                duration: routeParams.duration ? String(routeParams.duration) : undefined,
                riskScore: routeParams.riskScore ? String(routeParams.riskScore) : undefined,
            },
        });
    };

    return <JourneyIntroScreen params={routeParams} onConsented={handleConsented} />;
}