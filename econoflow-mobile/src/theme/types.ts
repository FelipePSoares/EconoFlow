import { MD3Theme } from 'react-native-paper';

export interface AppCustomColors {
  success: string;
  warning: string;
  income: string;
  expense: string;
  accentGreen: string;
}

export interface AppTheme extends MD3Theme {
  customColors: AppCustomColors;
}
