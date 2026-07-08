import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../../shared/components/page-placeholder.component';

@Component({
  selector: 'app-projects-page',
  imports: [PagePlaceholderComponent],
  template: `
    <app-page-placeholder
      title="Projects"
      description="Projects module scaffolded and ready for assignment and tracking flows."
    ></app-page-placeholder>
  `,
})
export class ProjectsPageComponent {}
