import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NotificationPermissionPrompt } from '../NotificationPermissionPrompt';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// `@expo/vector-icons` pulls in expo-font → expo-asset, which the Jest transform does not
// resolve; the icon is decoration here.
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', surface: '#ffffff' },
  }),
}));

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: label },
        React.createElement(Text, null, label),
      ),
  };
});

const mockRequestNotificationPermissionAndRegister = jest.fn();

jest.mock('../../../hooks/usePushNotifications', () => ({
  requestNotificationPermissionAndRegister: (...args: unknown[]) =>
    mockRequestNotificationPermissionAndRegister(...args),
  openNotificationSettings: jest.fn(),
}));

const mockPrompt = {
  shouldShowRationale: false,
  permissionDenied: false,
  canAskForPermission: true,
  request: jest.fn(),
  dismissPermissionDenied: jest.fn(),
};

jest.mock('../../../hooks/useNotificationPermissionPrompt', () => ({
  useNotificationPermissionPrompt: () => mockPrompt,
}));

describe('NotificationPermissionPrompt (#1053)', () => {
  beforeEach(() => {
    mockRequestNotificationPermissionAndRegister.mockReset();
    mockPrompt.request.mockReset();
    mockPrompt.dismissPermissionDenied.mockReset();
    mockPrompt.shouldShowRationale = false;
    mockPrompt.permissionDenied = false;
    mockPrompt.canAskForPermission = true;
  });

  it('shows the rationale when the permission was never answered', async () => {
    mockPrompt.shouldShowRationale = true;

    await render(<NotificationPermissionPrompt />);

    expect(screen.getByTestId('notification-permission-rationale')).toBeTruthy();
    expect(screen.getByText('NotificationsPermissionRationaleTitle')).toBeTruthy();
  });

  it('does not render anything once the user answered', async () => {
    await render(<NotificationPermissionPrompt />);

    expect(screen.queryByTestId('notification-permission-rationale')).toBeNull();
  });

  it('runs the permission flow when the rationale is accepted', async () => {
    mockPrompt.shouldShowRationale = true;

    await render(<NotificationPermissionPrompt />);
    fireEvent.press(screen.getByTestId('NotificationsPermissionAllow'));

    expect(mockPrompt.request).toHaveBeenCalledTimes(1);
  });

  it('keeps the prompt suppressed when the rationale is skipped', async () => {
    mockPrompt.shouldShowRationale = true;

    await render(<NotificationPermissionPrompt />);
    fireEvent.press(screen.getByTestId('NotificationsPermissionNotNow'));

    // Skipping is an answer too: the OS prompt is not shown on the next login.
    expect(mockPrompt.request).not.toHaveBeenCalled();
    expect(mockPrompt.dismissPermissionDenied).toHaveBeenCalledTimes(1);
  });

  it('explains how to enable notifications in the system settings after a denial', async () => {
    mockPrompt.permissionDenied = true;
    mockPrompt.canAskForPermission = false;

    await render(<NotificationPermissionPrompt />);

    expect(screen.getByTestId('notification-permission-denied')).toBeTruthy();
    expect(screen.getByText('NotificationsPermissionDeniedGuidance')).toBeTruthy();
  });

  it('does not send the user to the settings while the OS can still be asked', async () => {
    // The hook never reports the denial without `canAskForPermission === false`, but the
    // component also must not be driven by half the state.
    mockPrompt.permissionDenied = false;
    mockPrompt.canAskForPermission = true;

    await render(<NotificationPermissionPrompt />);

    expect(screen.queryByTestId('notification-permission-denied')).toBeNull();
  });

  it('dismisses the denial guidance', async () => {
    mockPrompt.permissionDenied = true;
    mockPrompt.canAskForPermission = false;

    await render(<NotificationPermissionPrompt />);
    fireEvent.press(screen.getByTestId('NotificationPermissionDismiss'));

    expect(mockPrompt.dismissPermissionDenied).toHaveBeenCalledTimes(1);
  });

  it('never throws when the permission flow itself fails', async () => {
    // The button must not turn a rejected promise into an unhandled rejection; the flow
    // itself already reports failures through Sentry and `lastPermissionError`.
    mockPrompt.shouldShowRationale = true;
    mockPrompt.request.mockImplementation(async () => undefined);

    await render(<NotificationPermissionPrompt />);

    fireEvent.press(screen.getByTestId('NotificationsPermissionAllow'));

    await waitFor(() => expect(mockPrompt.request).toHaveBeenCalledTimes(1));
  });
});
