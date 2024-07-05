import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailProjectComponent } from './detail-project.component';

describe('DetailProjectComponent', () => {
  let component: DetailProjectComponent;
  let fixture: ComponentFixture<DetailProjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailProjectComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DetailProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
