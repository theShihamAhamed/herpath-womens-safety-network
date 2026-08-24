// frontend/src/features/routing/components/RecommendationBanner.tsx
// HS-137: Add route recommendation UI
// HS-86: Display safety explanation

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteRecommendation } from '../types/routing.types';

interface RecommendationBannerProps {
  recommendation: RouteRecommendation;
}

export function RecommendationBanner({ recommendation }: RecommendationBannerProps) {
  const recommended = recommendation.routes.find(
    (r) => r.routeId === recommendation.recommendedRouteId
  );

  if (!recommended) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Recommended route</Text>
        </View>
        <Text style={styles.durationText}>{recommended.durationText}</Text>
      </View>

      <Text style={styles.explanationText}>{recommendation.explanation}</Text>

      <Text style={styles.disclaimerText}>
        Based on community-reported context — not a guarantee of safety.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#EAF4F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CFE6DC',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#1F4B4A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F4B4A',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2A28',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#5B6B67',
    fontStyle: 'italic',
  },
});
