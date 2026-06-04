import en from '../locales/en.json';
import pt from '../locales/pt.json';

type LocaleMap = Record<string, string>;

describe('i18n locale completeness', () => {
  it('en.json contains LabelCategories with a non-empty value', () => {
    expect((en as LocaleMap)['LabelCategories']).toBeTruthy();
  });

  it('pt.json contains LabelCategories with a non-empty value', () => {
    expect((pt as LocaleMap)['LabelCategories']).toBeTruthy();
  });

  it('en.json contains LabelEditExpenseItem', () => {
    expect((en as LocaleMap)['LabelEditExpenseItem']).toBeTruthy();
  });

  it('pt.json contains LabelEditExpenseItem', () => {
    expect((pt as LocaleMap)['LabelEditExpenseItem']).toBeTruthy();
  });

  it('en.json contains LabelDeductible', () => {
    expect((en as LocaleMap)['LabelDeductible']).toBeTruthy();
  });

  it('pt.json contains LabelDeductible', () => {
    expect((pt as LocaleMap)['LabelDeductible']).toBeTruthy();
  });

  it('en.json contains LabelProofAttached', () => {
    expect((en as LocaleMap)['LabelProofAttached']).toBeTruthy();
  });

  it('pt.json contains LabelProofAttached', () => {
    expect((pt as LocaleMap)['LabelProofAttached']).toBeTruthy();
  });
});
