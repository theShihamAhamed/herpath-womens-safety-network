// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
  },
  {
    files: [
      'src/features/incidents/incident-privacy-sheet.tsx',
      'src/features/map/report-context-sheet.tsx',
      'src/features/routing/destination-results-sheet.tsx',
    ],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    files: ['src/features/map/map-screen.tsx'],
    rules: { 'react-hooks/purity': 'off' },
  },
  {
    files: [
      'src/features/incidents/incident-privacy-sheet.tsx',
      'src/features/journeys/components/FeedbackOverlay.tsx',
    ],
    rules: { 'react-hooks/refs': 'off' },
  },
  {
    files: [
      'src/features/incidents/incident-report-screen.tsx',
      'src/features/incidents/my-reports-panel.tsx',
      'src/features/journeys/screens/JourneyHistoryScreen.tsx',
      'src/features/map/map-screen.tsx',
      'src/features/moderation/components/moderation-reason-dialog.tsx',
      'src/features/moderation/hooks/use-moderation-audits.ts',
      'src/features/moderation/hooks/use-moderation-case.ts',
      'src/features/moderation/hooks/use-moderation-queue.ts',
      'src/features/moderation/screens/moderation-decision-screen.tsx',
      'src/features/routing/destination-search-modal.tsx',
      'src/features/routing/useDestinationSearch.ts',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]);
