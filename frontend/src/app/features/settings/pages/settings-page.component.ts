import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-settings-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="Settings"
      description="Settings module scaffolded and ready for preferences and administration."
    ></app-page-placeholder>
  `,
})
export class SettingsPageComponent {}
