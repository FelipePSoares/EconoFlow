import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

declare var bootstrap: any;

@Component({
    selector: 'app-confirm-dialog',
    imports: [],
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  @ViewChild('confirmationModal') confirmationModal!: ElementRef;
  @Output() confirmed = new EventEmitter<boolean>();

  title!: string;
  message!: SafeHtml;
  action!: string;
  modalInstance: any;

  constructor(private sanitizer: DomSanitizer) { }

  openModal(title: string, customMessage: string, actionText: string): void {
    this.title = title;
    this.message = this.sanitizer.bypassSecurityTrustHtml(customMessage);
    this.action = actionText;

    const modalElement = this.confirmationModal.nativeElement;
    this.modalInstance = new bootstrap.Modal(modalElement);
    this.modalInstance.show();
  }

  confirm(): void {
    this.confirmed.emit(true); 
    this.modalInstance.hide();
  }

  cancel(): void {
    this.confirmed.emit(false);
    this.modalInstance.hide();
  }
}
