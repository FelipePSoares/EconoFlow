import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { auroraTokens } from '../../theme/useAuroraSkin';
import { AVAILABLE_CURRENCIES, type Currency } from '../../utils/currency';

interface Props {
  dark: boolean;
  value: string;
  onChange: (code: string) => void;
  hasError?: boolean;
  testID?: string;
}

export const CurrencyPickerField: React.FC<Props> = ({
  dark, value, onChange, hasError, testID,
}) => {
  const { t } = useTranslation();
  const { ink, ink2 } = auroraTokens(dark);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const fieldBg     = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.68)';
  const fieldBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)';
  const errorBorder = '#e74c3c';
  const panelBg     = dark ? '#061e33' : '#eaf3fb';
  const panelBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.92)';
  const divider     = dark ? 'rgba(255,255,255,0.06)' : 'rgba(13,33,55,0.06)';

  const filtered: Currency[] = search.trim()
    ? AVAILABLE_CURRENCIES.filter(c => {
        const q = search.toLowerCase();
        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      })
    : AVAILABLE_CURRENCIES;

  const closeModal = () => {
    setModalVisible(false);
    setSearch('');
  };

  const handleSelect = (code: string) => {
    onChange(code);
    closeModal();
  };

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={[
          styles.row,
          { backgroundColor: fieldBg, borderColor: hasError ? errorBorder : fieldBorder },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="currency-usd" size={20} color={ink2} style={styles.icon} />
        <Text style={[styles.valueText, { color: value ? ink : ink2 }]}>
          {value || t('FieldCurrency')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={ink2} />
      </TouchableOpacity>

      {modalVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeModal}
          statusBarTranslucent
        >
          <View style={styles.backdrop} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.centeredWrap}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={closeModal}
              activeOpacity={1}
            />
            <View
              testID="currency-picker-modal"
              style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: ink }]}>{t('FieldCurrency')}</Text>
                <TouchableOpacity onPress={closeModal} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={22} color={ink2} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchRow, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={ink2} style={styles.searchIcon} />
                <TextInput
                  testID="currency-search-input"
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('PlaceholderSearchCurrency')}
                  placeholderTextColor={ink2}
                  style={[styles.searchInput, { color: ink }]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={item => item.code}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    testID={`currency-option-${item.code}`}
                    style={[
                      styles.item,
                      { borderBottomColor: divider },
                      item.code === value && { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,118,168,0.08)' },
                    ]}
                    onPress={() => handleSelect(item.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.itemCode, { color: ink }]}>{item.code}</Text>
                    <Text style={[styles.itemName, { color: ink2 }]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 11,
  },
  icon:       { marginRight: 10 },
  valueText:  { flex: 1, fontSize: 14.5, fontWeight: '500' },
  backdrop:   { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  centeredWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  list:        { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  itemCode: { fontSize: 15, fontWeight: '700', minWidth: 46 },
  itemName: { fontSize: 13, fontWeight: '400', flex: 1 },
});
