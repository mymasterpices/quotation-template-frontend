import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RateMasterComponent } from './rate-master.component';

describe('RateMasterComponent', () => {
  let component: RateMasterComponent;
  let fixture: ComponentFixture<RateMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RateMasterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RateMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
