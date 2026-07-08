import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-employee-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="Employee"
      description="Employee module scaffolded and ready for time and activity workflows."
    ></app-page-placeholder>
  `,
})
export class EmployeePageComponent {}
