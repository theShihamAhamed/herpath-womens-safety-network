import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { palette, radius, spacing } from '@/src/theme';

interface Props {
  visible: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  title: string;
  message: string;
  onHide: () => void;
  durationMs?: number;
}

export default function FeedbackOverlay({ visible, icon, iconColor, title, message, onHide, durationMs = 1600 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop} pointerEvents="none">
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '1A' }]}>
          <MaterialIcons name={icon} size={28} color={iconColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: palette.text, marginBottom: 4 },
  message: { fontSize: 13, color: palette.textMuted, textAlign: 'center' },
});