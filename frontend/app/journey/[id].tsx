import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import JourneyDetailsScreen from '../../src/features/journeys/screens/JourneyDetailsScreen';

export default function Details() {
  const { id } = useLocalSearchParams();
  return <JourneyDetailsScreen id={String(id)} />;
}