import type {
  GeoJsonPoint,
  IncidentCategory,
  IncidentLocationMode,
  IncidentSeverity,
} from './incident.types';

export interface ReportDraft {
  clientSubmissionId: string;
  category: IncidentCategory | null;
  locationMode: IncidentLocationMode | null;
  exactLocation: GeoJsonPoint | null;
  exactLocationSource: 'CURRENT' | 'MANUAL' | null;
  selectedAreaCellId: string | null;
  occurredAt: Date;
  severity: IncidentSeverity | null;
  description: string;
}

export type ReportDraftAction =
  | { type: 'SET_CATEGORY'; category: IncidentCategory }
  | { type: 'SET_LOCATION_MODE'; mode: IncidentLocationMode }
  | { type: 'SET_EXACT_LOCATION'; location: GeoJsonPoint; source: 'CURRENT' | 'MANUAL' }
  | { type: 'SET_SELECTED_CELL'; cellId: string | null }
  | { type: 'SET_OCCURRED_AT'; occurredAt: Date }
  | { type: 'SET_SEVERITY'; severity: IncidentSeverity }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'RESET'; clientSubmissionId: string; occurredAt: Date };

export function createReportDraft(clientSubmissionId: string, occurredAt = new Date()): ReportDraft {
  return {
    clientSubmissionId,
    category: null,
    locationMode: null,
    exactLocation: null,
    exactLocationSource: null,
    selectedAreaCellId: null,
    occurredAt,
    severity: null,
    description: '',
  };
}

export function reportDraftReducer(
  state: ReportDraft,
  action: ReportDraftAction,
): ReportDraft {
  switch (action.type) {
    case 'SET_CATEGORY':
      return { ...state, category: action.category };
    case 'SET_LOCATION_MODE':
      return {
        ...state,
        locationMode: action.mode,
        exactLocation: action.mode === 'EXACT_PRIVATE' ? state.exactLocation : null,
        exactLocationSource: action.mode === 'EXACT_PRIVATE' ? state.exactLocationSource : null,
        selectedAreaCellId: action.mode === 'APPROXIMATE_ONLY' ? state.selectedAreaCellId : null,
      };
    case 'SET_EXACT_LOCATION':
      return {
        ...state,
        exactLocation: action.location,
        exactLocationSource: action.source,
        selectedAreaCellId: null,
      };
    case 'SET_SELECTED_CELL':
      return {
        ...state,
        selectedAreaCellId: action.cellId,
        exactLocation: null,
        exactLocationSource: null,
      };
    case 'SET_OCCURRED_AT':
      return { ...state, occurredAt: action.occurredAt };
    case 'SET_SEVERITY':
      return { ...state, severity: action.severity };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.description };
    case 'RESET':
      return createReportDraft(action.clientSubmissionId, action.occurredAt);
  }
}

export function hasSelectedLocation(state: ReportDraft): boolean {
  if (state.locationMode === 'EXACT_PRIVATE') return state.exactLocation !== null;
  if (state.locationMode === 'APPROXIMATE_ONLY') return state.selectedAreaCellId !== null;
  return false;
}
