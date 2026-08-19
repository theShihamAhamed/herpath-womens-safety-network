import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useReducer, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { Screen } from '@/src/components/screen';
import { useAuth } from '@/src/features/auth/auth-provider';
import { ApiError } from '@/src/services/api/errors';
import { palette, radius, spacing } from '@/src/theme';

import { incidentApi } from './incident-api';
import type {
  CreateIncidentInput,
  IncidentCategory,
  IncidentLocationMode,
  IncidentSeverity,
} from './incident.types';
import { MyReportsPanel } from './my-reports-panel';
import {
  createReportDraft,
  hasSelectedLocation,
  reportDraftReducer,
  type ReportDraftState,
  type ReportStep,
} from './report-draft';
import { ApproximateLocationSelector, ExactLocationSelector } from './report-location-step';

const CATEGORY_OPTIONS: { value: IncidentCategory; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'ASSAULT', label: 'Assault' },
  { value: 'STALKING', label: 'Stalking' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITY_OPTIONS: {
  value: IncidentSeverity;
  label: string;
  description: string;
}[] = [
  { value: 'LOW', label: 'Low', description: 'Limited immediate impact or concern.' },
  { value: 'MEDIUM', label: 'Medium', description: 'A concerning incident with moderate impact.' },
  { value: 'HIGH', label: 'High', description: 'A serious incident or continuing concern.' },
  { value: 'CRITICAL', label: 'Critical', description: 'Severe or potentially life-threatening circumstances.' },
];

const STEP_NUMBER: Partial<Record<ReportStep, number>> = {
  PRIVACY: 1,
  CATEGORY: 2,
  LOCATION_MODE: 3,
  LOCATION: 4,
  DATE_TIME: 5,
  SEVERITY: 6,
  DESCRIPTION: 7,
  REVIEW: 8,
};

const BACK_STEP: Partial<Record<ReportStep, ReportStep>> = {
  CATEGORY: 'PRIVACY',
  LOCATION_MODE: 'CATEGORY',
  LOCATION: 'LOCATION_MODE',
  DATE_TIME: 'LOCATION',
  SEVERITY: 'DATE_TIME',
  DESCRIPTION: 'SEVERITY',
  REVIEW: 'DESCRIPTION',
};

export function IncidentReportScreen() {
  const { accessToken, actor } = useAuth();
  const router = useRouter();
  const [state, dispatch] = useReducer(
    reportDraftReducer,
    undefined,
    () => createReportDraft(Crypto.randomUUID()),
  );
  const historyReturnStep = useRef<ReportStep>('PRIVACY');
  const submissionInFlight = useRef(false);

  if (!accessToken || !actor) return null;

  function showMyReports(): void {
    historyReturnStep.current = state.step === 'MY_REPORTS' ? 'PRIVACY' : state.step;
    dispatch({ type: 'GO_TO', step: 'MY_REPORTS' });
  }

  function startAnotherReport(): void {
    dispatch({ type: 'RESET', clientSubmissionId: Crypto.randomUUID(), occurredAt: new Date() });
  }

  async function submitReport(): Promise<void> {
    if (submissionInFlight.current) return;
    const submissionToken = accessToken;
    if (!submissionToken) return;
    let input: CreateIncidentInput;
    try {
      input = createSubmissionInput(state);
    } catch {
      dispatch({
        type: 'SUBMIT_FAILED',
        message: 'Review the required report details before submitting.',
      });
      return;
    }

    submissionInFlight.current = true;
    dispatch({ type: 'SUBMIT_STARTED' });
    try {
      const incident = await incidentApi.create(submissionToken, input);
      dispatch({ type: 'SUBMIT_SUCCEEDED', incident });
    } catch (error) {
      dispatch({ type: 'SUBMIT_FAILED', message: submissionMessage(error) });
    } finally {
      submissionInFlight.current = false;
    }
  }

  if (state.step === 'MY_REPORTS') {
    return (
      <Screen contentStyle={styles.historyContent}>
        <MyReportsPanel
          accessToken={accessToken}
          actorId={actor.id}
          onClose={() => dispatch({ type: 'GO_TO', step: historyReturnStep.current })}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding contentStyle={styles.content}>
      {state.step !== 'SUBMITTING' && state.step !== 'CONFIRMATION' ? (
        <ReportHeader step={state.step} onShowMyReports={showMyReports} />
      ) : null}

      {state.step === 'PRIVACY' ? (
        <PrivacyStep onContinue={() => dispatch({ type: 'GO_TO', step: 'CATEGORY' })} />
      ) : null}
      {state.step === 'CATEGORY' ? (
        <CategoryStep
          selected={state.category}
          onSelect={(category) => dispatch({ type: 'SET_CATEGORY', category })}
          onContinue={() => dispatch({ type: 'GO_TO', step: 'LOCATION_MODE' })}
        />
      ) : null}
      {state.step === 'LOCATION_MODE' ? (
        <LocationModeStep
          selected={state.locationMode}
          onSelect={(mode) => dispatch({ type: 'SET_LOCATION_MODE', mode })}
          onContinue={() => dispatch({ type: 'GO_TO', step: 'LOCATION' })}
        />
      ) : null}
      {state.step === 'LOCATION' ? (
        <LocationStep
          state={state}
          accessToken={accessToken}
          onChooseApproximate={() => {
            dispatch({ type: 'SET_LOCATION_MODE', mode: 'APPROXIMATE_ONLY' });
          }}
          dispatch={dispatch}
        />
      ) : null}
      {state.step === 'DATE_TIME' ? (
        <DateTimeStep
          value={state.occurredAt}
          onChange={(occurredAt) => dispatch({ type: 'SET_OCCURRED_AT', occurredAt })}
          onContinue={() => dispatch({ type: 'GO_TO', step: 'SEVERITY' })}
        />
      ) : null}
      {state.step === 'SEVERITY' ? (
        <SeverityStep
          selected={state.severity}
          onSelect={(severity) => dispatch({ type: 'SET_SEVERITY', severity })}
          onContinue={() => dispatch({ type: 'GO_TO', step: 'DESCRIPTION' })}
        />
      ) : null}
      {state.step === 'DESCRIPTION' ? (
        <DescriptionStep
          value={state.description}
          onChange={(description) => dispatch({ type: 'SET_DESCRIPTION', description })}
          onContinue={() => dispatch({ type: 'GO_TO', step: 'REVIEW' })}
        />
      ) : null}
      {state.step === 'REVIEW' ? (
        <ReviewStep state={state} onSubmit={() => void submitReport()} />
      ) : null}
      {state.step === 'SUBMITTING' ? <SubmittingStep /> : null}
      {state.step === 'CONFIRMATION' ? (
        <ConfirmationStep
          exactPrivate={state.locationMode === 'EXACT_PRIVATE'}
          onShowMyReports={showMyReports}
          onReturnToMap={() => router.navigate('/map')}
          onReportAnother={startAnotherReport}
        />
      ) : null}

      {BACK_STEP[state.step] ? (
        <PrimaryButton
          label="Back"
          variant="secondary"
          onPress={() => dispatch({ type: 'GO_TO', step: BACK_STEP[state.step]! })}
        />
      ) : null}
    </Screen>
  );
}

function ReportHeader({ step, onShowMyReports }: { step: ReportStep; onShowMyReports(): void }) {
  const number = STEP_NUMBER[step];
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{number ? `REPORT · STEP ${number} OF 8` : 'REPORT'}</Text>
        <Text accessibilityRole="header" style={styles.screenTitle}>Report an incident</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onShowMyReports}
        style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}>
        <Text style={styles.historyButtonText}>My Reports</Text>
      </Pressable>
    </View>
  );
}

