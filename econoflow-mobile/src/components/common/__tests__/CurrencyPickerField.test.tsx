import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CurrencyPickerField } from '../CurrencyPickerField';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../utils/currency', () => ({
  AVAILABLE_CURRENCIES: [
    { code: 'EUR', name: 'Euro' },
    { code: 'USD', name: 'United States Dollar' },
    { code: 'GBP', name: 'British Pound Sterling' },
    { code: 'BRL', name: 'Brazilian Real' },
    { code: 'JPY', name: 'Japanese Yen' },
  ],
}));

const mockOnChange = jest.fn();

const defaultProps = {
  dark: false,
  value: 'EUR',
  onChange: mockOnChange,
  testID: 'currency-picker-field',
};

beforeEach(() => {
  mockOnChange.mockReset();
});

describe('CurrencyPickerField', () => {
  it('is a React component function', () => {
    expect(typeof CurrencyPickerField).toBe('function');
  });

  it('renders the selected currency value in the trigger', async () => {
    const { getByText } = await render(<CurrencyPickerField {...defaultProps} />);
    expect(getByText('EUR · Euro')).toBeTruthy();
  });

  it('displays the selected currency name alongside the code in CODE · Name format', async () => {
    const { getByText } = await render(<CurrencyPickerField {...defaultProps} value="USD" />);
    expect(getByText('USD · United States Dollar')).toBeTruthy();
  });

  it('renders with the provided testID', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    expect(getByTestId('currency-picker-field')).toBeTruthy();
  });

  it('does not show the modal initially', async () => {
    const { queryByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    expect(queryByTestId('currency-picker-modal')).toBeNull();
  });

  it('opens the modal when the field is pressed', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    expect(getByTestId('currency-picker-modal')).toBeTruthy();
  });

  it('shows a search input inside the modal', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    expect(getByTestId('currency-search-input')).toBeTruthy();
  });

  it('shows all currencies in the list when no search query', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    expect(getByTestId('currency-option-EUR')).toBeTruthy();
    expect(getByTestId('currency-option-USD')).toBeTruthy();
    expect(getByTestId('currency-option-GBP')).toBeTruthy();
  });

  it('filters currencies by code when a search query is entered', async () => {
    const { getByTestId, queryByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    await fireEvent.changeText(getByTestId('currency-search-input'), 'USD');
    expect(getByTestId('currency-option-USD')).toBeTruthy();
    expect(queryByTestId('currency-option-GBP')).toBeNull();
    expect(queryByTestId('currency-option-EUR')).toBeNull();
  });

  it('filters currencies by name when a search query matches the name', async () => {
    const { getByTestId, queryByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    await fireEvent.changeText(getByTestId('currency-search-input'), 'Euro');
    expect(getByTestId('currency-option-EUR')).toBeTruthy();
    expect(queryByTestId('currency-option-USD')).toBeNull();
  });

  it('search is case insensitive', async () => {
    const { getByTestId, queryByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    await fireEvent.changeText(getByTestId('currency-search-input'), 'eur');
    expect(getByTestId('currency-option-EUR')).toBeTruthy();
    expect(queryByTestId('currency-option-USD')).toBeNull();
  });

  it('calls onChange with the selected currency code when an item is pressed', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    await fireEvent.press(getByTestId('currency-option-USD'));
    expect(mockOnChange).toHaveBeenCalledWith('USD');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('closes the modal after selecting a currency', async () => {
    const { getByTestId, queryByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    expect(getByTestId('currency-picker-modal')).toBeTruthy();
    await fireEvent.press(getByTestId('currency-option-USD'));
    await waitFor(() => expect(queryByTestId('currency-picker-modal')).toBeNull());
  });

  it('resets the search query after selecting a currency and reopening', async () => {
    const { getByTestId } = await render(<CurrencyPickerField {...defaultProps} />);
    await fireEvent.press(getByTestId('currency-picker-field'));
    await fireEvent.changeText(getByTestId('currency-search-input'), 'USD');
    await fireEvent.press(getByTestId('currency-option-USD'));
    await waitFor(() => fireEvent.press(getByTestId('currency-picker-field')));
    expect(getByTestId('currency-search-input').props.value).toBe('');
  });
});
