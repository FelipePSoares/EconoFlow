import { Injectable } from '@angular/core';

/** Origin that serves the public pages, including the mobile app's links. */
export const PUBLIC_ORIGIN = 'https://econoflow.pt';

/** Path of the security and support page, relative to the site root. */
export const SECURITY_POLICY_PATH = '/security';

/** Address that receives vulnerability reports; mirrors `/.well-known/security.txt`. */
export const SECURITY_REPORTING_ADDRESS = 'contact@econoflow.pt';

/**
 * Date the security page and docs/security-user-guide.md were last revised.
 *
 * Bump it in the same commit as the copy; the page prints it verbatim.
 */
export const SECURITY_PAGE_LAST_UPDATED = '2026-10-29';

/** URL the mobile app opens for the Annex II security and support instructions. */
export const MOBILE_SECURITY_PAGE_URL = `${PUBLIC_ORIGIN}${SECURITY_POLICY_PATH}`;

/** Months of security updates granted to every release, on every delivery mode. */
const SUPPORT_PERIOD_MONTHS = 12;

/** The security-update support period stated on the security page. */
export interface SecuritySupportPeriod {
  /** Length of the period, in months. */
  months: number;
  /** Start of the window described on the page (now). */
  startsOn: Date;
  /** End of the window described on the page (now + `months`). */
  endsOn: Date;
  /** `startsOn` as an ISO day, for display. */
  startsOnIso: string;
  /** `endsOn` as an ISO day, for display. */
  endsOnIso: string;
}

/**
 * Policy facts that the security page publishes.
 *
 * The support period is one rolling rule — 12 months after a release — so the
 * page always describes "the period that starts today". Keeping it computed
 * rather than a literal date means the page cannot go stale: a fixed date would
 * have to be re-committed every year and would eventually be missed, which is
 * exactly the CRA failure the page exists to prevent.
 */
@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  getSupportPeriod(today: Date = new Date()): SecuritySupportPeriod {
    const startsOn = new Date(today.getTime());
    const endsOn = new Date(today.getTime());
    endsOn.setMonth(endsOn.getMonth() + SUPPORT_PERIOD_MONTHS);

    return {
      months: SUPPORT_PERIOD_MONTHS,
      startsOn,
      endsOn,
      startsOnIso: SecurityService.toIsoDay(startsOn),
      endsOnIso: SecurityService.toIsoDay(endsOn)
    };
  }

  /** Route of the security page in the given language. */
  static getSecurityPagePath(language: string): string {
    return language.startsWith('pt')
      ? `/pt${SECURITY_POLICY_PATH}`
      : SECURITY_POLICY_PATH;
  }

  private static toIsoDay(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
