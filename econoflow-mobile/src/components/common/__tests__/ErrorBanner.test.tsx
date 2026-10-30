import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBanner } from '../ErrorBanner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

type BannerAction = { label: string; onPress: () => void };

// react-native-paper is replaced by a stand-in that renders the message and exposes
// each action as a pressable, so the test drives the same callbacks the real Banner
// would call without depending on Paper's internals.
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Banner: ({
      visible, children, actions,
    }: {
      visible: boolean;
      children: React.ReactNode;
      actions: BannerAction[];
    }) => {
      if (!visible) return null;
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { testID: 'banner-message' }, children),
        ...actions.map((action) =>
          React.createElement(
            TouchableOpacity,
            { key: action.label, testID: `banner-action-${action.label}`, onPress: action.onPress },
            React.createElement(Text, null, action.label),
          ),
        ),
      );
    },
  };
});

describe('ErrorBanner', () => {
  it('renders nothing while not visible', async () => {
    await render(<ErrorBanner visible={false} onDismiss={jest.fn()} />);

    expect(screen.queryByTestId('banner-message')).toBeNull();
  });

  it('renders the given message', async () => {
    await render(<ErrorBanner visible message="Could not save" onDismiss={jest.fn()} />);

    expect(screen.getByTestId('banner-message')).toHaveTextContent('Could not save');
  });

  it('falls back to the generic error message when none is given', async () => {
    await render(<ErrorBanner visible onDismiss={jest.fn()} />);

    expect(screen.getByTestId('banner-message')).toHaveTextContent('ErrorGeneric');
  });

  it('offers only dismiss when no retry handler is passed', async () => {
    await render(<ErrorBanner visible message="Oops" onDismiss={jest.fn()} />);

    expect(screen.queryByTestId('banner-action-ButtonTryAgain')).toBeNull();
    expect(screen.queryByTestId('banner-action-ButtonDismiss')).not.toBeNull();
  });

  it('adds a try-again action ahead of dismiss when onRetry is given', async () => {
    await render(<ErrorBanner visible message="Oops" onDismiss={jest.fn()} onRetry={jest.fn()} />);

    expect(screen.queryByTestId('banner-action-ButtonTryAgain')).not.toBeNull();
    expect(screen.queryByTestId('banner-action-ButtonDismiss')).not.toBeNull();
  });

  it('calls onRetry and onDismiss from their respective actions', async () => {
    const onRetry = jest.fn();
    const onDismiss = jest.fn();
    await render(<ErrorBanner visible message="Oops" onDismiss={onDismiss} onRetry={onRetry} />);

    fireEvent.press(screen.getByTestId('banner-action-ButtonTryAgain'));
    fireEvent.press(screen.getByTestId('banner-action-ButtonDismiss'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
