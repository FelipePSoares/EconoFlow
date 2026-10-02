import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AttachmentPickerSheet } from '../AttachmentPickerSheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { surface: '#ffffff', onSurface: '#111111' },
    customColors: { expense: '#e74c3c' },
  }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const mockRequestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

const onSelect = jest.fn();
const onInvalidFile = jest.fn();
const onDismiss = jest.fn();

const renderSheet = () =>
  render(
    <AttachmentPickerSheet
      visible
      onDismiss={onDismiss}
      onSelect={onSelect}
      onInvalidFile={onInvalidFile}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///tmp/payslip.pdf', name: 'payslip.pdf', mimeType: 'application/pdf', size: 2048 },
    ],
  });
  mockRequestPermission.mockResolvedValue({ granted: true });
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///tmp/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: 4096 },
    ],
  });
});

describe('AttachmentPickerSheet', () => {
  it('selects a document and maps it to an upload file', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-file'));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        uri: 'file:///tmp/payslip.pdf',
        name: 'payslip.pdf',
        type: 'application/pdf',
      })
    );
  });

  it('rejects a document with an unsupported type', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/notes.txt', name: 'notes.txt', mimeType: 'text/plain', size: 10 }],
    });

    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-file'));

    await waitFor(() => expect(onInvalidFile).toHaveBeenCalledWith('invalidType'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('rejects a document above the maximum size', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///tmp/huge.pdf', name: 'huge.pdf', mimeType: 'application/pdf', size: 11 * 1024 * 1024 },
      ],
    });

    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-file'));

    await waitFor(() => expect(onInvalidFile).toHaveBeenCalledWith('tooLarge'));
  });

  it('does not select anything when the document picker is cancelled', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-file'));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects a photo from the library', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-photo'));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        uri: 'file:///tmp/photo.jpg',
        name: 'photo.jpg',
        type: 'image/jpeg',
      })
    );
  });

  it('dismisses without selecting when photo permission is denied', async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });

    await renderSheet();

    await fireEvent.press(screen.getByTestId('attachment-pick-photo'));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
