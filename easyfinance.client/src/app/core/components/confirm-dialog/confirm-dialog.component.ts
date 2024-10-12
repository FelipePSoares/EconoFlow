import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

declare var bootstrap: any;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  @ViewChild('confirmationModal') confirmationModal!: ElementRef;
  @Output() confirmed = new EventEmitter<boolean>();

  title!: string;
  message!: string;
  action!: string;
  modalInstance: any;

  openModal(title: string, customMessage: string, actionText: string): void {
    this.title = title;
    this.message = customMessage;
    this.action = actionText;

    const modalElement = this.confirmationModal.nativeElement;
    this.modalInstance = new bootstrap.Modal(modalElement);
    this.modalInstance.show();
  }

  confirmDelete(): void {
    this.confirmed.emit(true); 
    this.modalInstance.hide();
  }

  cancelDelete(): void {
    this.confirmed.emit(false);
    this.modalInstance.hide();
  }
}
