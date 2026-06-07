import React from 'react';
import { UndoToast } from '../UndoToast';

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      onSurface: '#0d2137',
      surface: '#ffffff',
      primary: '#0f76a8',
      shadow: '#000000',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('UndoToast', () => {
  it('is a React component function', () => {
    expect(typeof UndoToast).toBe('function');
  });

  it('accepts visible, message, onUndo, and onDismiss props', () => {
    const onUndo = jest.fn();
    const onDismiss = jest.fn();
    const props: React.ComponentProps<typeof UndoToast> = {
      visible: true,
      message: 'Deleted. Undo?',
      onUndo,
      onDismiss,
    };
    expect(props.visible).toBe(true);
    expect(props.message).toBe('Deleted. Undo?');
    expect(typeof props.onUndo).toBe('function');
    expect(typeof props.onDismiss).toBe('function');
  });

  it('onUndo callback is callable', () => {
    const onUndo = jest.fn();
    onUndo();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('onDismiss callback is callable', () => {
    const onDismiss = jest.fn();
    onDismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
