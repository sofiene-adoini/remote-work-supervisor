import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="Dashboard"
      description="Dashboard module scaffolded and ready for widgets, charts, and KPIs."
    ></app-page-placeholder>
  `,
})
export class DashboardPageComponent {}
