import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AddEditProjectComponent } from './add-edit-project.component';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { ProjectDto } from '../models/project-dto';

describe('AddEditProjectComponent - months locale', () => {
  let fixture: ComponentFixture<AddEditProjectComponent>;
  let component: AddEditProjectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AddEditProjectComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: GlobalService,
          useValue: { currentLanguage: 'pt' }
        },
        {
          provide: MatDialogRef,
          useValue: { close: jasmine.createSpy('close'), afterClosed: () => of(null) }
        },
        {
          provide: ProjectService,
          useValue: {
            getEditingProject: () => new ProjectDto(),
            setEditingProject: jasmine.createSpy('setEditingProject'),
            upsertTaxYearSettings: jasmine.createSpy('upsertTaxYearSettings').and.returnValue(of({}))
          }
        },
        {
          provide: CurrencyService,
          useValue: { getAvailableCurrencies: () => [] }
        },
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') }
        },
        {
          provide: ErrorMessageService,
          useValue: {}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddEditProjectComponent);
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
