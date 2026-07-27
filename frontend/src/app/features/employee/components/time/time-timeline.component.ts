import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  LucideLogIn,
  LucideLogOut,
  LucideCoffee,
  LucidePause,
  LucidePlay,
  LucideAlertTriangle,
  LucideClock,
} from '@lucide/angular';
import { SessionWithWorked } from '../../models/employee.models';

type EventType = 'clock-in' | 'clock-out' | 'break-start' | 'break-end' | 'active' | 'on-break';

interface TimelineEvent {
  type: EventType;
  time: string | null;
  label: string;
  detail: string;
  sortKey: number;
}

@Component({
  selector: 'app-time-timeline',
  imports: [DatePipe, LucideLogIn, LucideLogOut, LucideCoffee, LucidePause, LucidePlay, LucideAlertTriangle, LucideClock],
  template: `
    <div class="timeline-card">
      <div class="timeline-header">
        <h3 class="timeline-title">Today's Timeline</h3>
      </div>

      @if (loading()) {
        <div class="timeline-body">
          @for (i of [1, 2, 3]; track i) {
            <div class="tl-row sk-row">
              <div class="tl-time sk sk-bar"></div>
              <div class="tl-dot sk sk-circle"></div>
              <div class="tl-content">
                <div class="sk sk-bar sk-bar-sm"></div>
                <div class="sk sk-bar sk-bar-xs"></div>
              </div>
            </div>
          }
        </div>
      } @else if (events().length === 0) {
        <div class="timeline-empty">
          <svg lucideClock class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No work sessions recorded today</p>
        </div>
      } @else {
        <div class="timeline-body">
          @for (evt of events(); track $index) {
            <div class="tl-row" [class.tl-row-active]="evt.type === 'active' || evt.type === 'on-break'">
              <span class="tl-time">{{ evt.time }}</span>
              <div class="tl-track">
                <div class="tl-dot" [class]="'tl-dot tl-dot-' + evt.type">
                  @switch (evt.type) {
                    @case ('clock-in') {
                      <svg lucideLogIn class="dot-icon" aria-hidden="true"></svg>
                    }
                    @case ('clock-out') {
                      <svg lucideLogOut class="dot-icon" aria-hidden="true"></svg>
                    }
                    @case ('break-start') {
                      <svg lucideCoffee class="dot-icon" aria-hidden="true"></svg>
                    }
                    @case ('break-end') {
                      <svg lucidePlay class="dot-icon" aria-hidden="true"></svg>
                    }
                    @case ('active') {
                      <svg lucideAlertTriangle class="dot-icon" aria-hidden="true"></svg>
                    }
                    @case ('on-break') {
                      <svg lucidePause class="dot-icon" aria-hidden="true"></svg>
                    }
                  }
                </div>
                @if (!$last) {
                  <div class="tl-line"></div>
                }
              </div>
              <div class="tl-content">
                <span class="tl-label" [class]="'tl-label tl-label-' + evt.type">{{ evt.label }}</span>
                @if (evt.detail) {
                  <span class="tl-detail">{{ evt.detail }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .timeline-card {
      background: var(--rws-card);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
      transition: box-shadow 200ms ease;
    }

    .timeline-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    }

    .timeline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--rws-border);
      background: linear-gradient(135deg, rgba(11,74,90,0.02), rgba(19,141,158,0.02));
    }

    .timeline-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    /* ── Body ──────────────────────────────────────────────── */

    .timeline-body {
      padding: 1.25rem 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* ── Row ───────────────────────────────────────────────── */

    .tl-row {
      display: flex;
      align-items: flex-start;
      gap: 0;
      min-height: 44px;
      animation: tl-fade-in 300ms ease both;

      &:nth-child(1) { animation-delay: 0ms; }
      &:nth-child(2) { animation-delay: 40ms; }
      &:nth-child(3) { animation-delay: 80ms; }
      &:nth-child(4) { animation-delay: 120ms; }
      &:nth-child(5) { animation-delay: 160ms; }
      &:nth-child(6) { animation-delay: 200ms; }
      &:nth-child(7) { animation-delay: 240ms; }
      &:nth-child(8) { animation-delay: 280ms; }
    }

    @keyframes tl-fade-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .tl-row-active {
      background: linear-gradient(90deg, rgba(19,141,158,0.04), transparent);
      border-radius: var(--rws-radius);
      margin: 0 -0.5rem;
      padding: 0.25rem 0.5rem;
    }

    /* ── Time ──────────────────────────────────────────────── */

    .tl-time {
      width: 72px;
      flex-shrink: 0;
      font-family: var(--rws-font-mono);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      padding-top: 2px;
      text-align: right;
      padding-right: 12px;
      line-height: 16px;
    }

    /* ── Track (line + dot) ────────────────────────────────── */

    .tl-track {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 24px;
      flex-shrink: 0;
      position: relative;
      padding-top: 0;
    }

    .tl-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      transition: transform 200ms ease, box-shadow 200ms ease;
    }

    .dot-icon {
      width: 6px;
      height: 6px;
    }

    .tl-dot-clock-in {
      background: var(--rws-success);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(46, 158, 108, 0.15);
    }

    .tl-dot-clock-out {
      background: #9ca3af;
      color: #fff;
      box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.15);
    }

    .tl-dot-break-start {
      background: var(--rws-gold);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(194, 146, 79, 0.15);
    }

    .tl-dot-break-end {
      background: var(--rws-accent);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(19, 141, 158, 0.15);
    }

    .tl-dot-active {
      background: var(--rws-success);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(46, 158, 108, 0.15);
      animation: pulse-active 2.5s ease-in-out infinite;
    }

    .tl-dot-on-break {
      background: var(--rws-gold);
      color: #fff;
      box-shadow: 0 0 0 3px rgba(194, 146, 79, 0.15);
      animation: pulse-break 2.5s ease-in-out infinite;
    }

    @keyframes pulse-active {
      0%, 100% { box-shadow: 0 0 0 3px rgba(46, 158, 108, 0.15); }
      50% { box-shadow: 0 0 0 6px rgba(46, 158, 108, 0.06); }
    }

    @keyframes pulse-break {
      0%, 100% { box-shadow: 0 0 0 3px rgba(194, 146, 79, 0.15); }
      50% { box-shadow: 0 0 0 6px rgba(194, 146, 79, 0.06); }
    }

    .tl-line {
      width: 2px;
      flex: 1;
      min-height: 18px;
      background: var(--rws-border);
    }

    /* ── Content ───────────────────────────────────────────── */

    .tl-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 2px 0 10px 10px;
      flex: 1;
      min-width: 0;
    }

    .tl-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
      line-height: 16px;
    }

    .tl-label-clock-in { color: #1a7a54; }
    .tl-label-clock-out { color: #6b7280; }
    .tl-label-break-start { color: #92610a; }
    .tl-label-break-end { color: var(--rws-accent); }
    .tl-label-active { color: #1a7a54; }
    .tl-label-on-break { color: #92610a; }

    .tl-detail {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      line-height: 15px;
    }

    /* ── Empty ─────────────────────────────────────────────── */

    .timeline-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
    }

    .empty-icon {
      width: 40px;
      height: 40px;
      color: var(--rws-text-muted);
      opacity: 0.4;
      margin-bottom: 0.75rem;
    }

    .empty-text {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--rws-text);
    }

    /* ── Skeleton ──────────────────────────────────────────── */

    .sk-row {
      animation: none !important;
    }

    .sk {
      background: var(--rws-bg);
      border-radius: var(--rws-radius);
      animation: sk-pulse 1.5s ease-in-out infinite;
    }

    .sk-bar { height: 12px; width: 48px; }
    .sk-bar-sm { height: 10px; width: 80px; }
    .sk-bar-xs { height: 8px; width: 56px; }
    .sk-circle { width: 12px; height: 12px; border-radius: 50%; }

    .tl-row:nth-child(1) .sk { animation-delay: 0ms; }
    .tl-row:nth-child(2) .sk { animation-delay: 150ms; }
    .tl-row:nth-child(3) .sk { animation-delay: 300ms; }

    @keyframes sk-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Responsive ────────────────────────────────────────── */

    @media (max-width: 639px) {
      .tl-time {
        width: 58px;
        font-size: 0.75rem;
        padding-right: 8px;
      }

      .tl-dot {
        width: 10px;
        height: 10px;
      }

      .dot-icon {
        width: 5px;
        height: 5px;
      }

      .tl-track {
        width: 20px;
      }

      .tl-label {
        font-size: 0.8125rem;
      }

      .tl-detail {
        font-size: 0.75rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tl-row {
        animation: none !important;
      }

      .tl-dot-active,
      .tl-dot-on-break {
        animation: none !important;
      }

      .sk {
        animation: none !important;
      }
    }
  `],
})
export class TimeTimelineComponent {
  readonly sessions = input.required<SessionWithWorked[]>();
  readonly loading = input(false);

