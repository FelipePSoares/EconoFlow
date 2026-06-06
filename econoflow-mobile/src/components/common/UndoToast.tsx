import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme/useAppTheme';

const DURATION = 5000;

interface Props {
  message: string;
  visible: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<Props> = ({ message, visible, onUndo, onDismiss }) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onDismiss(), DURATION);
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, opacity, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: colors.onSurface }]}>
      <Text style={[styles.message, { color: colors.surface }]}>{message}</Text>
      <TouchableOpacity onPress={() => { onUndo(); onDismiss(); }} hitSlop={8}>
        <Text style={[styles.undoBtn, { color: colors.primary }]}>
          {t('ButtonUndo')}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 9999,
  },
  message: { flex: 1, fontSize: 14 },
  undoBtn: { fontSize: 14, fontWeight: '700', marginLeft: 16 },
});
