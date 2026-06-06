import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwipeDeleteRowComponent } from './swipe-delete-row.component';

describe('SwipeDeleteRowComponent', () => {
  let fixture: ComponentFixture<SwipeDeleteRowComponent>;
  let component: SwipeDeleteRowComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwipeDeleteRowComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SwipeDeleteRowComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('triggerAction', () => {
    it('should emit actionTriggered', () => {
      let emitted = false;
      component.actionTriggered.subscribe(() => emitted = true);

      component.triggerAction();

      expect(emitted).toBeTrue();
    });

    it('should close the panel when triggered', () => {
      component.offset.set(-70);
      component.isOpen.set(true);

      component.triggerAction();

      expect(component.offset()).toBe(0);
      expect(component.isOpen()).toBeFalse();
    });
  });

  describe('onPointerDown', () => {
    function makePointerDownEvent(target: Element, currentTarget: HTMLElement): PointerEvent {
      return {
        clientX: 200,
        clientY: 50,
        pointerId: 1,
        target,
        currentTarget,
        preventDefault: () => { /* no-op */ }
      } as unknown as PointerEvent;
    }

    it('should call setPointerCapture immediately for non-interactive targets', () => {
      // Bug: deferred implementation never calls setPointerCapture in onPointerDown
      const wrapper = el.querySelector('.swipe-wrapper') as HTMLElement;
      const setCaptureSpy = spyOn(wrapper, 'setPointerCapture');
      const content = el.querySelector('.swipe-content') as HTMLElement;

      component.onPointerDown(makePointerDownEvent(content, wrapper));

      expect(setCaptureSpy).toHaveBeenCalledWith(1);
    });

    it('should NOT call setPointerCapture when the tap target is a button', () => {
      const wrapper = el.querySelector('.swipe-wrapper') as HTMLElement;
      const setCaptureSpy = spyOn(wrapper, 'setPointerCapture');
      const actionBtn = el.querySelector('.swipe-action-btn') as HTMLElement;

      component.onPointerDown(makePointerDownEvent(actionBtn, wrapper));

      expect(setCaptureSpy).not.toHaveBeenCalled();

      // A subsequent move also must not start the drag
      component.onPointerMove({
        clientX: 188,
        clientY: 51,
        currentTarget: wrapper,
        preventDefault: () => { /* no-op */ }
      } as unknown as PointerEvent);

      expect(setCaptureSpy).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should reset offset and isOpen to default', () => {
      component.offset.set(-70);
      component.isOpen.set(true);

      component.close();

      expect(component.offset()).toBe(0);
      expect(component.isOpen()).toBeFalse();
    });
  });
});
