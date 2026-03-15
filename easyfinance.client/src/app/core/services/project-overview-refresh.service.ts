import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectOverviewRefreshService {
  private readonly refreshSubject = new Subject<string>();
  readonly refresh$: Observable<string> = this.refreshSubject.asObservable();

  requestRefresh(projectId: string): void {
    this.refreshSubject.next(projectId);
  }
}
