import {
  Component, EventEmitter, Input, Output, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-swipe-delete-row',
  imports: [CommonModule],
  templateUrl: './swipe-delete-row.component.html',
  styleUrl: './swipe-delete-row.component.css'
})
export class SwipeDeleteRowComponent {
  @Input() actionIcon: 'trash' | 'archive' = 'trash';
  @Input() disabled = false;
  @Output() actionTriggered = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private isDragging = false;
  private isHorizontal: boolean | null = null;
  // Deferred pointer capture: set only after we confirm a horizontal swipe,
  // so that simple taps on inner elements (expand button, action button) still
  // receive the synthesised click event from the browser.
  private captureElement: HTMLElement | null = null;
  private capturePointerId: number | null = null;

  readonly ACTION_PANEL_WIDTH = 70;
  readonly OPEN_THRESHOLD = 50;

  offset = signal(0);
  isOpen = signal(false);

  onPointerDown(event: PointerEvent): void {
    if (this.disabled) return;
    const el = event.currentTarget as HTMLElement;
    // Taps on the action panel must reach the button — never start a drag there.
    const panel = el.querySelector('.swipe-action-panel');
    if (panel?.contains(event.target as Node)) return;

    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = this.offset();
    this.isDragging = true;
    this.isHorizontal = null;
    this.captureElement = el;
    this.capturePointerId = event.pointerId;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (this.isHorizontal === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      this.isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (this.isHorizontal && this.captureElement !== null && this.capturePointerId !== null) {
        this.captureElement.setPointerCapture(this.capturePointerId);
      }
      this.captureElement = null;
      this.capturePointerId = null;
    }

    if (!this.isHorizontal) {
      this.isDragging = false;
      return;
    }

    event.preventDefault();
    const newX = Math.max(-this.ACTION_PANEL_WIDTH, Math.min(0, this.currentX + dx));
    this.offset.set(newX);
  }

  onPointerUp(): void {
    this.captureElement = null;
    this.capturePointerId = null;
    if (!this.isDragging) return;
    this.isDragging = false;

    const current = this.offset();
    if (current < -this.OPEN_THRESHOLD) {
      this.offset.set(-this.ACTION_PANEL_WIDTH);
      this.isOpen.set(true);
    } else {
      this.offset.set(0);
      this.isOpen.set(false);
    }
  }

  onPointerCancel(): void {
    this.captureElement = null;
    this.capturePointerId = null;
    this.isDragging = false;
    this.offset.set(0);
    this.isOpen.set(false);
  }

  close(): void {
    this.offset.set(0);
    this.isOpen.set(false);
  }

  triggerAction(): void {
    this.close();
    this.actionTriggered.emit();
  }
}
