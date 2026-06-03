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
});
