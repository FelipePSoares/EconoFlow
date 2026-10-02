import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { RecordAttachmentsScreen } from '../RecordAttachmentsScreen';
import { useIncome, useAddIncomeAttachment, useDeleteIncomeAttachment } from '../../../hooks/useAttachments';
import { downloadAndOpenAttachment } from '../../../utils/attachmentDownload';
import { captureError } from '../../../monitoring/sentry';
import type { Attachment } from '../../../api/types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
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

jest.mock('../../../monitoring/sentry', () => ({
  captureError: jest.fn(),
}));

jest.mock('../../../utils/attachmentDownload', () => ({
  downloadAndOpenAttachment: jest.fn(),
}));

let mockRole: string | undefined = 'Admin';

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: () => ({
    selectedProject: { project: { id: 'proj-1' }, role: mockRole },
  }),
}));

jest.mock('../../../hooks/useAttachments', () => ({
  useIncome: jest.fn(),
  useExpense: jest.fn(),
  useAddIncomeAttachment: jest.fn(),
  useDeleteIncomeAttachment: jest.fn(),
  useAddExpenseAttachment: jest.fn(),
  useDeleteExpenseAttachment: jest.fn(),
}));

const pickedFile = { uri: 'file:///tmp/payslip.pdf', name: 'payslip.pdf', type: 'application/pdf' };

jest.mock('../../../components/attachments/AttachmentPickerSheet', () => {
  const { Pressable: RNPressable } = jest.requireActual('react-native');
  const picked = { uri: 'file:///tmp/payslip.pdf', name: 'payslip.pdf', type: 'application/pdf' };

  return {
    AttachmentPickerSheet: ({
      visible,
      onSelect,
    }: {
      visible: boolean;
      onSelect: (file: unknown) => void;
    }) => (visible ? <RNPressable testID="picker-select" onPress={() => onSelect(picked)} /> : null),
  };
});

const attachment: Attachment = {
  id: 'att-1',
  name: 'payslip-january.pdf',
  contentType: 'application/pdf',
  size: 2048,
  attachmentType: 'General',
  isTemporary: false,
};

const makeRoute = () => ({
  key: 'RecordAttachments',
  name: 'RecordAttachments' as const,
  params: { kind: 'income' as const, id: 'inc-1', month: '2026-03', title: 'Salary' },
});

const makeNavigation = () =>
  ({
    goBack: jest.fn(),
    setOptions: jest.fn(),
    navigate: jest.fn(),
  }) as unknown as React.ComponentProps<typeof RecordAttachmentsScreen>['navigation'];

const mockIncomeQuery = (overrides: Record<string, unknown> = {}) => {
  (useIncome as jest.Mock).mockReturnValue({
    data: { id: 'inc-1', name: 'Salary', date: '2026-03-01', amount: 2500, attachments: [attachment] },
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  });
};

const mockMutations = (addMutate = jest.fn(), deleteMutate = jest.fn(), isPending = false) => {
  (useAddIncomeAttachment as jest.Mock).mockReturnValue({ mutate: addMutate, isPending });
  (useDeleteIncomeAttachment as jest.Mock).mockReturnValue({ mutate: deleteMutate, isPending: false });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'Admin';
  mockMutations();
  mockIncomeQuery();
  (downloadAndOpenAttachment as jest.Mock).mockResolvedValue(undefined);
});

describe('RecordAttachmentsScreen', () => {
  it('renders the attachments of the record', async () => {
    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    expect(screen.getByText('payslip-january.pdf')).toBeTruthy();
  });

  it('shows the loading indicator while the record is loading', async () => {
    mockIncomeQuery({ data: undefined, isLoading: true });

    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    expect(screen.queryByText('payslip-january.pdf')).toBeNull();
  });

  it('shows an error banner and reports when the record fails to load', async () => {
    mockIncomeQuery({ data: undefined, isLoading: false, isError: true, error: new Error('boom') });

    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    expect(captureError).toHaveBeenCalled();
  });

  it('uploads a picked file through the add mutation', async () => {
    const addMutate = jest.fn();
    mockMutations(addMutate, jest.fn());

    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    await fireEvent.press(screen.getByTestId('attachment-add-button'));
    await fireEvent.press(screen.getByTestId('picker-select'));

    expect(addMutate).toHaveBeenCalledWith(pickedFile, expect.anything());
  });

  it('opens an attachment through the download helper', async () => {
    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    await fireEvent.press(screen.getByTestId('attachment-open'));

    await waitFor(() => expect(downloadAndOpenAttachment).toHaveBeenCalled());
    expect(downloadAndOpenAttachment).toHaveBeenCalledWith(
      expect.stringContaining('/api/Projects/proj-1/Incomes/inc-1/attachments/att-1'),
      'payslip-january.pdf',
      'application/pdf'
    );
  });

  it('deletes an attachment after confirming', async () => {
    const deleteMutate = jest.fn();
    mockMutations(jest.fn(), deleteMutate);

    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    await fireEvent.press(screen.getByTestId('attachment-delete'));
    await fireEvent.press(await screen.findByText('ButtonConfirm'));

    expect(deleteMutate).toHaveBeenCalledWith('att-1', expect.anything());
  });

  it('hides the editing controls for a viewer', async () => {
    mockRole = 'Viewer';

    await render(<RecordAttachmentsScreen route={makeRoute()} navigation={makeNavigation()} />);

    expect(screen.queryByTestId('attachment-add-button')).toBeNull();
    expect(screen.queryByTestId('attachment-delete')).toBeNull();
  });
});
