import { buildPatch, buildReplace, buildExpenseItemPatch } from '../patch';

describe('buildReplace', () => {
  it('creates a replace operation with leading slash on path', () => {
    const op = buildReplace('name', 'Alice');
    expect(op).toEqual({ op: 'replace', path: '/name', value: 'Alice' });
  });

  it('handles numeric values', () => {
    const op = buildReplace('amount', 42.5);
    expect(op).toEqual({ op: 'replace', path: '/amount', value: 42.5 });
  });

  it('handles null value', () => {
    const op = buildReplace('note', null);
    expect(op).toEqual({ op: 'replace', path: '/note', value: null });
  });
});

describe('buildPatch', () => {
  it('returns an empty array for an empty fields object', () => {
    expect(buildPatch({})).toEqual([]);
  });

  it('creates one replace operation per field', () => {
    const ops = buildPatch({ name: 'Alice', amount: 100 });
    expect(ops).toHaveLength(2);
    expect(ops).toContainEqual({ op: 'replace', path: '/name', value: 'Alice' });
    expect(ops).toContainEqual({ op: 'replace', path: '/amount', value: 100 });
  });

  it('preserves all value types', () => {
    const ops = buildPatch({ flag: true, count: 0, label: '' });
    expect(ops).toContainEqual({ op: 'replace', path: '/flag', value: true });
    expect(ops).toContainEqual({ op: 'replace', path: '/count', value: 0 });
    expect(ops).toContainEqual({ op: 'replace', path: '/label', value: '' });
  });

  it('income patch excludes isDeductible and budget when only name/amount/date are passed', () => {
    const ops = buildPatch({ name: 'Salary', amount: 1500, date: '2024-06-01' });
    expect(ops).toHaveLength(3);
    const paths = ops.map(o => o.path);
    expect(paths).not.toContain('/isDeductible');
    expect(paths).not.toContain('/budget');
  });
});

describe('buildExpenseItemPatch', () => {
  it('creates replace operations targeting the correct item index', () => {
    const ops = buildExpenseItemPatch(2, { name: 'Coffee', amount: 3.5, date: '2024-01-15' });
    expect(ops).toHaveLength(3);
    expect(ops).toContainEqual({ op: 'replace', path: '/items/2/name', value: 'Coffee' });
    expect(ops).toContainEqual({ op: 'replace', path: '/items/2/amount', value: 3.5 });
    expect(ops).toContainEqual({ op: 'replace', path: '/items/2/date', value: '2024-01-15' });
  });

  it('uses index 0 correctly', () => {
    const ops = buildExpenseItemPatch(0, { name: 'Tea', amount: 2.0, date: '2024-01-10' });
    expect(ops[0].path).toBe('/items/0/name');
    expect(ops[1].path).toBe('/items/0/amount');
    expect(ops[2].path).toBe('/items/0/date');
  });

  it('returns exactly 3 operations (name, amount, date)', () => {
    const ops = buildExpenseItemPatch(1, { name: 'Milk', amount: 1.2, date: '2024-03-05' });
    expect(ops).toHaveLength(3);
  });
});
