import { buildPatch, buildReplace } from '../patch';

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
});
