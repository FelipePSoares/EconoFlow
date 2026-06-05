import './src/i18n';
import { initSentry, navigationIntegration } from './src/monitoring/sentry';
import * as Sentry from '@sentry/react-native';
import React, { useCallback } from 'react';
import { View, useColorScheme } from 'react-native';
import {
  NavigationContainer,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigator } from './src/navigation/AppNavigator';

// Initialise Sentry before any React rendering.
// Disabled in dev builds; enabled in production releases.
initSentry();

// Stable ref shared between NavigationContainer and Sentry's navigation
// integration so that every screen transition is captured as a breadcrumb.
const navigationRef = createNavigationContainerRef();

// Keep the splash screen visible while the JS bundle and stores hydrate.
// hideAsync() is called in onLayout once the root View is measured.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Common semantic colour tokens ─────────────────────────────────────────────
const commonCustom = {
  success: '#2ecc71',
  warning: '#f39c12',
  income: '#2ecc71',
  expense: '#e74c3c',
  accentGreen: '#0e9f6e',
};

// ── Paper themes ──────────────────────────────────────────────────────────────
const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0f76a8',
    secondary: '#0c628c',
    tertiary: '#2ecc71',
    error: '#e74c3c',
    background: '#f5f8fc',
    surface: '#ffffff',
    surfaceVariant: '#f5f8fc',
    onSurface: '#0d2137',
    onBackground: '#0d2137',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#f8f9fa',
    },
  },
  customColors: { ...commonCustom },
};

const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4da7d6',
    secondary: '#6db8df',
    tertiary: '#2ecc71',
    error: '#e74c3c',
    background: '#0f1724',
    surface: '#172233',
    surfaceVariant: '#1d2b3e',
    onSurface: '#e6edf3',
    onBackground: '#e6edf3',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: '#172233',
      level2: '#1d2b3e',
    },
  },
  customColors: { ...commonCustom },
};

// ── Navigation themes ─────────────────────────────────────────────────────────
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

function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Hide the splash screen on first layout.
  // Add any async startup awaits inside this callback before hideAsync()
  // if you need to load fonts / prefetch data before the UI appears.
  const onLayout = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={isDark ? paperDarkTheme : paperLightTheme}>
          <SafeAreaProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={isDark ? navDarkTheme : navLightTheme}
              onReady={() => {
                navigationIntegration.registerNavigationContainer(navigationRef);
              }}
            >
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <AppNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </PaperProvider>
      </QueryClientProvider>
    </View>
  );
}

// Sentry.wrap adds an error boundary and performance timing around the root
// component.  It must be the outermost wrapper on the default export.
export default Sentry.wrap(App);
