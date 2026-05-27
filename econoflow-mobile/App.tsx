import './src/i18n';
import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Paper themes (component colours) ──────────────────────────────────────────
const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0f76a8',
    secondary: '#0c628c',
    background: '#f5f8fc',
    surface: '#ffffff',
    surfaceVariant: '#f5f8fc',
    onSurface: '#0d2137',
    onBackground: '#0d2137',
  },
};

const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4da7d6',
    secondary: '#6db8df',
    background: '#0f1724',
    surface: '#172233',
    surfaceVariant: '#1d2b3e',
    onSurface: '#e6edf3',
    onBackground: '#e6edf3',
  },
};

// ── Navigation themes (header / tab-bar colours) ───────────────────────────────
const navLightTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: '#0f76a8',
    background: '#f5f8fc',
    card: '#ffffff',
    border: '#d8e0ea',
    text: '#0d2137',
    notification: '#0f76a8',
  },
};

const navDarkTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: '#4da7d6',
    background: '#0f1724',
    card: '#172233',
    border: '#314357',
    text: '#e6edf3',
    notification: '#4da7d6',
  },
};

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
        <SafeAreaProvider>
          <NavigationContainer theme={isDark ? navDarkTheme : navLightTheme}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
