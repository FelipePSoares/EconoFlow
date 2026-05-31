import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatMonthLabel, prevMonth, nextMonth } from '../../utils/date';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseMonth(month: string): { year: number; m: number } {
  // month format: "YYYY-MM"
  const [y, m] = month.split('-').map(Number);
  return { year: y, m: m - 1 };
}

function buildMonth(year: number, m: number): string {
  return `${year}-${String(m + 1).padStart(2, '0')}`;
}

interface Props {
  month: string;
  onChange: (month: string) => void;
  dark?: boolean;
  /** Legacy prop from hero usage — ignored in new design */
  light?: boolean;
}

export const MonthNavigator: React.FC<Props> = ({ month, onChange, dark }) => {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { year: selYear, m: selM } = parseMonth(month);
  const [pickerYear, setPickerYear] = useState(selYear);

  const ink  = dark ? '#e6edf3' : '#0d2137';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';
  const softBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.68)';
  const softBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)';
  const modalCardBg = dark ? 'rgba(29,43,62,0.97)' : 'rgba(255,255,255,0.96)';
  const modalCardBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)';

  const openPicker = () => {
    setPickerYear(selYear);
    setPickerOpen(true);
  };

  const selectMonth = (y: number, m: number) => {
    onChange(buildMonth(y, m));
    setPickerOpen(false);
  };

  return (
    <>
      <View style={styles.row}>
        {/* Left arrow */}
        <TouchableOpacity
          onPress={() => onChange(prevMonth(month))}
          style={[styles.arrowBtn, { backgroundColor: softBg, borderColor: softBorder }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={ink} />
        </TouchableOpacity>

        {/* Month pill */}
        <TouchableOpacity
          onPress={openPicker}
          activeOpacity={0.7}
          style={[styles.pill, { backgroundColor: softBg, borderColor: softBorder }]}
        >
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color="#0f76a8" style={{ marginRight: 6 }} />
          <Text style={[styles.pillLabel, { color: ink }]}>{formatMonthLabel(month)}</Text>
          <MaterialCommunityIcons name="chevron-down" size={17} color={ink2} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Right arrow */}
        <TouchableOpacity
          onPress={() => onChange(nextMonth(month))}
          style={[styles.arrowBtn, { backgroundColor: softBg, borderColor: softBorder }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={ink} />
        </TouchableOpacity>
      </View>

      {/* Month picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setPickerOpen(false)}>
          <Pressable onPress={() => {/* stop propagation */}}>
            <View style={[styles.pickerCard, { backgroundColor: modalCardBg, borderColor: modalCardBorder }]}>
              {/* Year stepper */}
              <View style={styles.yearRow}>
                <TouchableOpacity
                  onPress={() => setPickerYear(y => y - 1)}
                  style={[styles.yearBtn, { backgroundColor: softBg, borderColor: softBorder }]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color={ink} />
                </TouchableOpacity>
                <Text style={[styles.yearLabel, { color: ink }]}>{pickerYear}</Text>
                <TouchableOpacity
                  onPress={() => setPickerYear(y => y + 1)}
                  style={[styles.yearBtn, { backgroundColor: softBg, borderColor: softBorder }]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color={ink} />
                </TouchableOpacity>
              </View>

              {/* Month grid */}
              <View style={styles.monthGrid}>
                {MONTHS_SHORT.map((label, i) => {
                  const isSelected = pickerYear === selYear && i === selM;
                  return (
                    <TouchableOpacity
                      key={label}
                      onPress={() => selectMonth(pickerYear, i)}
                      activeOpacity={0.7}
                      style={[
                        styles.monthCell,
                        isSelected
                          ? styles.monthCellSelected
                          : { backgroundColor: softBg, borderColor: softBorder },
                      ]}
                    >
                      <Text style={[
                        styles.monthCellLabel,
                        { color: isSelected ? '#fff' : ink },
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Today shortcut */}
              <TouchableOpacity
                onPress={() => { onChange(buildMonth(new Date().getFullYear(), new Date().getMonth())); setPickerOpen(false); }}
                style={styles.todayBtn}
              >
                <Text style={styles.todayLabel}>{t('LabelGoToToday')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillLabel: { fontSize: 14, fontWeight: '700' },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,12,22,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 50,
    elevation: 20,
  },
  yearRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  yearBtn:   { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 18, fontWeight: '800' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '22%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  monthCellSelected: {
    backgroundColor: '#0f76a8',
    borderColor: '#0f76a8',
  },
  monthCellLabel: { fontSize: 13.5, fontWeight: '700' },
  todayBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 11 },
  todayLabel: { color: '#0f76a8', fontWeight: '700', fontSize: 13.5 },
});
