import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/src/theme';

export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  contentStyle,
}: PropsWithChildren<{
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  contentStyle?: ViewStyle;
}>) {
  const content = (
    <View style={[styles.content, scroll ? styles.scrollBody : styles.fixedBody, contentStyle]}>
      {children}
    </View>
  );
  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.scrollContainer}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  ) : (
    content
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={keyboardAvoiding}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  fill: { flex: 1 },
  content: { padding: spacing.lg },
  fixedBody: { flex: 1 },
  scrollBody: { flexGrow: 1 },
  scrollContainer: { flexGrow: 1 },
});
