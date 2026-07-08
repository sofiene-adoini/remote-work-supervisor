import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly loading = signal(false);

  isLoading(): boolean {
    return this.loading();
  }

  setLoading(value: boolean): void {
    this.loading.set(value);
  }
}
