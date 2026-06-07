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

  readonly ACTION_PANEL_WIDTH = 70;
  readonly OPEN_THRESHOLD = 50;

  offset = signal(0);
  isOpen = signal(false);

  onPointerDown(event: PointerEvent): void {
    if (this.disabled) return;
    // Skip drag for interactive elements: their click events must not be
    // swallowed by the pointer capture that the wrapper sets below.
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;

    const el = event.currentTarget as HTMLElement;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = this.offset();
    this.isDragging = true;
    this.isHorizontal = null;
    el.setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (this.isHorizontal === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      this.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (!this.isHorizontal) {
      this.isDragging = false;
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      return;
    }

    event.preventDefault();
    const newX = Math.max(-this.ACTION_PANEL_WIDTH, Math.min(0, this.currentX + dx));
    this.offset.set(newX);
  }

  onPointerUp(): void {
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
