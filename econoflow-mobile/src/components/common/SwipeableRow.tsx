import React, { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
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
    <Animated.View
      style={[styles.container, { transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
    >
      {children}
      <TouchableOpacity
        onPress={() => { close(); onAction(); }}
        style={[styles.actionBtn, { backgroundColor: actionColor, right: -ACTION_WIDTH }]}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={actionIcon as never} size={20} color={colors.surface} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  actionBtn: {
    position: 'absolute',
    top: '50%',
    width: ACTION_WIDTH - 16,
    height: ACTION_WIDTH - 16,
    marginTop: -(ACTION_WIDTH - 16) / 2,
    borderRadius: (ACTION_WIDTH - 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
