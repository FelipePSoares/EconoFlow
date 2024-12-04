import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private deleteToken: string | null = null;

  setToken(token: string): void {
    this.deleteToken = token;
  }

  getToken(): string | null {
    return this.deleteToken;
  }

  clearToken(): void {
    this.deleteToken = null;
  }
}
