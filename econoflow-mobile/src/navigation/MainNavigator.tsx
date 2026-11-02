import React, { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  TouchableOpacity, StyleSheet, View, useColorScheme,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ProjectStackNavigator } from './ProjectStackNavigator';
import { OverviewStackNavigator } from './OverviewStackNavigator';
import { PlansStackNavigator } from './PlansStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { QuickAddModal } from '../screens/quick-add/QuickAddModal';
import { NotificationPermissionPrompt } from '../components/notifications/NotificationPermissionPrompt';
import { useQuickAddStore } from '../store/quickAddStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { currentMonth } from '../utils/date';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type MainTabParamList = {
  Projects:  undefined;
  Overview:  undefined;
  AddAction: undefined;   // phantom tab — never rendered, press intercepted
  Plans:     undefined;
  Profile:   undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Invisible placeholder so the tab slot is occupied
function EmptyScreen() { return null; }

/**
 * A background painter under the tabs, and the sign the signed-in tree is rendering.
 *
 * A screen that renders `null` leaves a blank window, so after #1116 this fills the wrapper
 * behind the navigator instead. **It must not take part in the column's layout**: it used to be
 * `flex: 1`, and because the tab navigator's outer box (`SafeAreaProviderCompat`) is also
 * `flex: 1`, the wrapper split its height evenly between the two and every tab started halfway
 * down — content began at exactly 50.0% of the window (row 693 of 1386) on the device that
 * reported it. Absolutely positioned, it paints without occupying anything, so the navigator
 * gets the full height exactly as it did before #1116.
 */
function BackgroundPainter() {
  return <View style={styles.painter} testID="overview-screen" pointerEvents="none" />;
}

/**
 * The entry point of the signed-in tree.
 *
 * #1116 added a background "painter" here — an empty `flex: 1` `View` rendered as a **sibling**
 * of `<Tab.Navigator>`, so the window would still draw the app background on the frame between
 * two `reset`s. It is not there any more, and must not come back in that shape: the tab
 * navigator's own outer box (`SafeAreaProviderCompat`) is `flex: 1`, so the wrapper contained
 * **two** `flex: 1` children and split its height between them. Every tab then started halfway
 * down the window — measured at exactly 50.0% (row 693 of 1386) on the device that reported
 * it — while the tab bar sat at its usual place and the Login/PIN screens, outside this
 * wrapper, were unaffected.
 *
 * The tab navigator draws its own background for every route, so nothing is left to paint.
 */
export const MainNavigator: React.FC = () => {
  const { t }  = useTranslation();
  const dark   = useColorScheme() === 'dark';
  const barBg  = dark ? 'rgba(6,30,51,0.92)' : 'rgba(230,239,246,0.92)';
  const barBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.08)';
  const hideTabBar = useUIStore((s) => s.hideTabBar);
  const openCreateProjectOnStart = useAuthStore((s) => s.openCreateProjectOnStart);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const quickAddCategoryId = useQuickAddStore(s => s.categoryId);
  const quickAddDefaultType = useQuickAddStore(s => s.defaultType);
  const quickAddViewedMonth = useQuickAddStore(s => s.viewedMonth);

  return (
    // The wrapper's `testID` is the signed-in marker of the integration tests (e2e/):
    // reaching it is what "the customer is logged in on the app" means, whatever path —
    // login, 2FA or the registration's auto-login — got them here.
    <View style={styles.flex} testID="main-navigator">
    {/* Paints behind the tabs without taking height from them — see `BackgroundPainter`. */}
    <BackgroundPainter />
    <Tab.Navigator
      initialRouteName={openCreateProjectOnStart ? 'Projects' : 'Overview'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: hideTabBar
          ? { display: 'none' as const }
          : {
            backgroundColor: barBg,
            borderTopColor: barBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
        tabBarActiveTintColor:   '#0f76a8',
        tabBarInactiveTintColor: dark ? '#8aa0b6' : '#9aa9b8',
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, IconName> = {
            Projects:  'folder-multiple-outline',
            Overview:  'view-dashboard-outline',
            Plans:     'bullseye-arrow',
            Profile:   'account-circle-outline',
            AddAction: 'plus',
          };
          return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{
          tabBarLabel: t('TabProjects'),
          // The tab bar sets no testIDs of its own, so the integration tests (e2e/) find
          // the tabs by these ids and assert where the app opened. Set per screen, not on
          // the global options, or all of them would share one id.
          tabBarButtonTestID: 'tab-projects',
        }}
      />
      <Tab.Screen
        name="Overview"
        component={OverviewStackNavigator}
        options={{
          tabBarLabel: t('TabOverview'),
          // The app opens here unless a first project is being created: the one assertion
          // that says "logged in, on the page the customer expects".
          tabBarButtonTestID: 'tab-overview',
        }}
      />

      {/* ── Centre FAB ─────────────────────────────────────────────────── */}
      <Tab.Screen
        name="AddAction"
        component={EmptyScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: ({ onPress }) => (
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.85}
              style={styles.fabWrap}
            >
              <LinearGradient
                colors={['#0f76a8', '#14c08a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fab}
              >
                <MaterialCommunityIcons name="plus" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setQuickAddVisible(true);
          },
        }}
      />

      <Tab.Screen
        name="Plans"
        component={PlansStackNavigator}
        options={{ tabBarLabel: t('TabPlans'), tabBarButtonTestID: 'tab-plans' }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ headerShown: false, tabBarLabel: t('TabProfile'), tabBarButtonTestID: 'tab-profile' }}
      />
    </Tab.Navigator>

    <QuickAddModal
      visible={quickAddVisible}
      onClose={() => setQuickAddVisible(false)}
      month={quickAddViewedMonth ?? currentMonth()}
      defaultCategoryId={quickAddCategoryId ?? undefined}
      defaultType={quickAddDefaultType ?? undefined}
    />

    {/*
      First-login notification rationale + OS prompt (#1053). `Main` is the screen every
      authenticated path lands on — password login, registration auto-login, 2FA — and
      only after the biometric gate has run, so the Android 13+ permission dialog is
      requested once the navigator has settled instead of racing a system prompt. The
      component renders nothing once the user has answered.
    */}
    <NotificationPermissionPrompt />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Takes no space in the column: a `flex: 1` sibling of the tab navigator split the screen in
  // half (see `BackgroundPainter`). Written out rather than spread from
  // `StyleSheet.absoluteFillObject`, which the test renderer's `StyleSheet` does not populate.
  painter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  fabWrap: {
    top: -16,            // lifts the FAB above the tab bar
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(15,118,168,0.5)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
});
