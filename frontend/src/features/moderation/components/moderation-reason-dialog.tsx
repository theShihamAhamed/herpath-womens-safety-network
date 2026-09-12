import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/src/components/primary-button';
import { palette, radius, spacing } from '@/src/theme';

type ReasonAction = 'RELEASE' | 'REOPEN';

interface ModerationReasonDialogProps {
  action: ReasonAction | null;
  onClose(): void;
  onSubmit(action: ReasonAction, reason: string): void;
}

const ACTION_COPY = {
  RELEASE: {
    title: 'Release case',
    description: 'Explain why this case should return to the unassigned moderation queue.',
    submitLabel: 'Release case',
  },
  REOPEN: {
    title: 'Reopen case',
    description: 'Explain why this resolved case needs another moderation review.',
    submitLabel: 'Reopen case',
  },
} as const satisfies Record<ReasonAction, {
  title: string;
  description: string;
  submitLabel: string;
}>;

export function ModerationReasonDialog({
  action,
  onClose,
  onSubmit,
}: ModerationReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    setReason('');
    setError(null);
  }, [action]);

  if (!action) return null;
  const activeAction = action;
  const copy = ACTION_COPY[activeAction];

  function submit(): void {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 1) {
      setError('Enter a reason before continuing.');
      return;
    }
    if (normalizedReason.length > 1000) {
      setError('Keep the reason to 1000 characters or fewer.');
      return;
    }
    onSubmit(activeAction, normalizedReason);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {copy.title}
                </Text>
                <Text style={styles.description}>{copy.description}</Text>
              </View>
              <Pressable
                accessibilityLabel={`Close ${copy.title.toLowerCase()} dialog`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Reason</Text>
              <TextInput
                accessibilityLabel={`${copy.title} reason`}
                autoFocus
                maxLength={1000}
                multiline
                onChangeText={(value) => {
                  setReason(value);
                  if (error) setError(null);
                }}
                placeholder="Enter a clear reason"
                placeholderTextColor={palette.textMuted}
                style={[styles.input, error && styles.inputError]}
                textAlignVertical="top"
                value={reason}
              />
              <View style={styles.fieldFooter}>
                {error ? (
                  <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                    {error}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={styles.characterCount}>{reason.length}/1000</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
              <PrimaryButton label={copy.submitLabel} onPress={submit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  keyboardView: { flex: 1 },
  content: { flex: 1, gap: spacing.xl, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.sm },
  title: { color: palette.text, fontSize: 25, lineHeight: 31, fontWeight: '900' },
  description: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  closeButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  closeText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  field: { flex: 1, gap: spacing.sm },
  label: { color: palette.text, fontSize: 16, fontWeight: '800' },
  input: {
    minHeight: 180,
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    color: palette.text,
    backgroundColor: palette.surface,
    fontSize: 16,
    lineHeight: 23,
  },
  inputError: { borderColor: palette.error },
  fieldFooter: {
    minHeight: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  errorText: { flex: 1, color: palette.error, fontSize: 13, lineHeight: 19 },
  characterCount: { color: palette.textMuted, fontSize: 13 },
  actions: { gap: spacing.sm },
});
