import { SECURITY_PAGE_URL } from '../legalLinks';

describe('legalLinks', () => {
  it('points the security page at the published public site over HTTPS', () => {
    expect(SECURITY_PAGE_URL).toBe('https://econoflow.pt/security');
  });

  it('does not point at a local or plain-HTTP origin', () => {
    expect(SECURITY_PAGE_URL.startsWith('https://')).toBe(true);
    expect(SECURITY_PAGE_URL).not.toContain('localhost');
  });
});
