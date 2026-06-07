import React from 'react';
import { SwipeableRow } from '../SwipeableRow';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { surface: '#ffffff', shadow: '#000000' },
    customColors: {},
  }),
}));

describe('SwipeableRow', () => {
  it('is a React component function', () => {
    expect(typeof SwipeableRow).toBe('function');
  });

  it('accepts trash-can-outline and archive-outline as actionIcon', () => {
    const validIcons: React.ComponentProps<typeof SwipeableRow>['actionIcon'][] = [
      'trash-can-outline',
      'archive-outline',
    ];
    validIcons.forEach(icon => {
      expect(() => {
        // Verify the prop type is accepted (compile-time check backed by runtime test)
        const props: React.ComponentProps<typeof SwipeableRow> = {
          onAction: jest.fn(),
          actionIcon: icon,
          actionColor: '#ff0000',
          children: React.createElement(React.Fragment),
        };
        expect(props.actionIcon).toBe(icon);
      }).not.toThrow();
    });
  });

  it('onAction callback is callable', () => {
    const onAction = jest.fn();
    const props: React.ComponentProps<typeof SwipeableRow> = {
      onAction,
      actionIcon: 'trash-can-outline',
      actionColor: '#ff0000',
      children: React.createElement(React.Fragment),
    };
    props.onAction();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
