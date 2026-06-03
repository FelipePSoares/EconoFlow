import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ContactUs } from '../models/contact-us';

@Injectable({
  providedIn: 'root'
})
export class ContactUsService {
  private http = inject(HttpClient);


  add(contactus: ContactUs): Observable<ContactUs> {
    return this.http.post<ContactUs>('/api/support/', contactus);
  }

}
