/// <reference types="jest" />

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { PublicIncidentMarker } from '@/src/features/map/map.types';

import { ReportCommunityCard } from './report-community-card';

jest.mock('./report-community-panel', () => ({
  ReportCommunityPanel: () => null,
}));

const incident: PublicIncidentMarker = {
  id: '507f1f77bcf86cd799439011',
  category: 'HARASSMENT',
  severity: 'HIGH',
  status: 'PUBLISHED_UNVERIFIED',
  publicLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
  publicArea: {
    type: 'Polygon',
    coordinates: [[[79.86, 6.92], [79.87, 6.92], [79.87, 6.93], [79.86, 6.92]]],
  },
  occurredAt: '2026-08-24T10:00:00.000Z',
  createdAt: '2026-08-24T10:01:00.000Z',
  supportCount: 2,
};

describe('ReportCommunityCard', () => {
  it('expands community actions without triggering map focus', () => {
    const onToggle = jest.fn();
    const onShowOnMap = jest.fn();
    const screen = render(
      <ReportCommunityCard
        expanded={false}
        incident={incident}
        onShowOnMap={onShowOnMap}
        onToggle={onToggle}
      />,
    );

    const expand = screen.getByLabelText('Expand community actions for Harassment report');
    expect(expand.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(expand);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onShowOnMap).not.toHaveBeenCalled();
  });

  it('keeps map focus behind a separate accessible action', () => {
    const onShowOnMap = jest.fn();
    const screen = render(
      <ReportCommunityCard
        expanded
        incident={incident}
        onShowOnMap={onShowOnMap}
        onToggle={jest.fn()}
      />,
    );

    const collapse = screen.getByLabelText('Collapse community actions for Harassment report');
    expect(collapse.props.accessibilityState).toEqual({ expanded: true });
    fireEvent.press(screen.getByLabelText('Show Harassment report on map'));

    expect(onShowOnMap).toHaveBeenCalledTimes(1);
  });
});