function PrivacyStep({ onContinue }: { onContinue(): void }) {
  return (
    <StepLayout title="Your privacy comes first">
      <Text style={styles.bodyText}>
        Your report can help improve community safety information. Public map views use an approximate location and do not show your private reporting location.
      </Text>
      <InfoCard text="Choosing an approximate area does not capture or store your device’s exact location." />
      <InfoCard text="New reports initially appear as unverified community reports." />
      <PrimaryButton label="Continue" onPress={onContinue} />
    </StepLayout>
  );
}

function CategoryStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: IncidentCategory | null;
  onSelect(category: IncidentCategory): void;
  onContinue(): void;
}) {
  return (
    <StepLayout title="What type of incident occurred?" description="Choose one category.">
      {CATEGORY_OPTIONS.map((option) => (
        <ChoiceCard
          key={option.value}
          label={option.label}
          selected={selected === option.value}
          onPress={() => onSelect(option.value)}
        />
      ))}
      <PrimaryButton label="Continue" disabled={!selected} onPress={onContinue} />
    </StepLayout>
  );
}

function LocationModeStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: IncidentLocationMode | null;
  onSelect(mode: IncidentLocationMode): void;
  onContinue(): void;
}) {
  return (
    <StepLayout title="Choose location privacy">
      <ChoiceCard
        label="Use exact location privately"
        description="HerPath stores the selected point privately and publishes only an approximate area."
        selected={selected === 'EXACT_PRIVATE'}
        onPress={() => onSelect('EXACT_PRIVATE')}
      />
      <ChoiceCard
        label="Choose an approximate area"
        description="No device location is requested or captured for this choice."
        selected={selected === 'APPROXIMATE_ONLY'}
        onPress={() => onSelect('APPROXIMATE_ONLY')}
      />
      <PrimaryButton label="Continue" disabled={!selected} onPress={onContinue} />
    </StepLayout>
  );
}

