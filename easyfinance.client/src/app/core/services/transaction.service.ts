import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {

  constructor(private http: HttpClient) { }
  
  getLatest(projectId: string, numberOfTransactions: number) {
    return this.http.get<Transaction[]>('/api/transactions/' + projectId + '/latests/' + numberOfTransactions, {
      observe: 'body',
      responseType: 'json',
    });
  }
}
