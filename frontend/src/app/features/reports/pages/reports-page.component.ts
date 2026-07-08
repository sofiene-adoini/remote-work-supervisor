import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-reports-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="Reports"
      description="Reports module scaffolded and ready for analytics and export workflows."
    ></app-page-placeholder>
  `,
})
export class ReportsPageComponent {}
