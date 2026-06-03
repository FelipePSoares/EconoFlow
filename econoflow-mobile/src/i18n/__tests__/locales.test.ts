import en from '../locales/en.json';
import pt from '../locales/pt.json';

type LocaleMap = Record<string, string>;

describe('i18n locale completeness', () => {
  it('en.json contains LabelCategories', () => {
    expect((en as LocaleMap)['LabelCategories']).toBeDefined();
  });

  it('pt.json contains LabelCategories', () => {
    expect((pt as LocaleMap)['LabelCategories']).toBeDefined();
  });
});
