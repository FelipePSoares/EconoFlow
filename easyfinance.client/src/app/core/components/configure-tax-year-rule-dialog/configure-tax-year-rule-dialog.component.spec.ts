import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ConfigureTaxYearRuleDialogComponent } from './configure-tax-year-rule-dialog.component';
import { ProjectService } from '../../services/project.service';
import { ErrorMessageService } from '../../services/error-message.service';
import { GlobalService } from '../../services/global.service';

describe('ConfigureTaxYearRuleDialogComponent - months locale', () => {
  let fixture: ComponentFixture<ConfigureTaxYearRuleDialogComponent>;
  let component: ConfigureTaxYearRuleDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ConfigureTaxYearRuleDialogComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: GlobalService,
          useValue: { currentLanguage: 'pt' }
        },
        {
          provide: ProjectService,
          useValue: {
            upsertTaxYearSettings: jasmine.createSpy('upsertTaxYearSettings').and.returnValue(of({}))
          }
        },
        {
          provide: ErrorMessageService,
          useValue: {}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigureTaxYearRuleDialogComponent);
    component = fixture.componentInstance;
  });

  it('should use GlobalService language for month labels', () => {
    const expectedJanuary = new Date(2001, 0, 1).toLocaleString('pt', { month: 'long' });
    expect(component.months[0].label).toBe(expectedJanuary);
  });

  it('should generate 12 months', () => {
    expect(component.months.length).toBe(12);
  });

  it('should assign correct month values 1-12', () => {
    for (let i = 0; i < 12; i++) {
      expect(component.months[i].value).toBe(i + 1);
    }
  });
});
