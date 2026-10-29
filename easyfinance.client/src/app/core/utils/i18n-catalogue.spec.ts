/**
 * The translation files are loaded independently per language, so a key present in one and
 * missing from the other does not fail any build — it silently renders the raw key in the
 * other language. These checks keep the two catalogues in lockstep.
 */
import en from '../../../assets/i18n/messages.en.json';
import pt from '../../../assets/i18n/messages.pt.json';

const english = en as Record<string, string>;
const portuguese = pt as Record<string, string>;

describe('attachment i18n catalogues', () => {
  it('should define the same keys in both languages', () => {
    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(english).sort());
  });

  it('should explain a content rejection for every upload surface that reports one', () => {
    ['IncomeAttachmentContentInvalid', 'DeductibleProofContentInvalid'].forEach(key => {
      expect(english[key]).toBeTruthy();
      expect(portuguese[key]).toBeTruthy();
    });
  });

  it('should keep the generic upload message distinct from the content one', () => {
    expect(english['IncomeAttachmentContentInvalid']).not.toBe(english['IncomeAttachmentUploadFailed']);
    expect(english['DeductibleProofContentInvalid']).not.toBe(english['DeductibleProofUploadFailed']);
  });
});
