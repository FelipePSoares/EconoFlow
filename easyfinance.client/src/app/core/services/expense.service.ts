import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { Expense } from '../models/expense';
import { ExpenseAttachment } from '../models/expense-attachment';
import { AttachmentType } from '../enums/attachment-type';
import { formatDate } from '../utils/date';
import { UploadState } from '../types/upload-state';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private http = inject(HttpClient);

  get(projectId: string, categoryId: string, currentDate: Date) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let queryParams = new HttpParams();
    queryParams = queryParams.append("from", formatDate(new Date(year, month, 1)).substring(0, 10));
    queryParams = queryParams.append("to", formatDate(new Date(year, month + 1, 1)).substring(0, 10));

    return this.http.get<Expense[]>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses', {
      observe: 'body',
      responseType: 'json',
      params: queryParams
    });
  }

  getById(projectId: string, categoryId: string, expenseId: string) {
    return this.http.get<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId, {
      observe: 'body',
      responseType: 'json'
    });
  }

  add(projectId: string, categoryId: string, expense: Expense): Observable<Expense> {
    return this.http.post<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses', expense, {
      observe: 'body',
      responseType: 'json'
    });
  }

  update(projectId: string, categoryId: string, id: string, patch: Operation[]): Observable<Expense> {
    return this.http.patch<Expense>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + id, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  moveExpense(projectId: string, sourceCategoryId: string, expenseId: string, targetCategoryId: string): Observable<boolean> {
    return this.http.post(
      '/api/projects/' + projectId + '/categories/' + sourceCategoryId + '/expenses/' + expenseId + '/move',
      { targetCategoryId },
      {
        observe: 'response'
      }
    ).pipe(map(res => res.ok));
  }

  moveExpenseItem(
    projectId: string,
    sourceCategoryId: string,
    sourceExpenseId: string,
    expenseItemId: string,
    targetCategoryId: string,
    targetExpenseId: string): Observable<boolean> {
    return this.http.post(
      '/api/projects/' + projectId + '/categories/' + sourceCategoryId + '/expenses/' + sourceExpenseId + '/expenseItems/' + expenseItemId + '/move',
      { targetCategoryId, targetExpenseId },
      {
        observe: 'response'
      }
    ).pipe(map(res => res.ok));
  }

  uploadTemporaryAttachment(projectId: string, categoryId: string, file: File, attachmentType: AttachmentType): Observable<ExpenseAttachment> {
    return this.uploadTemporaryAttachmentWithProgress(projectId, categoryId, file, attachmentType).pipe(
      filter((state): state is { kind: 'done'; body: ExpenseAttachment } => state.kind === 'done'),
      map(state => state.body)
    );
  }

  uploadTemporaryAttachmentWithProgress(projectId: string, categoryId: string, file: File, attachmentType: AttachmentType): Observable<UploadState<ExpenseAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('attachmentType', attachmentType.toString());

    return this.http.post<ExpenseAttachment>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/temporary-attachments', formData, {
      observe: 'events',
      reportProgress: true,
      responseType: 'json'
    }).pipe(
      map(event => this.mapUploadState(event, file.size)),
      filter((state): state is UploadState<ExpenseAttachment> => state !== null)
    );
  }

  uploadAttachment(projectId: string, categoryId: string, expenseId: string, file: File, attachmentType: AttachmentType): Observable<ExpenseAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('attachmentType', attachmentType.toString());

    return this.http.post<ExpenseAttachment>('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/attachments', formData, {
      observe: 'body',
      responseType: 'json'
    });
  }

  removeAttachment(projectId: string, categoryId: string, expenseId: string, attachmentId: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/attachments/' + attachmentId, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  getAttachmentDownloadUrl(projectId: string, categoryId: string, expenseId: string, attachmentId: string): string {
    return '/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/attachments/' + attachmentId;
  }

  uploadTemporaryExpenseItemAttachment(projectId: string, categoryId: string, expenseId: string, file: File, attachmentType: AttachmentType): Observable<ExpenseAttachment> {
    return this.uploadTemporaryExpenseItemAttachmentWithProgress(projectId, categoryId, expenseId, file, attachmentType).pipe(
      filter((state): state is { kind: 'done'; body: ExpenseAttachment } => state.kind === 'done'),
      map(state => state.body)
    );
  }

  uploadTemporaryExpenseItemAttachmentWithProgress(projectId: string, categoryId: string, expenseId: string, file: File, attachmentType: AttachmentType): Observable<UploadState<ExpenseAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('attachmentType', attachmentType.toString());

    return this.http.post<ExpenseAttachment>(
      '/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/expenseItems/temporary-attachments',
      formData,
      {
        observe: 'events',
        reportProgress: true,
        responseType: 'json'
      }).pipe(
        map(event => this.mapUploadState(event, file.size)),
        filter((state): state is UploadState<ExpenseAttachment> => state !== null)
      );
  }

  removeExpenseItemAttachment(projectId: string, categoryId: string, expenseId: string, expenseItemId: string, attachmentId: string): Observable<boolean> {
    return this.http.delete(
      '/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/expenseItems/' + expenseItemId + '/attachments/' + attachmentId,
      {
        observe: 'response'
      }).pipe(map(res => res.ok));
  }

  getExpenseItemAttachmentDownloadUrl(projectId: string, categoryId: string, expenseId: string, expenseItemId: string, attachmentId: string): string {
    return '/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/expenseItems/' + expenseItemId + '/attachments/' + attachmentId;
  }

  remove(projectId: string, categoryId: string, id: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + id, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  removeItem(projectId: string, categoryId: string, expenseId: string, expenseItemId: string): Observable<boolean> {
    return this.http.delete('/api/projects/' + projectId + '/categories/' + categoryId + '/expenses/' + expenseId + '/expenseItems/' + expenseItemId, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  private mapUploadState<T>(event: HttpEvent<T>, fallbackTotal: number): UploadState<T> | null {
    switch (event.type) {
      case HttpEventType.UploadProgress: {
        const total = event.total && event.total > 0
          ? event.total
          : fallbackTotal;
        const percent = total > 0
          ? Math.min(99, Math.max(0, Math.round((event.loaded / total) * 100)))
          : 0;
        return { kind: 'progress', percent };
      }
      case HttpEventType.Response:
        return { kind: 'done', body: event.body as T };
      default:
        return null;
    }
  }
}