function LocationStep({
  state,
  accessToken,
  onChooseApproximate,
  dispatch,
}: {
  state: ReportDraftState;
  accessToken: string;
  onChooseApproximate(): void;
  dispatch: React.Dispatch<Parameters<typeof reportDraftReducer>[1]>;
}) {
  return (
    <StepLayout
      title={state.locationMode === 'EXACT_PRIVATE' ? 'Select the private location' : 'Select an approximate area'}>
      {state.locationMode === 'EXACT_PRIVATE' ? (
        <ExactLocationSelector
          location={state.exactLocation}
          source={state.exactLocationSource}
          onSelect={(location, source) => dispatch({ type: 'SET_EXACT_LOCATION', location, source })}
          onChooseApproximate={onChooseApproximate}
        />
      ) : (
        <ApproximateLocationSelector
          accessToken={accessToken}
          selectedCellId={state.selectedAreaCellId}
          onSelectCell={(cellId) => dispatch({ type: 'SET_SELECTED_CELL', cellId })}
        />
      )}
      <PrimaryButton
        label="Continue"
        disabled={!hasSelectedLocation(state)}
        onPress={() => dispatch({ type: 'GO_TO', step: 'DATE_TIME' })}
      />
    </StepLayout>
  );
}

function DateTimeStep({
  value,
  onChange,
  onContinue,
}: {
  value: Date;
  onChange(value: Date): void;
  onContinue(): void;
}) {
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const isTooFarInFuture = value.getTime() > Date.now() + 5 * 60_000;

  function pickerChanged(event: DateTimePickerEvent, selected?: Date): void {
    if (Platform.OS === 'android') setPickerMode(null);
    if (event.type === 'set' && selected) onChange(selected);
  }

  return (
    <StepLayout title="When did it happen?" description="Choose the incident date and time, not the submission time.">
      <View style={styles.dateCard}>
        <Text style={styles.dateValue}>{value.toLocaleString()}</Text>
        <View style={styles.inlineButtons}>
          <SmallAction label="Change date" onPress={() => setPickerMode('date')} />
          <SmallAction label="Change time" onPress={() => setPickerMode('time')} />
        </View>
      </View>
      {pickerMode ? (
        <View style={styles.pickerCard}>
          <DateTimePicker
            value={value}
            mode={pickerMode}
            maximumDate={new Date()}
            onChange={pickerChanged}
          />
          {Platform.OS === 'ios' ? (
            <SmallAction label="Done" onPress={() => setPickerMode(null)} />
          ) : null}
        </View>
      ) : null}
      {isTooFarInFuture ? (
        <Text style={styles.errorText}>Choose a date and time that is not in the future.</Text>
      ) : null}
      <PrimaryButton label="Continue" disabled={isTooFarInFuture} onPress={onContinue} />
    </StepLayout>
  );
}

function SeverityStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: IncidentSeverity | null;
  onSelect(severity: IncidentSeverity): void;
  onContinue(): void;
}) {
  return (
    <StepLayout title="How severe was the incident?">
      {SEVERITY_OPTIONS.map((option) => (
        <ChoiceCard
          key={option.value}
          label={option.label}
          description={option.description}
          selected={selected === option.value}
          onPress={() => onSelect(option.value)}
        />
      ))}
      <PrimaryButton label="Continue" disabled={!selected} onPress={onContinue} />
    </StepLayout>
  );
}

function DescriptionStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange(value: string): void;
  onContinue(): void;
}) {
  return (
    <StepLayout title="Add a description" description="Optional · maximum 500 characters">
      <Text style={styles.privacyWarning}>
        Do not include names, phone numbers, addresses, or other information that could identify you or another person.
      </Text>
      <TextInput
        accessibilityLabel="Optional incident description"
        multiline
        maxLength={500}
        onChangeText={onChange}
        placeholder="Brief, non-identifying details"
        placeholderTextColor={palette.textMuted}
        style={styles.descriptionInput}
        textAlignVertical="top"
        value={value}
      />
      <Text style={styles.characterCount}>{value.length}/500</Text>
      <PrimaryButton label="Review report" onPress={onContinue} />
    </StepLayout>
  );
}

function ReviewStep({ state, onSubmit }: { state: ReportDraftState; onSubmit(): void }) {
  const category = CATEGORY_OPTIONS.find((option) => option.value === state.category)?.label;
  const severity = SEVERITY_OPTIONS.find((option) => option.value === state.severity)?.label;
  const description = state.description.trim();
  return (
    <StepLayout title="Review your report" description="Check these details before submitting.">
      <ReviewRow label="Category" value={category ?? 'Not selected'} />
      <ReviewRow label="Occurred" value={state.occurredAt.toLocaleString()} />
      <ReviewRow label="Severity" value={severity ?? 'Not selected'} />
      <ReviewRow
        label="Location privacy"
        value={state.locationMode === 'EXACT_PRIVATE' ? 'Exact location stored privately' : 'Approximate area only'}
      />
      <InfoCard
        text={
          state.locationMode === 'EXACT_PRIVATE'
            ? 'Your exact location is stored privately. The public map uses only an approximate area.'
            : 'Only the approximate area you selected will be submitted.'
        }
      />
      {description ? <ReviewRow label="Description" value={description} /> : null}
      {state.submissionError ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>{state.submissionError}</Text>
      ) : null}
      <PrimaryButton label="Submit report" onPress={onSubmit} />
    </StepLayout>
  );
}

function SubmittingStep() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.fullState}>
      <Text accessibilityRole="header" style={styles.screenTitle}>Submitting report…</Text>
      <Text style={styles.bodyText}>Keep this screen open while HerPath securely sends your report.</Text>
      <PrimaryButton label="Submitting report…" loading disabled onPress={() => undefined} />
    </View>
  );
}

