import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import type { SupportPlaceCategory } from './map.types';

export const supportPlacePresentation: Record<
  SupportPlaceCategory,
  {
    accessibilityLabel: string;
    icon: ComponentProps<typeof MaterialIcons>['name'];
    label: string;
  }
> = {
  POLICE: {
    accessibilityLabel: 'Police station support place',
    icon: 'local-police',
    label: 'Police station',
  },
  MEDICAL: {
    accessibilityLabel: 'Hospital or medical centre support place',
    icon: 'local-hospital',
    label: 'Hospital / medical centre',
  },
  EMERGENCY: {
    accessibilityLabel: 'Emergency service support place',
    icon: 'emergency',
    label: 'Emergency service',
  },
  WOMENS_SUPPORT: {
    accessibilityLabel: "Women's support centre or shelter",
    icon: 'volunteer-activism',
    label: "Women's support centre / shelter",
  },
  COUNSELLING_SUPPORT: {
    accessibilityLabel: 'Counselling or support organisation',
    icon: 'psychology',
    label: 'Counselling / support organisation',
  },
};
