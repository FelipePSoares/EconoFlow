import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private deleteToken: string | null = null;
  private confirmationMessage: string | null = null;
  
  setToken(token: string, confirmationMessage: string): void {
    this.deleteToken = token;
    this.confirmationMessage = confirmationMessage
  }

  getToken(): string | null {
    return this.deleteToken;
  }

  getConfirmationMessage(): string | null{
    return this.confirmationMessage
  }

  clearToken(): void {
    this.deleteToken = null;
    this.confirmationMessage = null; 
  }
}