function ConfirmationStep({
  exactPrivate,
  onShowMyReports,
  onReturnToMap,
  onReportAnother,
}: {
  exactPrivate: boolean;
  onShowMyReports(): void;
  onReturnToMap(): void;
  onReportAnother(): void;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.fullState}>
      <Text accessibilityRole="header" style={styles.screenTitle}>Report submitted</Text>
      <Text style={styles.bodyText}>
        This is an unverified community report. Only an approximate public location is visible.
        {exactPrivate ? ' Your exact location remains private.' : ''}
      </Text>
      <PrimaryButton label="View My Reports" onPress={onShowMyReports} />
      <PrimaryButton label="Return to Map" variant="secondary" onPress={onReturnToMap} />
      <PrimaryButton label="Report another incident" variant="secondary" onPress={onReportAnother} />
    </View>
  );
}

function StepLayout({
  title,
  description,
  children,
}: React.PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeading}>
        <Text accessibilityRole="header" style={styles.stepTitle}>{title}</Text>
        {description ? <Text style={styles.stepDescription}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ChoiceCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
      {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
    </Pressable>
  );
}

function InfoCard({ text }: { text: string }) {
  return <View style={styles.infoCard}><Text style={styles.infoText}>{text}</Text></View>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
      <Text style={styles.smallActionText}>{label}</Text>
    </Pressable>
  );
}

function createSubmissionInput(state: ReportDraftState): CreateIncidentInput {
  if (!state.category || !state.severity || !state.locationMode || !hasSelectedLocation(state)) {
    throw new Error('Report is incomplete');
  }

  const common = {
    clientSubmissionId: state.clientSubmissionId,
    category: state.category,
    severity: state.severity,
    occurredAt: state.occurredAt.toISOString(),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
  };

  if (state.locationMode === 'EXACT_PRIVATE' && state.exactLocation) {
    return {
      ...common,
      location: { mode: 'EXACT_PRIVATE', privateLocation: state.exactLocation },
    };
  }
  if (state.locationMode === 'APPROXIMATE_ONLY' && state.selectedAreaCellId) {
    return {
      ...common,
      location: {
        mode: 'APPROXIMATE_ONLY',
        selectedAreaCellId: state.selectedAreaCellId,
      },
    };
  }
  throw new Error('Report location is incomplete');
}

function submissionMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'IDEMPOTENCY_CONFLICT') {
      return 'This saved retry conflicts with an earlier report. Your draft was preserved; open My Reports before trying again.';
    }
    if (error.code === 'REPORT_RATE_LIMIT_EXCEEDED' || error.status === 429) {
      return 'Too many new reports were submitted recently. Your draft is saved; please try again later.';
    }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) {
      return 'The submission result is uncertain because the connection failed. Your draft and safe retry state are preserved; retry when ready.';
    }
  }
  return 'The report could not be submitted. Your draft is preserved so you can retry.';
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxl },
  historyContent: { paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  screenTitle: { color: palette.text, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  historyButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  historyButtonText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  step: { gap: spacing.md },
  stepHeading: { gap: spacing.xs },
  stepTitle: { color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  stepDescription: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  bodyText: { color: palette.text, fontSize: 16, lineHeight: 24 },
  infoCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surfaceMuted },
  infoText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  choice: {
    minHeight: 58,
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  choiceSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.surfaceMuted },
  choiceLabel: { color: palette.text, fontSize: 16, fontWeight: '800' },
  choiceLabelSelected: { color: palette.primary },
  choiceDescription: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  dateCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surface },
  dateValue: { color: palette.text, fontSize: 18, fontWeight: '800' },
  inlineButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.md,
  },
  smallActionText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  pickerCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: palette.surface },
  privacyWarning: {
    padding: spacing.md,
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  descriptionInput: {
    minHeight: 160,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    color: palette.text,
    backgroundColor: palette.surface,
    fontSize: 16,
    lineHeight: 23,
  },
  characterCount: { color: palette.textMuted, textAlign: 'right', fontSize: 13 },
  reviewRow: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surface },
  reviewLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  reviewValue: { color: palette.text, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  errorText: { color: palette.error, fontSize: 14, lineHeight: 21 },
  fullState: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
});
