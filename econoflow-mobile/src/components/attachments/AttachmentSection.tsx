import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Attachment } from '../../api/types';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatBytes } from '../../utils/format';

interface Props {
  attachments: Attachment[];
  canEdit: boolean;
  isUploading?: boolean;
  onAddPress: () => void;
  onOpenPress: (attachment: Attachment) => void;
  onDeletePress: (attachment: Attachment) => void;
}

const iconFor = (contentType: string): string =>
  contentType === 'application/pdf' ? 'file-pdf-box' : 'file-image-outline';

export const AttachmentSection: React.FC<Props> = ({
  attachments,
  canEdit,
  isUploading = false,
  onAddPress,
  onOpenPress,
  onDeletePress,
}) => {
  const { t } = useTranslation();
  const { colors, customColors } = useAppTheme();

  const isAddDisabled = isUploading;

  return (
    <View style={styles.container} testID="attachment-section">
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
        {t('Attachments')}
      </Text>

      {attachments.length === 0 ? (
        <Text style={[styles.empty, { color: colors.onSurface }]} testID="attachment-empty">
          {t('LabelNoAttachments')}
        </Text>
      ) : (
        <View style={styles.list}>
          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              testID="attachment-row"
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <TouchableOpacity
                testID="attachment-open"
                style={styles.rowMain}
                activeOpacity={0.75}
                onPress={() => onOpenPress(attachment)}
              >
                <MaterialCommunityIcons
                  name={iconFor(attachment.contentType) as never}
                  size={22}
                  color={customColors.expense}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <Text style={[styles.size, { color: colors.onSurface }]}>
                    {formatBytes(attachment.size)}
                  </Text>
                </View>
              </TouchableOpacity>

              {canEdit && (
                <TouchableOpacity
                  testID="attachment-delete"
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  onPress={() => onDeletePress(attachment)}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={20}
                    color={customColors.expense}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {isUploading && (
        <View style={styles.uploading} testID="attachment-uploading">
          <ActivityIndicator size="small" color={customColors.expense} />
          <Text style={[styles.uploadingText, { color: colors.onSurface }]}>
            {t('LabelUploading')}
          </Text>
        </View>
      )}

      {canEdit && (
        <TouchableOpacity
          testID="attachment-add-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: isAddDisabled }}
          disabled={isAddDisabled}
          activeOpacity={0.8}
          style={[
            styles.addButton,
            { backgroundColor: colors.surface },
            isAddDisabled && styles.addButtonDisabled,
          ]}
          onPress={() => {
            if (!isAddDisabled) {
              onAddPress();
            }
          }}
        >
          <MaterialCommunityIcons
            name="paperclip"
            size={18}
            color={customColors.expense}
          />
          <Text style={[styles.addLabel, { color: colors.onSurface }]}>
            {t('LabelAddAttachment')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 12.5, opacity: 0.65 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 13.5, fontWeight: '600' },
  size: { fontSize: 11.5, opacity: 0.65 },
  deleteButton: { padding: 6 },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  uploadingText: { fontSize: 12.5, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
  },
  addButtonDisabled: { opacity: 0.5 },
  addLabel: { fontSize: 13.5, fontWeight: '700' },
});
