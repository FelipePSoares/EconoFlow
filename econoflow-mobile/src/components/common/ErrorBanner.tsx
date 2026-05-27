import React from 'react';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  message?: string;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<Props> = ({ visible, message, onDismiss }) => {
  const { t } = useTranslation();
  return (
    <Banner
      visible={visible}
      actions={[{ label: t('ButtonDismiss') ?? 'Dismiss', onPress: onDismiss }]}
      icon="alert-circle"
    >
      {message ?? t('ErrorGeneric') ?? 'Something went wrong. Please try again.'}
    </Banner>
  );
};
