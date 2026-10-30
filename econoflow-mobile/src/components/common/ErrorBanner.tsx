import React from 'react';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  message?: string;
  onDismiss: () => void;
  /** Adds a "try again" action next to dismiss; omit it when a retry makes no sense. */
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<Props> = ({ visible, message, onDismiss, onRetry }) => {
  const { t } = useTranslation();
  const actions = [
    { label: t('ButtonDismiss') ?? 'Dismiss', onPress: onDismiss },
  ];
  if (onRetry) {
    actions.unshift({ label: t('ButtonTryAgain') ?? 'Try Again', onPress: onRetry });
  }

  return (
    <Banner
      visible={visible}
      actions={actions}
      icon="alert-circle"
    >
      {message ?? t('ErrorGeneric') ?? 'Something went wrong. Please try again.'}
    </Banner>
  );
};
