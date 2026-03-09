import { TestBed } from '@angular/core/testing';
import { PrivacyModeService } from './privacy-mode.service';

describe('PrivacyModeService', () => {
  const storageKey = 'privacy-mode-enabled';

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('should default to disabled when storage is empty', () => {
    const service = TestBed.inject(PrivacyModeService);

    expect(service.isEnabled).toBeFalse();
  });

  it('should load the initial state from localStorage', () => {
    localStorage.setItem(storageKey, 'true');

    const service = TestBed.inject(PrivacyModeService);

    expect(service.isEnabled).toBeTrue();
  });

  it('should update and persist state when setEnabled is called', () => {
    const service = TestBed.inject(PrivacyModeService);

    service.setEnabled(true);

    expect(service.isEnabled).toBeTrue();
    expect(localStorage.getItem(storageKey)).toBe('true');
  });
});
