import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Callout } from 'react-native-maps';

import type { PublicIncidentMarker } from './map.types';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from './map.types';

interface IncidentCalloutProps {
  incident: PublicIncidentMarker;
}

export function IncidentCallout({ incident }: IncidentCalloutProps) {
  const categoryInfo = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.OTHER;
  const severityInfo = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.LOW;

  const formattedDate = new Date(incident.occurredAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Callout tooltip style={styles.calloutContainer}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.categoryTitle, { color: categoryInfo.color }]}>
            {categoryInfo.label}
          </Text>
          <View style={[styles.severityBadge, { backgroundColor: severityInfo.color }]}>
            <Text style={styles.severityText}>{severityInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.contextText}>Community report · Approximate area</Text>
        <Text style={styles.dateText}>Occurred: {formattedDate}</Text>
        
        {incident.supportCount > 0 && (
          <Text style={styles.supportText}>{incident.supportCount} community support</Text>
        )}
      </View>
    </Callout>
  );
}

const styles = StyleSheet.create({
  calloutContainer: {
    width: 200,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D7DEDC',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  contextText: {
    fontSize: 12,
    color: '#5F6C68',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#8E9A96',
    marginBottom: 4,
  },
  supportText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#176B5B',
  },
});
