import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { INCIDENT_CATEGORIES, SEVERITY_LEVELS, type DateRange, type MapFilter, type SeverityLevel, type TimeOfDay } from './map.types';

interface FilterBarProps {
  filter: MapFilter;
  onChangeFilter: (nextFilter: MapFilter) => void;
  topOffset?: number;
  compactTrigger?: boolean;
}

const dateOptions: { value: DateRange; label: string }[] = [{ value: 'all', label: 'Any date' }, { value: '24h', label: 'Past 24 hours' }, { value: '7d', label: 'Past 7 days' }, { value: '30d', label: 'Past 30 days' }];
const timeOptions: { value: TimeOfDay; label: string }[] = [{ value: 'all', label: 'Any time' }, { value: 'daytime', label: 'Daytime' }, { value: 'nighttime', label: 'Nighttime' }];

export function FilterBar({ filter, onChangeFilter, topOffset = spacing.sm, compactTrigger = false }: FilterBarProps) {
  const { fontScale } = useWindowDimensions();
  const useLargeTextLayout = fontScale >= 1.35;
  const [open, setOpen] = useState(false);
  const update = <K extends keyof MapFilter>(key: K, value: MapFilter[K]) => onChangeFilter({ ...filter, [key]: value });
  const activeFilterCount = Object.values(filter).filter((value) => value !== 'ALL' && value !== 'all').length;
  const clearFilters = () => onChangeFilter({ category: 'ALL', severity: 'ALL', dateRange: 'all', timeOfDay: 'all' });
  return <>
    <View style={[styles.bar, { top: topOffset }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open incident filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={() => setOpen(true)} style={[styles.filterButton, compactTrigger && styles.filterButtonCompact]}>
        <MaterialIcons name="tune" size={20} color={palette.primary} />
        {!compactTrigger ? <Text style={styles.filterButtonText}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text> : null}
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.title}>Filter reports</Text><Pressable accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={8} onPress={() => setOpen(false)}><MaterialIcons name="close" size={24} color={palette.text} /></Pressable></View>
        <FilterGroup fullWidthOptions={useLargeTextLayout} label="Category" values={['ALL', ...INCIDENT_CATEGORIES]} selected={filter.category} onSelect={(value) => update('category', value as MapFilter['category'])} />
        <FilterGroup fullWidthOptions={useLargeTextLayout} label="Severity" values={['ALL', ...SEVERITY_LEVELS]} selected={filter.severity} onSelect={(value) => update('severity', value as SeverityLevel | 'ALL')} />
        <FilterGroup fullWidthOptions={useLargeTextLayout} label="Date" values={dateOptions.map((option) => option.value)} selected={filter.dateRange} labels={Object.fromEntries(dateOptions.map((option) => [option.value, option.label]))} onSelect={(value) => update('dateRange', value as DateRange)} />
        <FilterGroup fullWidthOptions={useLargeTextLayout} label="Time" values={timeOptions.map((option) => option.value)} selected={filter.timeOfDay} labels={Object.fromEntries(timeOptions.map((option) => [option.value, option.label]))} onSelect={(value) => update('timeOfDay', value as TimeOfDay)} />
        <View style={[styles.actions, useLargeTextLayout && styles.actionsStacked]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all incident filters" onPress={clearFilters} style={[styles.clearButton, useLargeTextLayout && styles.actionFullWidth]}><Text style={styles.clearText}>Clear all</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={[styles.doneButton, useLargeTextLayout && styles.actionFullWidth]}><Text style={styles.doneText}>Show reports</Text></Pressable>
        </View>
      </ScrollView></View>
    </Modal>
  </>;
}

function FilterGroup({ fullWidthOptions, label, values, selected, labels = {}, onSelect }: { fullWidthOptions: boolean; label: string; values: readonly string[]; selected: string; labels?: Record<string, string>; onSelect: (value: string) => void }) { return <View style={styles.group}><Text style={styles.groupLabel}>{label}</Text><View style={styles.options}>{values.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => onSelect(value)} style={[styles.option, fullWidthOptions && styles.optionFullWidth, selected === value && styles.optionActive]}><Text style={[styles.optionText, selected === value && styles.optionTextActive]}>{labels[value] ?? (value === 'ALL' ? `Any ${label.toLowerCase()}` : value[0] + value.slice(1).toLowerCase())}</Text></Pressable>)}</View></View>; }

const styles = StyleSheet.create({
  bar: { position: 'absolute', right: spacing.md, zIndex: 10, alignItems: 'flex-end' }, filterButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, elevation: 3, shadowColor: palette.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 4 }, filterButtonCompact: { width: 48, paddingHorizontal: 0 }, filterButtonText: { color: palette.primary, fontWeight: '800', fontSize: 14 }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, sheetScroll: { width: '100%', maxHeight: '90%' }, sheet: { gap: spacing.lg, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: palette.surface }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: palette.text, fontSize: 20, fontWeight: '800' }, group: { gap: spacing.sm }, groupLabel: { color: palette.text, fontSize: 15, fontWeight: '800' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: palette.border }, optionFullWidth: { width: '100%', minHeight: 48, justifyContent: 'center' }, optionActive: { backgroundColor: palette.primary, borderColor: palette.primary }, optionText: { color: palette.text, fontSize: 13, fontWeight: '700' }, optionTextActive: { color: palette.white }, actions: { flexDirection: 'row', gap: spacing.sm }, actionsStacked: { flexDirection: 'column' }, actionFullWidth: { width: '100%', flex: 0 }, clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border }, clearText: { color: palette.primary, fontWeight: '800' }, doneButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.primary }, doneText: { color: palette.white, fontWeight: '800' },
});
