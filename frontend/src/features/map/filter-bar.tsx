import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { INCIDENT_CATEGORIES, SEVERITY_LEVELS, type DateRange, type MapFilter, type SeverityLevel, type TimeOfDay } from './map.types';

interface FilterBarProps {
  filter: MapFilter;
  onChangeFilter: (nextFilter: MapFilter) => void;
  topOffset?: number;
}

const dateOptions: { value: DateRange; label: string }[] = [{ value: 'all', label: 'Any date' }, { value: '24h', label: 'Past 24 hours' }, { value: '7d', label: 'Past 7 days' }, { value: '30d', label: 'Past 30 days' }];
const timeOptions: { value: TimeOfDay; label: string }[] = [{ value: 'all', label: 'Any time' }, { value: 'daytime', label: 'Daytime' }, { value: 'nighttime', label: 'Nighttime' }];

export function FilterBar({ filter, onChangeFilter, topOffset = spacing.sm }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const update = <K extends keyof MapFilter>(key: K, value: MapFilter[K]) => onChangeFilter({ ...filter, [key]: value });
  const activeFilterCount = Object.values(filter).filter((value) => value !== 'ALL' && value !== 'all').length;
  const clearFilters = () => onChangeFilter({ category: 'ALL', severity: 'ALL', dateRange: 'all', timeOfDay: 'all' });
  return <>
    <View style={[styles.bar, { top: topOffset }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open incident filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={() => setOpen(true)} style={styles.filterButton}>
        <MaterialIcons name="tune" size={20} color={palette.primary} />
        <Text style={styles.filterButtonText}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><View style={styles.sheet}>
        <View style={styles.header}><Text style={styles.title}>Filter reports</Text><Pressable accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={8} onPress={() => setOpen(false)}><MaterialIcons name="close" size={24} color={palette.text} /></Pressable></View>
        <FilterGroup label="Category" values={['ALL', ...INCIDENT_CATEGORIES]} selected={filter.category} onSelect={(value) => update('category', value as MapFilter['category'])} />
        <FilterGroup label="Severity" values={['ALL', ...SEVERITY_LEVELS]} selected={filter.severity} onSelect={(value) => update('severity', value as SeverityLevel | 'ALL')} />
        <FilterGroup label="Date" values={dateOptions.map((option) => option.value)} selected={filter.dateRange} labels={Object.fromEntries(dateOptions.map((option) => [option.value, option.label]))} onSelect={(value) => update('dateRange', value as DateRange)} />
        <FilterGroup label="Time" values={timeOptions.map((option) => option.value)} selected={filter.timeOfDay} labels={Object.fromEntries(timeOptions.map((option) => [option.value, option.label]))} onSelect={(value) => update('timeOfDay', value as TimeOfDay)} />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all incident filters" onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearText}>Clear all</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.doneButton}><Text style={styles.doneText}>Show reports</Text></Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}

function FilterGroup({ label, values, selected, labels = {}, onSelect }: { label: string; values: readonly string[]; selected: string; labels?: Record<string, string>; onSelect: (value: string) => void }) { return <View style={styles.group}><Text style={styles.groupLabel}>{label}</Text><View style={styles.options}>{values.map((value) => <Pressable key={value} accessibilityRole="button" onPress={() => onSelect(value)} style={[styles.option, selected === value && styles.optionActive]}><Text style={[styles.optionText, selected === value && styles.optionTextActive]}>{labels[value] ?? (value === 'ALL' ? `Any ${label.toLowerCase()}` : value[0] + value.slice(1).toLowerCase())}</Text></Pressable>)}</View></View>; }

const styles = StyleSheet.create({
  bar: { position: 'absolute', right: spacing.md, zIndex: 10, alignItems: 'flex-end' }, filterButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, elevation: 3, shadowColor: palette.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 4 }, filterButtonText: { color: palette.primary, fontWeight: '800', fontSize: 14 }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, sheet: { gap: spacing.lg, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: palette.surface }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: palette.text, fontSize: 20, fontWeight: '800' }, group: { gap: spacing.sm }, groupLabel: { color: palette.text, fontSize: 15, fontWeight: '800' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: palette.border }, optionActive: { backgroundColor: palette.primary, borderColor: palette.primary }, optionText: { color: palette.text, fontSize: 13, fontWeight: '700' }, optionTextActive: { color: palette.white }, actions: { flexDirection: 'row', gap: spacing.sm }, clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border }, clearText: { color: palette.primary, fontWeight: '800' }, doneButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.primary }, doneText: { color: palette.white, fontWeight: '800' },
});
