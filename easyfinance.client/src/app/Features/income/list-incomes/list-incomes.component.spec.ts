import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListIncomesComponent } from './list-incomes.component';

describe('ListIncomesComponent', () => {
  let component: ListIncomesComponent;
  let fixture: ComponentFixture<ListIncomesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListIncomesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListIncomesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
