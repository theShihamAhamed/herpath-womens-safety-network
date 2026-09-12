// frontend/app/journey/route-comparison.tsx
// Thin route file per repo convention — no business logic here, just wiring
// Expo Router params into the feature screen component.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RouteComparisonScreen } from '../../src/features/routing/screens/RouteComparisonScreen';

export default function RouteComparisonPage() {
    // Expect navigation to this page to pass origin/destination as params, e.g.:
    //   router.push({
    //     pathname: '/journey/route-comparison',
    //     params: { originLat, originLng, destLat, destLng },
    //   });
    const { originLat, originLng, destLat, destLng } = useLocalSearchParams<{
        originLat: string;
        originLng: string;
        destLat: string;
        destLng: string;
    }>();

    return (
        <RouteComparisonScreen
            origin={{ lat: Number(originLat), lng: Number(originLng) }}
            destination={{ lat: Number(destLat), lng: Number(destLng) }}
        />
    );
}
