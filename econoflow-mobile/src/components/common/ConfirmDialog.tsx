import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>{t('ButtonCancel')}</Button>
          <Button onPress={onConfirm}>{t('ButtonConfirm', { defaultValue: 'Confirm' })}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};
