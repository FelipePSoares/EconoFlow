import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { GlobalService } from './global.service';

describe('GlobalService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
    });
  });

  it('should default currentLanguage to en', () => {
    const service = TestBed.inject(GlobalService);

    expect(service.currentLanguage).toBe('en');
  });
});
