import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useReducer, useRef, useState, type Dispatch, type RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
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
import { IncidentPrivacySheet } from './incident-privacy-sheet';
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
  type ReportDraft,
  type ReportDraftAction,
} from './report-draft';
import { ApproximateLocationSelector, ExactLocationSelector } from './report-location-step';

const CATEGORY_OPTIONS: { value: IncidentCategory; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'ASSAULT', label: 'Assault' },
  { value: 'STALKING', label: 'Stalking' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

type ReportStage = 'DETAILS' | 'LOCATION' | 'REVIEW';
type PickerMode = 'date' | 'time' | null;
type EditTarget = 'INCIDENT' | 'WHEN' | 'LOCATION' | 'DESCRIPTION';
type EditContext = { returnToReview: true; target: EditTarget } | null;
type DetailsErrors = { category?: string; occurredAt?: string; severity?: string };
type LocationErrors = { mode?: string; selection?: string };
type SubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success' };

const STAGE_NUMBER: Record<ReportStage, number> = { DETAILS: 1, LOCATION: 2, REVIEW: 3 };

export function IncidentReportScreen() {
  const { accessToken, actor } = useAuth();
  const router = useRouter();
  const [draft, dispatch] = useReducer(
    reportDraftReducer,
    undefined,
    () => createReportDraft(Crypto.randomUUID()),
  );
  const [stage, setStage] = useState<ReportStage>('DETAILS');
  const [editContext, setEditContext] = useState<EditContext>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [detailsErrors, setDetailsErrors] = useState<DetailsErrors>({});
  const [locationErrors, setLocationErrors] = useState<LocationErrors>({});
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' });
  const [myReportsVisible, setMyReportsVisible] = useState(false);
  const [privacySheetVisible, setPrivacySheetVisible] = useState(false);
  const submissionInFlight = useRef(false);
  const descriptionInputRef = useRef<TextInput>(null);
  const privacyTriggerRef = useRef<View>(null);

  useEffect(() => {
    if (stage !== 'DETAILS' || editContext?.target !== 'DESCRIPTION') return;
    setDescriptionExpanded(true);
    const frame = requestAnimationFrame(() => descriptionInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editContext, stage]);

  if (!accessToken || !actor) return null;

  function changeLocationMode(mode: IncidentLocationMode): void {
    dispatch({ type: 'SET_LOCATION_MODE', mode });
    setLocationErrors({});
  }

  function closePrivacySheet(): void {
    setPrivacySheetVisible(false);
    requestAnimationFrame(() => {
      const node = findNodeHandle(privacyTriggerRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }

  function completeDetails(): void {
    const errors: DetailsErrors = {};
    if (!draft.category) errors.category = 'Choose an incident category.';
    if (!draft.severity) errors.severity = 'Choose an incident severity.';
    if (isTooFarInFuture(draft.occurredAt)) {
      errors.occurredAt = 'Choose a date and time that is not in the future.';
    }
    setDetailsErrors(errors);
    if (Object.keys(errors).length > 0) {
      AccessibilityInfo.announceForAccessibility(
        errors.category ?? errors.severity ?? errors.occurredAt ?? 'Review the required incident details.',
      );
      return;
    }

    setPickerMode(null);
    if (editContext?.returnToReview) {
      setEditContext(null);
      setStage('REVIEW');
      return;
    }
    setStage('LOCATION');
  }

  function completeLocation(): void {
    const errors: LocationErrors = {};
    if (!draft.locationMode) {
      errors.mode = 'Choose how you want to share the incident location.';
    } else if (!hasSelectedLocation(draft)) {
      errors.selection = draft.locationMode === 'EXACT_PRIVATE'
        ? 'Choose a private exact location before continuing.'
        : 'Choose an approximate area before continuing.';
    }
    setLocationErrors(errors);
    if (Object.keys(errors).length > 0) {
      AccessibilityInfo.announceForAccessibility(
        errors.mode ?? errors.selection ?? 'Review the required location details.',
      );
      return;
    }

    if (editContext?.returnToReview) setEditContext(null);
    setStage('REVIEW');
  }

  function openReviewEdit(target: EditTarget): void {
    setSubmission({ status: 'idle' });
    setEditContext({ returnToReview: true, target });
    if (target === 'LOCATION') {
      setStage('LOCATION');
      return;
    }
    if (target === 'WHEN') setPickerMode('date');
    if (target === 'DESCRIPTION') setDescriptionExpanded(true);
    setStage('DETAILS');
  }

  function goBack(): void {
    setPickerMode(null);
    if (editContext?.returnToReview) {
      setEditContext(null);
      setStage('REVIEW');
      return;
    }
    if (stage === 'REVIEW') setStage('LOCATION');
    if (stage === 'LOCATION') setStage('DETAILS');
  }

  function startAnotherReport(): void {
    dispatch({ type: 'RESET', clientSubmissionId: Crypto.randomUUID(), occurredAt: new Date() });
    setStage('DETAILS');
    setEditContext(null);
    setDescriptionExpanded(false);
    setPickerMode(null);
    setDetailsErrors({});
    setLocationErrors({});
    setSubmission({ status: 'idle' });
  }

  async function submitReport(): Promise<void> {
    if (submissionInFlight.current) return;
    const submissionToken = accessToken;
    if (!submissionToken) return;

    let input: CreateIncidentInput;
    try {
      input = createSubmissionInput(draft);
    } catch {
      setSubmission({ status: 'error', message: 'Review the required report details before submitting.' });
      return;
    }

    submissionInFlight.current = true;
    setSubmission({ status: 'submitting' });
    try {
      await incidentApi.create(submissionToken, input);
      setSubmission({ status: 'success' });
    } catch (error) {
      setSubmission({ status: 'error', message: submissionMessage(error) });
    } finally {
      submissionInFlight.current = false;
    }
  }

  if (myReportsVisible) {
    return (
      <Screen contentStyle={styles.historyContent}>
        <MyReportsPanel
          accessToken={accessToken}
          actorId={actor.id}
          onClose={() => setMyReportsVisible(false)}
        />
      </Screen>
    );
  }

  if (submission.status === 'submitting') {
    return <Screen contentStyle={styles.content}><SubmittingResult /></Screen>;
  }

  if (submission.status === 'success') {
    return (
      <Screen contentStyle={styles.content}>
        <ConfirmationResult
          exactPrivate={draft.locationMode === 'EXACT_PRIVATE'}
          onShowMyReports={() => setMyReportsVisible(true)}
          onReturnToMap={() => router.navigate('/map')}
          onReportAnother={startAnotherReport}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding contentStyle={styles.content}>
      <ReportHeader stage={stage} onShowMyReports={() => setMyReportsVisible(true)} />

      {stage === 'DETAILS' ? (
        <DetailsStage
          draft={draft}
          dispatch={dispatch}
          descriptionExpanded={descriptionExpanded}
          descriptionInputRef={descriptionInputRef}
          editTarget={editContext?.target ?? null}
          errors={detailsErrors}
          pickerMode={pickerMode}
          privacyTriggerRef={privacyTriggerRef}
          returningToReview={editContext?.returnToReview === true}
          onContinue={completeDetails}
          onClearError={(field) => setDetailsErrors((current) => ({ ...current, [field]: undefined }))}
          onPickerModeChange={setPickerMode}
          onDescriptionExpandedChange={setDescriptionExpanded}
          onShowPrivacyDetails={() => setPrivacySheetVisible(true)}
        />
      ) : null}

      {stage === 'LOCATION' ? (
        <LocationStage
          accessToken={accessToken}
          draft={draft}
          dispatch={dispatch}
          errors={locationErrors}
          privacyTriggerRef={privacyTriggerRef}
          returningToReview={editContext?.returnToReview === true}
          onBack={goBack}
          onChangeMode={changeLocationMode}
          onClearSelectionError={() => setLocationErrors((current) => ({ ...current, selection: undefined }))}
          onContinue={completeLocation}
          onShowPrivacyDetails={() => setPrivacySheetVisible(true)}
        />
      ) : null}

      {stage === 'REVIEW' ? (
        <ReviewStage
          draft={draft}
          submissionError={submission.status === 'error' ? submission.message : null}
          onBack={goBack}
          onChange={openReviewEdit}
          onSubmit={() => void submitReport()}
        />
      ) : null}

      <IncidentPrivacySheet visible={privacySheetVisible} onClose={closePrivacySheet} />

    </Screen>
  );
}

function ReportHeader({ stage, onShowMyReports }: { stage: ReportStage; onShowMyReports(): void }) {
  const number = STAGE_NUMBER[stage];
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: 3, now: number, text: `Step ${number} of 3` }}>
          <Text style={styles.eyebrow}>REPORT · STEP {number} OF 3</Text>
        </View>
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

function DetailsStage({
  draft,
  dispatch,
  descriptionExpanded,
  descriptionInputRef,
  editTarget,
  errors,
  pickerMode,
  privacyTriggerRef,
  returningToReview,
  onContinue,
  onClearError,
  onPickerModeChange,
  onDescriptionExpandedChange,
  onShowPrivacyDetails,
}: {
  draft: ReportDraft;
  dispatch: Dispatch<ReportDraftAction>;
  descriptionExpanded: boolean;
  descriptionInputRef: RefObject<TextInput | null>;
  editTarget: EditTarget | null;
  errors: DetailsErrors;
  pickerMode: PickerMode;
  privacyTriggerRef: RefObject<View | null>;
  returningToReview: boolean;
  onContinue(): void;
  onClearError(field: keyof DetailsErrors): void;
  onPickerModeChange(mode: PickerMode): void;
  onDescriptionExpandedChange(expanded: boolean): void;
  onShowPrivacyDetails(): void;
}) {
  const categoryHeadingRef = useRef<Text>(null);
  const severityHeadingRef = useRef<Text>(null);
  const occurredAtHeadingRef = useRef<Text>(null);

  useEffect(() => {
    if (editTarget === 'INCIDENT') focusForAccessibility(categoryHeadingRef);
    if (editTarget === 'WHEN') focusForAccessibility(occurredAtHeadingRef);
  }, [editTarget]);

  useEffect(() => {
    const firstInvalid = errors.category
      ? categoryHeadingRef
      : errors.severity
        ? severityHeadingRef
        : errors.occurredAt
          ? occurredAtHeadingRef
          : null;
    if (firstInvalid) focusForAccessibility(firstInvalid);
  }, [errors]);

  function pickerChanged(event: DateTimePickerEvent, selected?: Date): void {
    if (Platform.OS === 'android') onPickerModeChange(null);
    if (event.type === 'set' && selected) {
      dispatch({ type: 'SET_OCCURRED_AT', occurredAt: selected });
      onClearError('occurredAt');
    }
  }

  return (
    <StepLayout title="What happened?">
      <PrivacyGuidance
        triggerRef={privacyTriggerRef}
        onPress={onShowPrivacyDetails}
        showMessage
      />

      <FormSection
        headingRef={categoryHeadingRef}
        title="Incident category"
        description="Choose one category.">
        {CATEGORY_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.value}
            label={option.label}
            selected={draft.category === option.value}
            onPress={() => {
              dispatch({ type: 'SET_CATEGORY', category: option.value });
              onClearError('category');
            }}
          />
        ))}
        <ValidationMessage message={errors.category} />
      </FormSection>

      <FormSection headingRef={severityHeadingRef} title="How serious was it?">
        <View style={styles.compactChoices}>
          {SEVERITY_OPTIONS.map((option) => (
            <ChoiceCard
              compact
              key={option.value}
              label={option.label}
              selected={draft.severity === option.value}
              onPress={() => {
                dispatch({ type: 'SET_SEVERITY', severity: option.value });
                onClearError('severity');
              }}
            />
          ))}
        </View>
        <ValidationMessage message={errors.severity} />
      </FormSection>

      <FormSection
        headingRef={occurredAtHeadingRef}
        title="When did it happen?"
        description="Choose the incident date and time, not the submission time.">
        <View style={styles.dateCard}>
          <Text style={styles.dateValue}>{draft.occurredAt.toLocaleString()}</Text>
          <View style={styles.inlineButtons}>
            <SmallAction label="Change date" onPress={() => onPickerModeChange('date')} />
            <SmallAction label="Change time" onPress={() => onPickerModeChange('time')} />
          </View>
        </View>
        {pickerMode ? (
          <View style={styles.pickerCard}>
            <DateTimePicker
              value={draft.occurredAt}
              mode={pickerMode}
              maximumDate={new Date()}
              onChange={pickerChanged}
            />
            {Platform.OS === 'ios' ? <SmallAction label="Done" onPress={() => onPickerModeChange(null)} /> : null}
          </View>
        ) : null}
        <ValidationMessage message={errors.occurredAt} />
      </FormSection>

      <FormSection title="Details" description="Optional · maximum 500 characters">
        {!descriptionExpanded ? (
          <SmallAction label="+ Add details (optional)" onPress={() => onDescriptionExpandedChange(true)} />
        ) : (
          <View style={styles.descriptionBlock}>
            <Text style={styles.privacyWarning}>
              Do not include names, phone numbers, addresses, or other information that could identify you or another person.
            </Text>
            <TextInput
              ref={descriptionInputRef}
              accessibilityLabel="Optional incident description"
              multiline
              maxLength={500}
              onChangeText={(description) => dispatch({ type: 'SET_DESCRIPTION', description })}
              placeholder="Brief, non-identifying details"
              placeholderTextColor={palette.textMuted}
              style={styles.descriptionInput}
              textAlignVertical="top"
              value={draft.description}
            />
            <Text style={styles.characterCount}>{draft.description.length}/500</Text>
            <SmallAction
              label="Remove details"
              onPress={() => {
                dispatch({ type: 'SET_DESCRIPTION', description: '' });
                onDescriptionExpandedChange(false);
              }}
            />
          </View>
        )}
      </FormSection>

      <PrimaryButton label={returningToReview ? 'Back to review' : 'Continue'} onPress={onContinue} />
    </StepLayout>
  );
}

function LocationStage({
  accessToken,
  draft,
  dispatch,
  errors,
  privacyTriggerRef,
  returningToReview,
  onBack,
  onChangeMode,
  onClearSelectionError,
  onContinue,
  onShowPrivacyDetails,
}: {
  accessToken: string;
  draft: ReportDraft;
  dispatch: Dispatch<ReportDraftAction>;
  errors: LocationErrors;
  privacyTriggerRef: RefObject<View | null>;
  returningToReview: boolean;
  onBack(): void;
  onChangeMode(mode: IncidentLocationMode): void;
  onClearSelectionError(): void;
  onContinue(): void;
  onShowPrivacyDetails(): void;
}) {
  const modeHeadingRef = useRef<Text>(null);
  const selectionHeadingRef = useRef<Text>(null);

  useEffect(() => {
    const firstInvalid = errors.mode ? modeHeadingRef : errors.selection ? selectionHeadingRef : null;
    if (firstInvalid) focusForAccessibility(firstInvalid);
  }, [errors]);

  useEffect(() => {
    if (returningToReview) focusForAccessibility(modeHeadingRef);
  }, [returningToReview]);

  return (
    <StepLayout title="Where did it happen?">
      <FormSection
        headingRef={modeHeadingRef}
        title="Location privacy"
        description="Choose how you want to share the location.">
        <ChoiceCard
          label="Use exact location privately"
          description="Your selected point is kept private. The public map shows an approximate area."
          selected={draft.locationMode === 'EXACT_PRIVATE'}
          onPress={() => onChangeMode('EXACT_PRIVATE')}
        />
        <ChoiceCard
          label="Choose an approximate area"
          description="No device location is requested or captured for this choice."
          selected={draft.locationMode === 'APPROXIMATE_ONLY'}
          onPress={() => onChangeMode('APPROXIMATE_ONLY')}
        />
        <ValidationMessage message={errors.mode} />
      </FormSection>

      <PrivacyGuidance triggerRef={privacyTriggerRef} onPress={onShowPrivacyDetails} />

      {draft.locationMode ? (
        <FormSection
          headingRef={selectionHeadingRef}
          title={draft.locationMode === 'EXACT_PRIVATE' ? 'Select the private location' : 'Select an approximate area'}>
          {draft.locationMode === 'EXACT_PRIVATE' ? (
            <ExactLocationSelector
              location={draft.exactLocation}
              source={draft.exactLocationSource}
              onSelect={(location, source) => {
                dispatch({ type: 'SET_EXACT_LOCATION', location, source });
                onClearSelectionError();
              }}
              onChooseApproximate={() => onChangeMode('APPROXIMATE_ONLY')}
            />
          ) : (
            <ApproximateLocationSelector
              accessToken={accessToken}
              selectedCellId={draft.selectedAreaCellId}
              onSelectCell={(cellId) => {
                dispatch({ type: 'SET_SELECTED_CELL', cellId });
                if (cellId) onClearSelectionError();
              }}
            />
          )}
          <ValidationMessage message={errors.selection} />
        </FormSection>
      ) : null}

      {!returningToReview ? <PrimaryButton label="Back" variant="secondary" onPress={onBack} /> : null}
      <PrimaryButton label={returningToReview ? 'Back to review' : 'Continue'} onPress={onContinue} />
    </StepLayout>
  );
}

function ReviewStage({
  draft,
  submissionError,
  onBack,
  onChange,
  onSubmit,
}: {
  draft: ReportDraft;
  submissionError: string | null;
  onBack(): void;
  onChange(target: EditTarget): void;
  onSubmit(): void;
}) {
  const category = CATEGORY_OPTIONS.find((option) => option.value === draft.category)?.label;
  const severity = SEVERITY_OPTIONS.find((option) => option.value === draft.severity)?.label;
  const description = draft.description.trim();

  return (
    <StepLayout title="Review your report" description="Check these details before submitting.">
      <ReviewSection
        title="Incident"
        value={`${category ?? 'Not selected'} · ${severity ?? 'Not selected'}`}
        actionLabel="Change incident details"
        onChange={() => onChange('INCIDENT')}
      />
      <ReviewSection
        title="When"
        value={draft.occurredAt.toLocaleString()}
        actionLabel="Change occurrence time"
        onChange={() => onChange('WHEN')}
      />
      <ReviewSection
        title="Location"
        value={draft.locationMode === 'EXACT_PRIVATE'
          ? 'Exact location stored privately; approximate area shown publicly'
          : 'Approximate area only'}
        actionLabel="Change report location"
        onChange={() => onChange('LOCATION')}
      />
      <ReviewSection
        title="Details"
        value={description || 'No additional details'}
        buttonLabel={description ? 'Change' : 'Add'}
        actionLabel={description ? 'Change report details' : 'Add report details'}
        onChange={() => onChange('DESCRIPTION')}
      />
      <InfoCard
        text={draft.locationMode === 'EXACT_PRIVATE'
          ? 'Your exact location is stored privately. The public map shows only an approximate area.'
          : 'Only the approximate area you selected will be submitted.'}
      />
      <ValidationMessage message={submissionError ?? undefined} />
      <PrimaryButton label="Back" variant="secondary" onPress={onBack} />
      <PrimaryButton label="Submit report" onPress={onSubmit} />
    </StepLayout>
  );
}

function SubmittingResult() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.fullState}>
      <Text accessibilityRole="header" style={styles.screenTitle}>Submitting report…</Text>
      <Text style={styles.bodyText}>Keep this screen open while HerPath securely sends your report.</Text>
      <PrimaryButton label="Submitting report…" loading disabled onPress={() => undefined} />
    </View>
  );
}

