import { APP_INITIALIZER } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';
import { RealtimeService } from '../services/realtime.service';

export function provideRealtime() {
  return {
    provide: APP_INITIALIZER,
    multi: true,
    deps: [AuthService, RealtimeService],
    useFactory: (auth: AuthService, realtime: RealtimeService) => () => {
      auth.currentUser$.subscribe((user) => {
        if (user) {
          realtime.connect();
        } else {
          realtime.disconnect();
        }
      });
    },
  };
}