  protected readonly events = computed<TimelineEvent[]>(() => {
    const sessions = this.sessions();
    if (!sessions || sessions.length === 0) return [];

    const events: TimelineEvent[] = [];

    for (const s of sessions) {
      if (s.clockIn) {
        events.push({
          type: 'clock-in',
          time: this.formatTime(s.clockIn),
          label: 'Clock In',
          detail: '',
          sortKey: new Date(s.clockIn).getTime(),
        });
      }

      if (s.breakStart) {
        events.push({
          type: 'break-start',
          time: this.formatTime(s.breakStart),
          label: 'Break Started',
          detail: '',
          sortKey: new Date(s.breakStart).getTime(),
        });
      }

      if (s.breakEnd) {
        events.push({
          type: 'break-end',
          time: this.formatTime(s.breakEnd),
          label: 'Break Ended',
          detail: s.totalBreakMinutes > 0 ? `${s.totalBreakMinutes}m break` : '',
          sortKey: new Date(s.breakEnd).getTime(),
        });
      }

      if (s.clockOut) {
        events.push({
          type: 'clock-out',
          time: this.formatTime(s.clockOut),
          label: 'Clock Out',
          detail: s.workedMinutes > 0 ? `${this.formatMinutes(s.workedMinutes)} worked` : '',
          sortKey: new Date(s.clockOut).getTime(),
        });
      }

      if (s.status === 'active') {
        events.push({
          type: 'active',
          time: null,
          label: 'Currently working',
          detail: s.workedMinutes > 0 ? `${this.formatMinutes(s.workedMinutes)} so far` : '',
          sortKey: Infinity,
        });
      } else if (s.status === 'break') {
        events.push({
          type: 'on-break',
          time: null,
          label: 'On break',
          detail: s.breakStart ? `Since ${this.formatTime(s.breakStart)}` : '',
          sortKey: Infinity,
        });
      }
    }

    events.sort((a, b) => a.sortKey - b.sortKey);

    return events;
  });

  private formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  private formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
