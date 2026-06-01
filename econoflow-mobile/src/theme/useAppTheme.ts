import { useTheme } from 'react-native-paper';
import type { AppTheme } from './types';

export const useAppTheme = () => useTheme<AppTheme>();
