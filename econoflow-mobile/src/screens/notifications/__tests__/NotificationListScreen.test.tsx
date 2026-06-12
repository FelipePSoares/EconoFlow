import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { NotificationListScreen } from '../NotificationListScreen';
import type { AppNotification } from '../../../api/types';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(Text, props, children),
    IconButton: ({ onPress, testID }: { onPress: () => void; testID?: string }) =>
      React.createElement(TouchableOpacity, { onPress, testID, accessibilityRole: 'button' }),
    useTheme: () => ({
      colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    }),
  };
});

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: { income: '#2ecc71', expense: '#e74c3c' },
  }),
}));

jest.mock('../../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../components/common/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../hooks/useNotifications', () => ({
  useNotifications: jest.fn(),
  useMarkAsRead: jest.fn(),
  useMarkAllAsRead: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack } as unknown as Parameters<typeof NotificationListScreen>[0]['navigation'];

const notificationsMock = jest.requireMock('../../../hooks/useNotifications') as {
  useNotifications: jest.Mock;
  useMarkAsRead: jest.Mock;
  useMarkAllAsRead: jest.Mock;
};

describe('NotificationListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    notificationsMock.useMarkAsRead.mockReturnValue({ mutate: mockMarkAsRead, isPending: false });
    notificationsMock.useMarkAllAsRead.mockReturnValue({ mutate: mockMarkAllAsRead, isPending: false });
  });

  it('renders empty state when no notifications', async () => {
    notificationsMock.useNotifications.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    expect(screen.getByText('NoNotifications')).toBeTruthy();
  });

  it('renders loading indicator when loading', async () => {
    notificationsMock.useNotifications.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    // LoadingIndicator is mocked to null — no crash is the assertion
  });

  it('renders list of notification items', async () => {
    const notifications: AppNotification[] = [
      {
        id: 'n-1',
        codeMessage: 'TestCode1',
        actionLabelCode: '',
        type: 'Information',
        category: 'Finance',
        isActionRequired: false,
        isSticky: false,
        metadata: '',
      },
      {
        id: 'n-2',
        codeMessage: 'TestCode2',
        actionLabelCode: '',
        type: 'Information',
        category: 'System',
        isActionRequired: false,
        isSticky: false,
        metadata: '',
      },
    ];
    notificationsMock.useNotifications.mockReturnValue({ data: notifications, isLoading: false, isError: false, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    expect(screen.getByText('TestCode1')).toBeTruthy();
    expect(screen.getByText('TestCode2')).toBeTruthy();
  });

  it('calls markAsRead when a notification item is pressed', async () => {
    const notifications: AppNotification[] = [
      {
        id: 'n-1',
        codeMessage: 'TestCode1',
        actionLabelCode: '',
        type: 'Information',
        category: 'Finance',
        isActionRequired: false,
        isSticky: false,
        metadata: '',
      },
    ];
    notificationsMock.useNotifications.mockReturnValue({ data: notifications, isLoading: false, isError: false, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('TestCode1'));
    });
    expect(mockMarkAsRead).toHaveBeenCalledWith('n-1');
  });

  it('calls markAllAsRead when mark-all button is pressed', async () => {
    notificationsMock.useNotifications.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('mark-all-read-btn'));
    });
    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it('renders without crashing when there is an error', async () => {
    notificationsMock.useNotifications.mockReturnValue({ data: [], isLoading: false, isError: true, refetch: mockRefetch });
    await act(async () => {
      render(<NotificationListScreen navigation={mockNavigation} />);
    });
    // ErrorBanner is mocked to null; component must render without throwing
    expect(screen.getByTestId('mark-all-read-btn')).toBeTruthy();
  });
});
