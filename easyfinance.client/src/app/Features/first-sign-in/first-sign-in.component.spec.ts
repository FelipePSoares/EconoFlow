import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirstSignInComponent } from './first-sign-in.component';

describe('FirstSignInComponent', () => {
  let component: FirstSignInComponent;
  let fixture: ComponentFixture<FirstSignInComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FirstSignInComponent]
    });
    fixture = TestBed.createComponent(FirstSignInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
