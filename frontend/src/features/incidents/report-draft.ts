import type {
  GeoJsonPoint,
  IncidentCategory,
  IncidentLocationMode,
  IncidentSeverity,
  OwnerIncident,
} from './incident.types';

export type ReportStep =
  | 'PRIVACY'
  | 'CATEGORY'
  | 'LOCATION_MODE'
  | 'LOCATION'
  | 'DATE_TIME'
  | 'SEVERITY'
  | 'DESCRIPTION'
  | 'REVIEW'
  | 'SUBMITTING'
  | 'CONFIRMATION'
  | 'MY_REPORTS';

export interface ReportDraftState {
  step: ReportStep;
  clientSubmissionId: string;
  category: IncidentCategory | null;
  locationMode: IncidentLocationMode | null;
  exactLocation: GeoJsonPoint | null;
  exactLocationSource: 'CURRENT' | 'MANUAL' | null;
  selectedAreaCellId: string | null;
  occurredAt: Date;
  severity: IncidentSeverity | null;
  description: string;
  submittedIncident: OwnerIncident | null;
  submissionError: string | null;
}

export type ReportDraftAction =
  | { type: 'GO_TO'; step: ReportStep }
  | { type: 'SET_CATEGORY'; category: IncidentCategory }
  | { type: 'SET_LOCATION_MODE'; mode: IncidentLocationMode }
  | { type: 'SET_EXACT_LOCATION'; location: GeoJsonPoint; source: 'CURRENT' | 'MANUAL' }
  | { type: 'SET_SELECTED_CELL'; cellId: string | null }
  | { type: 'SET_OCCURRED_AT'; occurredAt: Date }
  | { type: 'SET_SEVERITY'; severity: IncidentSeverity }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'SUBMIT_STARTED' }
  | { type: 'SUBMIT_FAILED'; message: string }
  | { type: 'SUBMIT_SUCCEEDED'; incident: OwnerIncident }
  | { type: 'RESET'; clientSubmissionId: string; occurredAt: Date };

export function createReportDraft(clientSubmissionId: string, occurredAt = new Date()): ReportDraftState {
  return {
    step: 'PRIVACY',
    clientSubmissionId,
    category: null,
    locationMode: null,
    exactLocation: null,
    exactLocationSource: null,
    selectedAreaCellId: null,
    occurredAt,
    severity: null,
    description: '',
    submittedIncident: null,
    submissionError: null,
  };
}

export function reportDraftReducer(
  state: ReportDraftState,
  action: ReportDraftAction,
): ReportDraftState {
  switch (action.type) {
    case 'GO_TO':
      return { ...state, step: action.step };
    case 'SET_CATEGORY':
      return { ...state, category: action.category };
    case 'SET_LOCATION_MODE':
      return {
        ...state,
        locationMode: action.mode,
        exactLocation: null,
        exactLocationSource: null,
        selectedAreaCellId: null,
      };
    case 'SET_EXACT_LOCATION':
      return {
        ...state,
        exactLocation: action.location,
        exactLocationSource: action.source,
        selectedAreaCellId: null,
      };
    case 'SET_SELECTED_CELL':
      return { ...state, selectedAreaCellId: action.cellId, exactLocation: null };
    case 'SET_OCCURRED_AT':
      return { ...state, occurredAt: action.occurredAt };
    case 'SET_SEVERITY':
      return { ...state, severity: action.severity };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.description };
    case 'SUBMIT_STARTED':
      return { ...state, step: 'SUBMITTING', submissionError: null };
    case 'SUBMIT_FAILED':
      return { ...state, step: 'REVIEW', submissionError: action.message };
    case 'SUBMIT_SUCCEEDED':
      return {
        ...state,
        step: 'CONFIRMATION',
        submittedIncident: action.incident,
        submissionError: null,
      };
    case 'RESET':
      return createReportDraft(action.clientSubmissionId, action.occurredAt);
  }
}

export function hasSelectedLocation(state: ReportDraftState): boolean {
  if (state.locationMode === 'EXACT_PRIVATE') return state.exactLocation !== null;
  if (state.locationMode === 'APPROXIMATE_ONLY') return state.selectedAreaCellId !== null;
  return false;
}
