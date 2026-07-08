import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-page-placeholder',
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <h2>{{ title() }}</h2>
      <p>{{ description() }}</p>
    </mat-card>
  `,
  styles: [
    `
      .placeholder-card {
        border-radius: var(--rws-radius);
        padding: 1.25rem;
      }

      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.2rem;
      }

      p {
        margin: 0;
        color: #5f6b78;
      }
    `,
  ],
})
export class PagePlaceholderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('This section is ready for future implementation.');
}
