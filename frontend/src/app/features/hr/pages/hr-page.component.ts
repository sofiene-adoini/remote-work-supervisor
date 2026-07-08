import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-hr-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="HR"
      description="HR module scaffolded and ready for workforce oversight and approvals."
    ></app-page-placeholder>
  `,
})
export class HrPageComponent {}
