import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Divider, List } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';

type Props = {
  navigation: BottomTabNavigationProp<MainTabParamList, 'Profile'>;
};

export const ProfileScreen: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { user, clearAuth } = useAuthStore();
  const { clearProject } = useProjectStore();

  const handleSignOut = () => {
    clearAuth();
    clearProject();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Subheader>{t('LabelAccountInfo') ?? 'Account'}</List.Subheader>
        <List.Item
          title={user?.fullName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
          description={user?.email}
          left={(props) => <List.Icon {...props} icon="account" />}
        />
        <List.Item
          title={t('LabelLanguage') ?? 'Language'}
          description={user?.languageCode ?? 'en-US'}
          left={(props) => <List.Icon {...props} icon="translate" />}
        />
        <List.Item
          title={t('LabelTwoFactorAuthentication') ?? 'Two-factor authentication'}
          description={user?.twoFactorEnabled ? (t('LabelEnabled') ?? 'Enabled') : (t('LabelDisabled') ?? 'Disabled')}
          left={(props) => <List.Icon {...props} icon="shield-check" />}
        />
      </List.Section>

      <Divider />

      <Button
        mode="outlined"
        icon="logout"
        onPress={handleSignOut}
        style={styles.signOutButton}
      >
        {t('ButtonSignOut') ?? 'Sign out'}
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32 },
  signOutButton: { marginHorizontal: 16, marginTop: 24 },
});
