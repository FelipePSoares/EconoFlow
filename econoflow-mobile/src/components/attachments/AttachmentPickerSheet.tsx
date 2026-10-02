import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import type { UploadFile } from '../../api/attachments.api';
import { useAppTheme } from '../../theme/useAppTheme';
import { toUploadFile, validateAttachment } from '../../utils/attachments';
import type { AttachmentValidationError } from '../../utils/attachments';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (file: UploadFile) => void;
  onInvalidFile: (error: AttachmentValidationError) => void;
}

export const AttachmentPickerSheet: React.FC<Props> = ({
  visible,
  onDismiss,
  onSelect,
  onInvalidFile,
}) => {
  const { t } = useTranslation();
  const { colors, customColors } = useAppTheme();
  const [isPicking, setIsPicking] = useState(false);

  const handleAsset = (asset: {
    uri: string;
    name?: string | null;
    mimeType?: string | null;
    size?: number | null;
  }) => {
    const error = validateAttachment({ mimeType: asset.mimeType, size: asset.size });

    if (error) {
      onInvalidFile(error);
      return;
    }

    onSelect(toUploadFile(asset));
  };

  const pickDocument = async () => {
    setIsPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        onDismiss();
        return;
      }

      const asset = result.assets[0];
      handleAsset({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    } finally {
      setIsPicking(false);
    }
  };

  const pickPhoto = async () => {
    setIsPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onDismiss();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        onDismiss();
        return;
      }

      const asset = result.assets[0];
      handleAsset({
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
        size: asset.fileSize,
      });
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.backdrop} />
      <View style={styles.centeredWrap} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />

        <View style={[styles.panel, { backgroundColor: colors.surface }]} testID="attachment-picker-sheet">
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {t('LabelAddAttachment')}
          </Text>

          <TouchableOpacity
            testID="attachment-pick-file"
            style={styles.option}
            disabled={isPicking}
            onPress={pickDocument}
          >
            <MaterialCommunityIcons name="file-outline" size={22} color={customColors.expense} />
            <Text style={[styles.optionLabel, { color: colors.onSurface }]}>
              {t('AttachmentChooseFile')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="attachment-pick-photo"
            style={styles.option}
            disabled={isPicking}
            onPress={pickPhoto}
          >
            <MaterialCommunityIcons name="camera-outline" size={22} color={customColors.expense} />
            <Text style={[styles.optionLabel, { color: colors.onSurface }]}>
              {t('AttachmentTakePhoto')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onDismiss} testID="attachment-picker-cancel">
            <Text style={[styles.optionLabel, { color: colors.onSurface }]}>
              {t('ButtonCancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.60)' },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  panel: { width: '100%', borderRadius: 24, padding: 20, gap: 6, zIndex: 1 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optionLabel: { fontSize: 14.5, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
});
