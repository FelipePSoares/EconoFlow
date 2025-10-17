import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VersionCheckService {
  private checkInterval = 60000; // 1 minute
  private currentVersion = '';

  constructor(private http: HttpClient) { }

  public init() {
    this.http.get<{ versionNumber: string }>('/assets/version.json').subscribe(res => {
      this.currentVersion = res.versionNumber;
    });

    interval(60000).subscribe(() => {
      this.http.get<{ versionNumber: string }>('/assets/version.json?nocache=' + new Date().getTime())
        .subscribe(res => {
          if (this.currentVersion && res.versionNumber !== this.currentVersion) {
            location.reload();
          }
        });
    });
  }
}
