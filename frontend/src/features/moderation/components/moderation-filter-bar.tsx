import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import type {
  ModerationAssignmentFilter,
  ModerationCaseState,
  ModerationPriority,
  ModerationQueueFilters,
} from '../moderation.types';

const ASSIGNMENT_OPTIONS: readonly {
  value: ModerationAssignmentFilter;
  label: string;
}[] = [
  { value: 'UNASSIGNED', label: 'Unassigned' },
  { value: 'MINE', label: 'Mine' },
  { value: 'ANY', label: 'All' },
];

const STATE_OPTIONS: readonly { value: ModerationCaseState; label: string }[] = [
  { value: 'QUEUED', label: 'Queued' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const PRIORITY_OPTIONS: readonly {
  value: ModerationPriority | undefined;
  label: string;
}[] = [
  { value: undefined, label: 'All' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

interface ModerationFilterBarProps {
  filters: ModerationQueueFilters;
  disabled?: boolean;
  onChange(filters: ModerationQueueFilters): void;
}

export function ModerationFilterBar({
  filters,
  disabled = false,
  onChange,
}: ModerationFilterBarProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <FilterGroup
        label="Assignment"
        options={ASSIGNMENT_OPTIONS}
        selected={filters.assignment}
        disabled={disabled}
        onSelect={(assignment) => onChange({ ...filters, assignment })}
      />
      <FilterGroup
        label="State"
        options={STATE_OPTIONS}
        selected={filters.state}
        disabled={disabled}
        onSelect={(state) => onChange({ ...filters, state })}
      />
      <FilterGroup
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={filters.priority}
        disabled={disabled}
        onSelect={(priority) =>
          onChange(
            priority === undefined
              ? { state: filters.state, assignment: filters.assignment }
              : { ...filters, priority },
          )
        }
      />
    </View>
  );
}

function FilterGroup<T extends string | undefined>({
  label,
  options,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: T;
  disabled: boolean;
  onSelect(value: T): void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value ?? 'ALL'}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && !disabled && styles.optionPressed,
                disabled && styles.optionDisabled,
              ]}>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  group: { gap: spacing.sm },
  groupLabel: { color: palette.text, fontSize: 14, fontWeight: '800' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 21,
    backgroundColor: palette.surface,
  },
  optionSelected: { borderColor: palette.primary, backgroundColor: palette.primary },
  optionPressed: { opacity: 0.76 },
  optionDisabled: { opacity: 0.55 },
  optionText: { color: palette.text, fontSize: 13, fontWeight: '700' },
  optionTextSelected: { color: palette.white },
});
