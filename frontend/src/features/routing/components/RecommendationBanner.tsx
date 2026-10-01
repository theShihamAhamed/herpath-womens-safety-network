import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

      <View style={styles.disclaimerContainer}>
        <MaterialIcons name="info-outline" size={15} color="#4A5D58" style={styles.disclaimerIcon} />
        <Text style={styles.disclaimerText}>
          Reported risk is based on available community safety data and may change as new incidents are reported. Lower reported risk or absence of reports does not guarantee safety—use this to help make your own travel decision.
        </Text>
      </View>
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
    marginBottom: 10,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 8,
    padding: 8,
  },
  disclaimerIcon: {
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#4A5D58',
  },
});
