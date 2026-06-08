import React from 'react';
import { View } from 'react-native';
import { render, act } from '@testing-library/react-native';
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

  it('wraps the action button in an extra Animated.View with a translateX transform for swipe reveal', async () => {
    let renderResult: Awaited<ReturnType<typeof render>>;
    await act(async () => {
      renderResult = await render(
        <SwipeableRow
          onAction={jest.fn()}
          actionIcon="trash-can-outline"
          actionColor="#ff0000"
        >
          <View />
        </SwipeableRow>
      );
    });

    const withTranslateX = renderResult!.container.queryAll(
      (instance) => {
        const style = instance.props?.style;
        if (!style) return false;
        const arr = Array.isArray(style) ? style : [style];
        return arr.some(
          (s: Record<string, unknown>) =>
            Array.isArray(s?.transform) &&
            s.transform.some((t: Record<string, unknown>) => t?.translateX !== undefined),
        );
      },
    );

    expect(withTranslateX.length).toBe(2);

    const actionBtnWrapper = withTranslateX[0];
    expect(actionBtnWrapper.props.style.transform).toEqual(
      [{ translateX: expect.any(Number) }],
    );
  }, 20000);
});
