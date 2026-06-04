/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, BehaviorSubject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ListCategoriesComponent } from './list-categories.component';
import { CategoryService } from '../../../core/services/category.service';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ProjectService } from '../../../core/services/project.service';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { Role } from '../../../core/enums/Role';
import { Category } from '../../../core/models/category';
import { CategoryDto } from '../models/category-dto';

describe('ListCategoriesComponent', () => {
  let fixture: ComponentFixture<ListCategoriesComponent>;
  let component: ListCategoriesComponent;
  let categoryServiceMock: jasmine.SpyObj<CategoryService>;

  const makeCategory = (id = 'cat-1', name = 'Food'): Category => {
    const cat = new Category();
    cat.id = id;
    cat.name = name;
    cat.expenses = [];
    cat.isArchived = false;
    return cat;
  };

  const makeUserProject = (): UserProjectDto => {
    const dto = new UserProjectDto();
    dto.id = 'up-1';
    dto.role = Role.Manager;
    return dto;
  };

  const makeCategoryDto = (id = 'cat-1', name = 'Food'): CategoryDto => {
    const dto = new CategoryDto();
    dto.id = id;
    dto.name = name;
    dto.expenses = [];
    dto.isArchived = false;
    dto.displayOrder = 0;
    return dto;
  };

  beforeEach(async () => {
    categoryServiceMock = jasmine.createSpyObj<CategoryService>('CategoryService', [
      'get', 'getDefaultCategories', 'update'
    ]);
    categoryServiceMock.get.and.returnValue(of([makeCategory()]));
    categoryServiceMock.getDefaultCategories.and.returnValue(of([]));
    categoryServiceMock.update.and.returnValue(of(makeCategory()));

    const selectedUserProject$ = new BehaviorSubject<UserProjectDto>(makeUserProject());
    const projectServiceMock = jasmine.createSpyObj<ProjectService>('ProjectService', ['getUserProject', 'selectUserProject']);
    (projectServiceMock as any).selectedUserProject$ = selectedUserProject$.asObservable();

    await TestBed.configureTestingModule({
      imports: [
        ListCategoriesComponent,
        TranslateModule.forRoot(),
        NoopAnimationsModule
      ],
      providers: [
        { provide: CategoryService, useValue: categoryServiceMock },
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ActivatedRoute, useValue: {} },
        {
          provide: MatDialog,
          useValue: { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(false) }) }
        },
        {
          provide: ErrorMessageService,
          useValue: {
            getFormFieldErrors: () => [],
            setFormErrors: jasmine.createSpy('setFormErrors')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ListCategoriesComponent);
    component = fixture.componentInstance;
    component.projectId = 'project-1';
    fixture.detectChanges();
  });

  it('should have isSaving false initially', () => {
    expect((component as any).isSaving).toBeFalse();
  });

  it('should set isSaving to true while update request is in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();

    expect((component as any).isSaving).toBeTrue();

    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();
  });

  it('should set isSaving to false after successful update', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();
    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();

    expect((component as any).isSaving).toBeFalse();
  });

  it('should set isSaving to false after a failed update', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();
    subject.error({ errors: { general: ['ServerError'] } });

    expect((component as any).isSaving).toBeFalse();
  });

  it('should not call update service on second save while first is still in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();
    component.save();

    expect(categoryServiceMock.update).toHaveBeenCalledTimes(1);

    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();
  });

  it('should disable submit button while isSaving is true', fakeAsync(() => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto('cat-1', 'Food'));
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();
    fixture.detectChanges();
    tick();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).not.toBeNull();
    expect(submitButton.disabled).toBeTrue();

    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();
  }));

  it('should reset isSaving when cancelEdit is called while save is in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();

    expect((component as any).isSaving).toBeTrue();
    component.cancelEdit();

    expect((component as any).isSaving).toBeFalse();

    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();
  });

  it('should reset isSaving when edit is called while save is in-flight', () => {
    const subject = new Subject<Category>();
    categoryServiceMock.update.and.returnValue(subject.asObservable());

    component.edit(makeCategoryDto());
    component.categoryForm.patchValue({ name: 'Updated Food' });
    component.save();

    expect((component as any).isSaving).toBeTrue();
    component.edit(makeCategoryDto('cat-2', 'Rent'));

    expect((component as any).isSaving).toBeFalse();

    subject.next(makeCategory('cat-1', 'Updated Food'));
    subject.complete();
  });
});
