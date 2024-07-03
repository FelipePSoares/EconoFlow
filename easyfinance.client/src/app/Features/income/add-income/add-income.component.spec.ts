import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddIncomeComponent } from './add-income.component';

describe('AddIncomeComponent', () => {
  let component: AddIncomeComponent;
  let fixture: ComponentFixture<AddIncomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddIncomeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AddIncomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
