import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly darkMode = signal(false);

  isDarkMode(): boolean {
    return this.darkMode();
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);
  }
}
