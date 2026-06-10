import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AuroraPrimaryButton } from '../AuroraPrimaryButton';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Text: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children) };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

describe('AuroraPrimaryButton', () => {
  it('calls onPress when pressed and not disabled', async () => {
    const mockOnPress = jest.fn();
    await render(<AuroraPrimaryButton label="Go" onPress={mockOnPress} />);
    await fireEvent.press(screen.getByText('Go'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled prop is true', async () => {
    const mockOnPress = jest.fn();
    await render(<AuroraPrimaryButton label="Go" onPress={mockOnPress} disabled />);
    await fireEvent.press(screen.getByText('Go'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator and hides label when loading is true', async () => {
    await render(<AuroraPrimaryButton label="Go" onPress={jest.fn()} loading />);
    expect(screen.queryByText('Go')).toBeNull();
  });

  it('applies reduced opacity style when disabled prop is true', async () => {
    await render(<AuroraPrimaryButton label="Go" onPress={jest.fn()} disabled testID="test-btn" />);
    const btn = screen.getByTestId('test-btn');
    const flatStyle = StyleSheet.flatten(btn.props.style);
    expect(flatStyle?.opacity).toBe(0.6);
  });
});
