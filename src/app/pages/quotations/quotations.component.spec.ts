import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuotationsComponent } from './quotations.component';

describe('QuotationsComponent', () => {
  let component: QuotationsComponent;
  let fixture: ComponentFixture<QuotationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuotationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuotationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
