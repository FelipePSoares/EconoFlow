import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Operation } from 'fast-json-patch';
import { Client } from '../models/client';

@Injectable({
  providedIn: 'root'
})
export class ClientService {

  constructor(private http: HttpClient) { }

  get(projectId: string) {
    return this.http.get<Client[]>('/api/projects/' + projectId + '/company/clients/', {
      observe: 'body',
      responseType: 'json'
    });
  }

  getById(projectId: string, clientId: string) {
    return this.http.get<Client>('/api/projects/' + projectId + '/company/clients/' + clientId, {
      observe: 'body',
      responseType: 'json'
    });
  }

  add(projectId: string, client: Client): Observable<Client> {
    return this.http.post<Client>('/api/projects/' + projectId + '/company/clients', client, {
      observe: 'body',
      responseType: 'json'
    });
  }

  update(projectId: string, clientId: string, patch: Operation[]): Observable<Client> {
    return this.http.patch<Client>('/api/projects/' + projectId + '/company/clients/' + clientId, patch, {
      observe: 'body',
      responseType: 'json'
    });
  }

  deactivate(projectId: string, clientId: string): Observable<boolean> {
    return this.http.put('/api/projects/' + projectId + '/company/clients/' + clientId + '/deactivate', {}, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }

  activate(projectId: string, clientId: string): Observable<Client> {
    return this.http.put<Client>('/api/projects/' + projectId + '/company/clients/' + clientId + '/activate', {}, {
      observe: 'body',
      responseType: 'json'
    });
  }

  archive(projectId: string, clientId: string): Observable<boolean> {
    return this.http.put('/api/projects/' + projectId + '/company/clients/' + clientId + '/archive', {}, {
      observe: 'response'
    }).pipe(map(res => res.ok));
  }
}
