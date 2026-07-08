import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  // Placeholder for centralized API methods.
  get client(): HttpClient {
    return this.http;
  }
}
