import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/src/components/primary-button';
import { palette, radius, spacing } from '@/src/theme';

const BACKDROP_OPACITY = 0.42;
const DISMISS_VELOCITY = 850;
const SETTLE_ANIMATION = { duration: 220, easing: Easing.out(Easing.cubic) };

interface IncidentPrivacySheetProps {
  visible: boolean;
  onClose(): void;
}

export function IncidentPrivacySheet({ visible, onClose }: IncidentPrivacySheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(windowHeight);
  const dragStartY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const closingRef = useRef(false);
  const headingRef = useRef<Text>(null);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    onClose();
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    backdropOpacity.value = withTiming(0, SETTLE_ANIMATION);
    translateY.value = withTiming(windowHeight, SETTLE_ANIMATION, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [backdropOpacity, finishClose, translateY, windowHeight]);

  const settleOpen = useCallback(() => {
    translateY.value = withTiming(0, SETTLE_ANIMATION);
    backdropOpacity.value = withTiming(BACKDROP_OPACITY, SETTLE_ANIMATION);
  }, [backdropOpacity, translateY]);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateY.value = windowHeight;
    backdropOpacity.value = 0;
    settleOpen();
  }, [backdropOpacity, settleOpen, translateY, visible, windowHeight]);

  const finishGesture = useCallback((offset: number, velocityY: number) => {
    const dismissThreshold = Math.min(160, windowHeight * 0.2);
    if (offset >= dismissThreshold || velocityY >= DISMISS_VELOCITY) {
      dismiss();
      return;
    }
    settleOpen();
  }, [dismiss, settleOpen, windowHeight]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-32, 32])
      .onBegin(() => {
        dragStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        const offset = Math.min(Math.max(dragStartY.value + event.translationY, 0), windowHeight);
        translateY.value = offset;
        backdropOpacity.value = BACKDROP_OPACITY * (1 - offset / windowHeight);
      })
      .onEnd((event) => runOnJS(finishGesture)(translateY.value, event.velocityY))
      .onFinalize((_event, succeeded) => {
        if (!succeeded) runOnJS(settleOpen)();
      }),
    [backdropOpacity, dragStartY, finishGesture, translateY, windowHeight],
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  function focusHeading(): void {
    requestAnimationFrame(() => {
      const node = findNodeHandle(headingRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      onShow={focusHeading}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]}>
          <Pressable
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={dismiss}
            style={styles.backdropPressable}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          importantForAccessibility="yes"
          style={[
            styles.sheet,
            { maxHeight: windowHeight * 0.86, paddingBottom: Math.max(insets.bottom, spacing.md) },
            animatedSheetStyle,
          ]}>
          <GestureDetector gesture={panGesture}>
            <View
              accessible
              accessibilityLabel="Privacy details sheet. Swipe down to close."
              collapsable={false}
              style={styles.dragRegion}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <Text ref={headingRef} accessibilityRole="header" style={styles.title}>
              Your location privacy
            </Text>
            <Pressable
              accessibilityLabel="Close privacy details"
              accessibilityRole="button"
              onPress={dismiss}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.introduction}>
              HerPath never shows your exact reporting location on the public map.
            </Text>

            <PrivacySection
              title="Exact location privately"
              text="Your exact location can be stored privately, but everyone else sees only an approximate area."
            />
            <PrivacySection
              title="Approximate area"
              text="Your device location is not requested. Only the area you choose is submitted."
            />
            <PrivacyList
              title="What’s public?"
              items={[
                'Approximate area',
                'Category',
                'Severity',
                'Occurrence time',
                'Public report status',
                'Community support',
              ]}
            />
            <PrivacyList
              title="What’s private?"
              items={[
                'Exact reporting location',
                'Reporter or account identity',
                'Description and other private report details',
              ]}
            />
            <Text style={styles.statusNote}>
              New reports appear as unverified community reports. Community support does not verify a report.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label="Got it" onPress={dismiss} />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PrivacySection({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

function PrivacyList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listItem}>
            <Text accessible={false} style={styles.bullet}>•</Text>
            <Text style={styles.listItemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: '#000000' },
  backdropPressable: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  dragRegion: { minHeight: 32, justifyContent: 'center' },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { minWidth: 190, flex: 1, color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  closeButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  closeButtonText: { color: palette.primary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  scrollView: { flexShrink: 1 },
  content: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  introduction: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  section: { gap: spacing.sm },
  sectionTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  sectionText: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  list: { gap: spacing.sm },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { color: palette.primary, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  listItemText: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 22 },
  statusNote: {
    padding: spacing.md,
    borderRadius: radius.md,
    color: palette.text,
    backgroundColor: palette.surfaceMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