function ConfirmationResult({ exactPrivate, onShowMyReports, onReturnToMap, onReportAnother }: {
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
      <PrimaryButton label="Return to Map" onPress={onReturnToMap} />
      <PrimaryButton label="View My Reports" variant="secondary" onPress={onShowMyReports} />
      <PrimaryButton label="Report another incident" variant="secondary" onPress={onReportAnother} />
    </View>
  );
}

function StepLayout({ title, description, children }: React.PropsWithChildren<{ title: string; description?: string }>) {
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

function FormSection({ headingRef, title, description, children }: React.PropsWithChildren<{
  headingRef?: RefObject<Text | null>;
  title: string;
  description?: string;
}>) {
  return (
    <View style={styles.formSection}>
      <View style={styles.sectionHeading}>
        <Text ref={headingRef} accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ChoiceCard({ label, description, selected, compact = false, onPress }: {
  label: string;
  description?: string;
  selected: boolean;
  compact?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        compact && styles.compactChoice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}>
      <View style={styles.choiceHeading}>
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
        <MaterialIcons
          name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
          size={22}
          color={selected ? palette.primary : palette.textMuted}
        />
      </View>
      {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
    </Pressable>
  );
}

function InfoCard({ text }: { text: string }) {
  return <View style={styles.infoCard}><Text style={styles.infoText}>{text}</Text></View>;
}

function PrivacyGuidance({ triggerRef, showMessage = false, onPress }: {
  triggerRef: RefObject<View | null>;
  showMessage?: boolean;
  onPress(): void;
}) {
  return (
    <View style={[styles.privacyGuidance, !showMessage && styles.privacyGuidanceCompact]}>
      {showMessage ? (
        <Text style={styles.privacyGuidanceText}>Public map views always use an approximate area.</Text>
      ) : null}
      <Pressable
        ref={triggerRef}
        accessibilityHint="Opens privacy details without changing your report"
        accessibilityLabel="How location privacy works"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.privacyTrigger, pressed && styles.pressed]}>
        <MaterialIcons name="privacy-tip" size={20} color={palette.primary} />
        <Text style={styles.privacyTriggerText}>How location privacy works</Text>
      </Pressable>
    </View>
  );
}

function ReviewSection({ title, value, buttonLabel = 'Change', actionLabel, onChange }: {
  title: string;
  value: string;
  buttonLabel?: string;
  actionLabel: string;
  onChange(): void;
}) {
  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewCopy}>
        <Text style={styles.reviewLabel}>{title}</Text>
        <Text style={styles.reviewValue}>{value}</Text>
      </View>
      <SmallAction accessibilityLabel={actionLabel} label={buttonLabel} onPress={onChange} />
    </View>
  );
}

