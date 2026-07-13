import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-dashboard-redirect',
  template: `<p>Redirecting...</p>`,
})
export class DashboardRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const user = this.auth.currentUser;
    const path = user ? this.auth.redirectPathFor(user) : '/employee/dashboard';
    void this.router.navigateByUrl(path);
  }
}
