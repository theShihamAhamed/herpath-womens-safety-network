import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import JourneyOutcomeScreen from '../../src/features/journeys/screens/JourneyOutcomeScreen';

export default function Outcome() {
  const { journeyId } = useLocalSearchParams();
  return <JourneyOutcomeScreen journeyId={String(journeyId)} />;
}