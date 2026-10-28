import { TestBed } from '@angular/core/testing';
import {
  MOBILE_SECURITY_PAGE_URL,
  PUBLIC_ORIGIN,
  SECURITY_PAGE_LAST_UPDATED,
  SECURITY_POLICY_PATH,
  SecurityService,
} from './security.service';

describe('SecurityService', () => {
  const now = new Date('2026-10-28T12:00:00Z');

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(now);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should expose the support period as one rolling year for every delivery mode', () => {
    const service = TestBed.inject(SecurityService);

    const supportPeriod = service.getSupportPeriod();

    const expectedEnd = new Date(now.getTime());
    expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);

    expect(supportPeriod.months).toBe(12);
    expect(supportPeriod.startsOn).toEqual(now);
    expect(supportPeriod.endsOn).toEqual(expectedEnd);
  });

  it('should format the support period dates as ISO days', () => {
    const service = TestBed.inject(SecurityService);

    const supportPeriod = service.getSupportPeriod();

    expect(supportPeriod.startsOnIso).toBe('2026-10-28');
    expect(supportPeriod.endsOnIso).toBe('2027-10-28');
  });

  it('should publish the mobile security page on the public site', () => {
    expect(MOBILE_SECURITY_PAGE_URL).toBe(`${PUBLIC_ORIGIN}${SECURITY_POLICY_PATH}`);
  });

  it('should build the security page route for a language', () => {
    expect(SecurityService.getSecurityPagePath('en')).toBe('/security');
    expect(SecurityService.getSecurityPagePath('pt')).toBe('/pt/security');
    expect(SecurityService.getSecurityPagePath('pt-BR')).toBe('/pt/security');
  });

  it('should publish a revision date that is a real ISO day', () => {
    // The page and docs/security-user-guide.md print this date; pinning its shape
    // keeps a typo or a placeholder such as "TBD" out of published copy.
    expect(SECURITY_PAGE_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(SECURITY_PAGE_LAST_UPDATED))).toBeFalse();
  });
});
