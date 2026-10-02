import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { AttachmentSection } from '../AttachmentSection';
import type { Attachment } from '../../../api/types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { surface: '#ffffff', onSurface: '#111111' },
    customColors: { expense: '#e74c3c', income: '#14c08a' },
  }),
}));

const buildAttachment = (id: string, name: string, size = 2048): Attachment => ({
  id,
  name,
  contentType: 'application/pdf',
  size,
  attachmentType: 'General',
  isTemporary: false,
});

const defaultProps = {
  attachments: [] as Attachment[],
  canEdit: true,
  isUploading: false,
  onAddPress: jest.fn(),
  onOpenPress: jest.fn(),
  onDeletePress: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AttachmentSection', () => {
  it('renders the empty state when there are no attachments', async () => {
    await render(<AttachmentSection {...defaultProps} />);

    expect(screen.getByTestId('attachment-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('attachment-row')).toHaveLength(0);
  });

  it('renders every attachment with its formatted size', async () => {
    await render(
      <AttachmentSection
        {...defaultProps}
        attachments={[buildAttachment('a1', 'payslip.pdf', 1024), buildAttachment('a2', 'contract.pdf', 512)]}
      />
    );

    expect(screen.getAllByTestId('attachment-row')).toHaveLength(2);
    expect(screen.getByText('payslip.pdf')).toBeTruthy();
    expect(screen.getByText('contract.pdf')).toBeTruthy();
    expect(screen.getByText('1 KB')).toBeTruthy();
  });

  it('opens an attachment when its row is pressed', async () => {
    const attachment = buildAttachment('a1', 'payslip.pdf');
    await render(<AttachmentSection {...defaultProps} attachments={[attachment]} />);

    await fireEvent.press(screen.getByTestId('attachment-open'));

    expect(defaultProps.onOpenPress).toHaveBeenCalledWith(attachment);
  });

  it('requests deletion of an attachment', async () => {
    const attachment = buildAttachment('a1', 'payslip.pdf');
    await render(<AttachmentSection {...defaultProps} attachments={[attachment]} />);

    await fireEvent.press(screen.getByTestId('attachment-delete'));

    expect(defaultProps.onDeletePress).toHaveBeenCalledWith(attachment);
  });

  it('triggers the add action', async () => {
    await render(<AttachmentSection {...defaultProps} />);

    await fireEvent.press(screen.getByTestId('attachment-add-button'));

    expect(defaultProps.onAddPress).toHaveBeenCalled();
  });

  it('hides the add and delete controls for a viewer', async () => {
    await render(
      <AttachmentSection {...defaultProps} canEdit={false} attachments={[buildAttachment('a1', 'payslip.pdf')]} />
    );

    expect(screen.queryByTestId('attachment-add-button')).toBeNull();
    expect(screen.queryByTestId('attachment-delete')).toBeNull();
  });

  it('disables the add button and shows progress while uploading', async () => {
    await render(<AttachmentSection {...defaultProps} isUploading />);

    expect(screen.getByTestId('attachment-uploading')).toBeTruthy();
    expect(screen.getByTestId('attachment-add-button').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('attachment-add-button'));
    expect(defaultProps.onAddPress).not.toHaveBeenCalled();
  });
});
