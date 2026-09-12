import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, radius, spacing } from '@/src/theme';

import { Destination } from './types';
import { useDestinationSearch } from './useDestinationSearch';

interface DestinationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDestination: (destination: Destination) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export function DestinationSearchModal({
  visible,
  onClose,
  onSelectDestination,
  userLocation,
}: DestinationSearchModalProps) {
  const { query, setQuery, results, loading, errorMessage, clearSearch } = useDestinationSearch({
    userLocation,
  });

  const handleSelect = (item: Destination) => {
    clearSearch();
    onSelectDestination(item);
    onClose();
  };

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header & Search Input */}
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close destination search"
              hitSlop={12}
              onPress={handleClose}
              style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={palette.text} />
            </Pressable>

            <View style={styles.searchInputContainer}>
              <MaterialIcons name="search" size={22} color={palette.primary} style={styles.searchIcon} />
              <TextInput
                accessible
                accessibilityLabel="Destination search text input"
                style={styles.searchInput}
                placeholder="Search destination or address..."
                placeholderTextColor={palette.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search text"
                  hitSlop={8}
                  onPress={() => setQuery('')}
                  style={styles.clearButton}>
                  <MaterialIcons name="close" size={20} color={palette.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Loading Indicator */}
          {loading ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.statusText}>Searching destinations...</Text>
            </View>
          ) : null}

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={20} color={palette.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Empty Prompt / Prompt to type */}
          {!loading && query.trim().length < 2 && !errorMessage ? (
            <View style={styles.emptyPrompt}>
              <MaterialIcons name="place" size={48} color={palette.border} />
              <Text style={styles.promptTitle}>Where would you like to go?</Text>
              <Text style={styles.promptSubtitle}>
                Type at least 2 characters to search for safe routes, places, and addresses.
              </Text>
            </View>
          ) : null}

          {/* No results state */}
          {!loading && query.trim().length >= 2 && results.length === 0 && !errorMessage ? (
            <View style={styles.emptyPrompt}>
              <MaterialIcons name="location-off" size={44} color={palette.textMuted} />
              <Text style={styles.promptTitle}>No places found</Text>
              <Text style={styles.promptSubtitle}>
                Try searching with a different landmark, street name, or city.
              </Text>
            </View>
          ) : null}

          {/* Results List */}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select destination ${item.name}, ${item.address}`}
                style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
                onPress={() => handleSelect(item)}>
                <View style={styles.pinIconContainer}>
                  <MaterialIcons name="location-on" size={22} color={palette.primary} />
                </View>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={2}>
                    {item.address}
                  </Text>
                </View>
                <MaterialIcons name="north-west" size={18} color={palette.textMuted} />
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text,
    paddingVertical: 8,
  },
  clearButton: {
    padding: spacing.xs,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FEE4E2',
  },
  errorText: {
    flex: 1,
    color: palette.error,
    fontSize: 14,
  },
  emptyPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  promptTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  promptSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 56,
  },
  resultItemPressed: {
    backgroundColor: palette.surfaceMuted,
  },
  pinIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F3F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  resultAddress: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
