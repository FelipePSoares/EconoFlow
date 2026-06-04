/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AddCategoryComponent } from './add-category.component';
import { CategoryService } from '../../../core/services/category.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { Category } from '../../../core/models/category';

describe('AddCategoryComponent', () => {
  let fixture: ComponentFixture<AddCategoryComponent>;
  let component: AddCategoryComponent;
  let categoryServiceMock: jasmine.SpyObj<CategoryService>;

  const makeCategory = (): Category => {
    const cat = new Category();
    cat.id = 'cat-1';
    cat.name = 'Food';
    cat.expenses = [];
    cat.isArchived = false;
    return cat;
  };

  beforeEach(async () => {
    categoryServiceMock = jasmine.createSpyObj<CategoryService>('CategoryService', ['add', 'getDefaultCategories']);
    categoryServiceMock.add.and.returnValue(of(makeCategory()));
    categoryServiceMock.getDefaultCategories.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        AddCategoryComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        { provide: CategoryService, useValue: categoryServiceMock },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ActivatedRoute, useValue: {} },
        {
          provide: ErrorMessageService,
          useValue: {
            getFormFieldErrors: () => [],
            setFormErrors: jasmine.createSpy('setFormErrors')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddCategoryComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    spyOn(HTMLElement.prototype, 'focus'); // prevent focus-triggered autocomplete NG0100
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should have isSaving false initially', () => {
    expect((component as any).isSaving).toBeFalse();
  });

  it('should set isSaving to true while add request is in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.add.and.returnValue(subject.asObservable());

    component.categoryForm.setValue({ name: 'Food' });
    component.save();

    expect((component as any).isSaving).toBeTrue();

    subject.next(makeCategory());
    subject.complete();
  });

  it('should set isSaving to false after successful save', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.add.and.returnValue(subject.asObservable());

    component.categoryForm.setValue({ name: 'Food' });
    component.save();
    subject.next(makeCategory());
    subject.complete();

    expect((component as any).isSaving).toBeFalse();
  });

  it('should disable submit button while isSaving is true', fakeAsync(() => {
    const subject = new Subject<Category>();
    categoryServiceMock.add.and.returnValue(subject.asObservable());

    component.categoryForm.setValue({ name: 'Food' });
    component.save();
    fixture.detectChanges();
    tick();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBeTrue();

    subject.next(makeCategory());
    subject.complete();
  }));

  it('should not call add service on second save while first is still in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.add.and.returnValue(subject.asObservable());

    component.categoryForm.setValue({ name: 'Food' });
    component.save();
    component.save();

    expect(categoryServiceMock.add).toHaveBeenCalledTimes(1);

    subject.next(makeCategory());
    subject.complete();
  });

  it('should set isSaving to false after a failed save', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.add.and.returnValue(subject.asObservable());

    component.categoryForm.setValue({ name: 'Food' });
    component.save();
    subject.error({ errors: { general: ['ServerError'] } });

    expect((component as any).isSaving).toBeFalse();
  });
});
