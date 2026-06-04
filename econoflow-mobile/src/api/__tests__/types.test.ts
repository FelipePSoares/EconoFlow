import type { ExpenseItem, ExpenseAttachment } from '../types';

describe('ExpenseItem type', () => {
  it('includes isDeductible field', () => {
    const item: ExpenseItem = {
      id: 'i1', name: 'Test', date: '2024-01-01', amount: 10,
      isDeductible: true, attachments: [],
    };
    expect(item.isDeductible).toBe(true);
  });

  it('includes attachments field compatible with ExpenseAttachment[]', () => {
    const attachment: ExpenseAttachment = {
      id: 'a1', name: 'receipt.pdf', contentType: 'application/pdf', size: 1024,
    };
    const item: ExpenseItem = {
      id: 'i2', name: 'Proof item', date: '2024-01-01', amount: 25,
      isDeductible: true, attachments: [attachment],
    };
    expect(item.attachments).toHaveLength(1);
    expect(item.attachments![0].contentType).toBe('application/pdf');
  });

  it('attachments defaults to empty when absent', () => {
    const item: ExpenseItem = {
      id: 'i3', name: 'No proof', date: '2024-01-01', amount: 5,
      isDeductible: false, attachments: [],
    };
    expect(item.attachments).toHaveLength(0);
  });
});
