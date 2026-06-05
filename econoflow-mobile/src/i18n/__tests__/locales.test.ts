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

  it('en.json contains LabelOfBudget', () => {
    expect((en as LocaleMap)['LabelOfBudget']).toBeTruthy();
  });

  it('pt.json contains LabelOfBudget', () => {
    expect((pt as LocaleMap)['LabelOfBudget']).toBeTruthy();
  });

  it('en.json contains ErrorGeneric', () => {
    expect((en as LocaleMap)['ErrorGeneric']).toBeTruthy();
  });

  it('pt.json contains ErrorGeneric', () => {
    expect((pt as LocaleMap)['ErrorGeneric']).toBeTruthy();
  });

  it('en.json contains ButtonDismiss', () => {
    expect((en as LocaleMap)['ButtonDismiss']).toBeTruthy();
  });

  it('pt.json contains ButtonDismiss', () => {
    expect((pt as LocaleMap)['ButtonDismiss']).toBeTruthy();
  });

  it('en.json contains LabelSpent', () => {
    expect((en as LocaleMap)['LabelSpent']).toBeTruthy();
  });

  it('pt.json contains LabelSpent', () => {
    expect((pt as LocaleMap)['LabelSpent']).toBeTruthy();
  });

  it('en.json contains LabelBudgetSummary', () => {
    expect((en as LocaleMap)['LabelBudgetSummary']).toBeTruthy();
  });

  it('pt.json contains LabelBudgetSummary', () => {
    expect((pt as LocaleMap)['LabelBudgetSummary']).toBeTruthy();
  });

  it('en.json contains LabelLeft', () => {
    expect((en as LocaleMap)['LabelLeft']).toBeTruthy();
  });

  it('pt.json contains LabelLeft', () => {
    expect((pt as LocaleMap)['LabelLeft']).toBeTruthy();
  });
});
