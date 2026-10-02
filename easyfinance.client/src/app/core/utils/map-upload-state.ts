import { HttpEvent, HttpEventType } from '@angular/common/http';
import { UploadState } from '../types/upload-state';

/**
 * Maps an Angular HTTP upload event stream into the shared {@link UploadState}
 * shape used by the attachment upload progress bars.
 */
export function mapUploadState<T>(event: HttpEvent<T>, fallbackTotal: number): UploadState<T> | null {
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
