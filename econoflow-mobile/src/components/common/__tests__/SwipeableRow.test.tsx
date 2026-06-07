import React from 'react';
import { Animated, View } from 'react-native';
import { SwipeableRow } from '../SwipeableRow';
import TestRenderer, { act } from 'react-test-renderer';

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

  it('wraps the action button in an extra Animated.View with a translateX transform for swipe reveal', () => {
    let testRenderer: TestRenderer.ReactTestRenderer;
    act(() => {
      testRenderer = TestRenderer.create(
        <SwipeableRow
          onAction={jest.fn()}
          actionIcon="trash-can-outline"
          actionColor="#ff0000"
        >
          <View />
        </SwipeableRow>
      );
    });

    const root = testRenderer!.root;
    const animatedViews = root.findAllByType(Animated.View);

    // Old code:
    //   Animated.View inside TouchableOpacity (opacity) +
    //   Animated.View for content (translateX)
    //   = 2 total
    //
    // New code adds a 3rd Animated.View wrapping the action TouchableOpacity
    // with a translateX transform for the reveal-on-swipe effect.
    expect(animatedViews.length).toBe(3);

    // The first Animated.View should be the action button wrapper with a translateX transform
    // The other two are the TouchableOpacity's internal opacity Animated.View and the content Animated.View
    const actionBtnWrapper = animatedViews[0];
    expect(actionBtnWrapper.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transform: expect.arrayContaining([
            { translateX: expect.any(Object) },
          ]),
        }),
      ])
    );
  });
});