function ValidationMessage({ message }: { message?: string }) {
  return message ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{message}</Text> : null;
}

function SmallAction({ label, accessibilityLabel = label, onPress }: {
  label: string;
  accessibilityLabel?: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
      <Text style={styles.smallActionText}>{label}</Text>
    </Pressable>
  );
}

function isTooFarInFuture(value: Date): boolean {
  return value.getTime() > Date.now() + 5 * 60_000;
}

function focusForAccessibility(target: RefObject<Text | null>): void {
  requestAnimationFrame(() => {
    const node = findNodeHandle(target.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  });
}

function createSubmissionInput(draft: ReportDraft): CreateIncidentInput {
  if (!draft.category || !draft.severity || !draft.locationMode || !hasSelectedLocation(draft)) {
    throw new Error('Report is incomplete');
  }

  const common = {
    clientSubmissionId: draft.clientSubmissionId,
    category: draft.category,
    severity: draft.severity,
    occurredAt: draft.occurredAt.toISOString(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
  };

  if (draft.locationMode === 'EXACT_PRIVATE' && draft.exactLocation) {
    return { ...common, location: { mode: 'EXACT_PRIVATE', privateLocation: draft.exactLocation } };
  }
  if (draft.locationMode === 'APPROXIMATE_ONLY' && draft.selectedAreaCellId) {
    return {
      ...common,
      location: { mode: 'APPROXIMATE_ONLY', selectedAreaCellId: draft.selectedAreaCellId },
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
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  headerCopy: { minWidth: 210, flex: 1, gap: spacing.xs },
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
  step: { gap: spacing.lg },
  stepHeading: { gap: spacing.xs },
  stepTitle: { color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  stepDescription: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  formSection: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  sectionTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '900' },
  sectionDescription: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  bodyText: { color: palette.text, fontSize: 16, lineHeight: 24 },
  infoCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surfaceMuted },
  infoText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  privacyGuidance: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  privacyGuidanceCompact: { alignItems: 'flex-start', padding: 0, backgroundColor: 'transparent' },
  privacyGuidanceText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  privacyTrigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  privacyTriggerText: { flexShrink: 1, color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: '800' },
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
  compactChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  compactChoice: { minWidth: 140, flexBasis: '47%', flexGrow: 1 },
  choiceSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: palette.surfaceMuted },
  choiceHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  choiceLabel: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '800' },
  choiceLabelSelected: { color: palette.primary },
  choiceDescription: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  dateCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.surface },
  dateValue: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '800' },
  inlineButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallAction: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: radius.md,
  },
  smallActionText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  pickerCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: palette.surface },
  descriptionBlock: { gap: spacing.sm },
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
  reviewSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  reviewCopy: { minWidth: 180, flex: 1, gap: spacing.xs },
  reviewLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  reviewValue: { color: palette.text, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  errorText: { color: palette.error, fontSize: 14, lineHeight: 21 },
  fullState: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
});
