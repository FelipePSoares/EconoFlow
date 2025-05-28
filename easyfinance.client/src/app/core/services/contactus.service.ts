import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContactUs } from '../models/contact-us';

@Injectable({
  providedIn: 'root'
})
export class ContactUsService {

  constructor(private http: HttpClient) { }

  add(contactus: ContactUs): Observable<ContactUs> {
    return this.http.post<ContactUs>('/api/support/', contactus);
  }

}
