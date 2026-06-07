import React, { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/useAppTheme';

const ACTION_WIDTH = 72;
const THRESHOLD = 40;

interface Props {
  onAction: () => void;
  actionIcon: 'trash-can-outline' | 'archive-outline';
  actionColor: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export const SwipeableRow: React.FC<Props> = ({
  onAction,
  actionIcon,
  actionColor,
  disabled = false,
  children,
}) => {
  const { colors } = useAppTheme();
  const [translateX] = useState(() => new Animated.Value(0));

  const close = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [translateX]);

  const panResponder = useMemo(() => {
    const offset = { current: 0 };

    const springTo = (value: number) => {
      Animated.spring(translateX, {
        toValue: value,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    };

    const doClose = () => springTo(0);

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !disabled &&
        Math.abs(gesture.dx) > 5 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation(value => {
          offset.current = value;
        });
      },
      onPanResponderMove: (_evt, gesture) => {
        const newX = Math.max(-ACTION_WIDTH, Math.min(0, offset.current + gesture.dx));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const newX = Math.max(-ACTION_WIDTH, Math.min(0, offset.current + gesture.dx));
        if (newX < -THRESHOLD) {
          springTo(-ACTION_WIDTH);
        } else {
          doClose();
        }
      },
      onPanResponderTerminate: () => doClose(),
    });
  }, [translateX, disabled]);

  return (
    // Outer wrapper clips the sliding content and hosts the action button at a
    // fixed layout position so React Native's hit-test (which uses pre-transform
    // coordinates) can reach it after the content slides away.
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={() => { close(); onAction(); }}
        style={[styles.actionBtn, { backgroundColor: actionColor }]}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={actionIcon as never} size={20} color={colors.surface} />
      </TouchableOpacity>
      <Animated.View
        style={[styles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  actionBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: 'transparent',
  },
});
