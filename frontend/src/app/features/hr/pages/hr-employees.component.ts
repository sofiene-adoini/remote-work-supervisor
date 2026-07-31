import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import {
  LucideUsers, LucideUserPlus, LucideDownload, LucideSearch, LucideX,
  LucideChevronDown, LucideChevronUp, LucideChevronLeft, LucideChevronRight,
  LucideArrowUpDown, LucideMoreVertical, LucidePencil, LucideBan,
  LucidePlay, LucideTrash2, LucideRefreshCw, LucideMonitor, LucideClock,
  LucideCoffee,   LucideBarChart3, LucideAlertTriangle, LucideFolderOpen,
  LucideEye, LucideEyeOff, LucideKeyRound, LucideCheck, LucideCalendar,
  LucideSmartphone, LucideCopy, LucideUndo2,
} from '@lucide/angular';
import { HrAnalyticsService, EmployeeQuery } from '../services/hr-analytics.service';
import { HrEmployeesService } from '../services/hr-employees.service';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrProjectsService } from '../services/hr-projects.service';
import { HrOvertimeService } from '../services/hr-overtime.service';
import { HrAlertsService } from '../services/hr-alerts.service';
import { AgentDevicesService } from '../../employee/services/agent-devices.service';
import { AuthService } from '../../auth/services/auth.service';
import { RealtimeService, SessionStatusEvent, SessionUpdatedEvent } from '../../../core/services/realtime.service';
import { AnalyticsEmployee, EmployeeListSummary, EmployeeDetailSummary, TimelineEntry, PaginatedEmployees } from '../models/hr-analytics.models';
import { HrTeam, HrProject, HrOvertimeDeclaration, HrAlert } from '../models/hr.models';
import { HrRole, EmployeeSessionRow, EmployeeBreakRow, UpdateEmployeePayload, InviteEmployeePayload } from '../models/hr-employees.models';
import { AgentDevice } from '../../employee/models/agent-device.models';

type DetailTab = 'overview' | 'projects' | 'sessions' | 'breaks' | 'overtime' | 'statistics' | 'alerts' | 'devices';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

interface ToastState {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface EmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: number;
  teamId: number;
  jobTitle: string;
  startDate: string;
  expectedDailyHours: number | null;
  agentRequired: boolean;
  employmentStatus: 'active' | 'suspended' | 'terminated';
  password: string;
  passwordConfirm: string;
  sendWelcomeEmail: boolean;
}

const DEFAULT_SUMMARY: EmployeeListSummary = {
  total: 0, activeNow: 0, onBreak: 0, clockedOut: 0, agentOnline: 0, suspended: 0, terminated: 0,
};

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never';
  const t = new Date(ts).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return ts.slice(0, 10);
}

@Component({
  selector: 'app-hr-employees',
  imports: [
    CommonModule, FormsModule, DatePipe,
    LucideUsers, LucideUserPlus, LucideDownload, LucideSearch, LucideX,
    LucideChevronDown, LucideChevronUp, LucideChevronLeft, LucideChevronRight,
    LucideArrowUpDown, LucideMoreVertical, LucidePencil, LucideBan,
    LucidePlay, LucideTrash2, LucideRefreshCw, LucideMonitor, LucideClock,
    LucideCoffee,     LucideBarChart3, LucideAlertTriangle, LucideFolderOpen,
    LucideEye, LucideEyeOff, LucideKeyRound, LucideCheck, LucideCalendar,
    LucideSmartphone, LucideCopy, LucideUndo2,
  ],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <svg lucideUsers class="header-icon"></svg>
          <div>
            <h1 class="page-title">Employees</h1>
            <p class="page-subtitle">Manage your workforce</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-ghost" type="button" (click)="exportCsv()">
            <svg lucideDownload class="icon-sm"></svg>
            Export
          </button>
          <button class="btn-primary" type="button" (click)="openAdd()">
            <svg lucideUserPlus class="icon-sm"></svg>
            Add Employee
          </button>
        </div>
      </div>

      <!-- Invite result banner -->
      @if (inviteResult()) {
        <div class="invite-banner">
          <div class="invite-banner-body">
            <strong>{{ inviteResult()!.email }}</strong> was created successfully.
            @if (inviteResult()!.temporaryPassword) {
              <span>Their temporary password is:</span>
              <code class="temp-pwd">{{ inviteResult()!.temporaryPassword }}</code>
              <button class="copy-btn" type="button" (click)="copyTempPassword()" title="Copy password">
                <svg lucideCopy class="icon-xs"></svg>
              </button>
            }
          </div>
          <button class="banner-close" type="button" (click)="inviteResult.set(null)">
            <svg lucideX class="icon-sm"></svg>
          </button>
        </div>
      }

      <!-- Summary cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="sc-icon sc-total"><svg lucideUsers class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().total }}</span>
            <span class="sc-label">Total Employees</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="sc-icon sc-active"><svg lucideMonitor class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().activeNow }}</span>
            <span class="sc-label">Working Now</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="sc-icon sc-break"><svg lucideCoffee class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().onBreak }}</span>
            <span class="sc-label">On Break</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="sc-icon sc-off"><svg lucideClock class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().clockedOut }}</span>
            <span class="sc-label">Offline</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="sc-icon sc-agent"><svg lucideSmartphone class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().agentOnline }}</span>
            <span class="sc-label">Agents Online</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="sc-icon sc-susp"><svg lucideBan class="sc-icon-svg"></svg></div>
          <div class="sc-body">
            <span class="sc-value">{{ summary().suspended + summary().terminated }}</span>
            <span class="sc-label">Suspended / Inactive</span>
          </div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-row">
          <div class="search-box">
            <svg lucideSearch class="search-icon"></svg>
            <input class="search-input" placeholder="Search name, email, or employee ID..."
              autocomplete="off" [(ngModel)]="searchTerm" (input)="onSearch()">
          </div>
          <select class="filter-select" [(ngModel)]="roleFilter" (change)="onFilterChange()">
            <option value="">All roles</option>
            @for (r of roles(); track r.id) {
              <option [value]="r.id">{{ r.name }}</option>
            }
          </select>
          <select class="filter-select" [(ngModel)]="teamFilter" (change)="onFilterChange()">
            <option value="">All teams</option>
            @for (t of teams(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
          <select class="filter-select" [(ngModel)]="projectFilter" (change)="onFilterChange()">
            <option value="">All projects</option>
            @for (p of projects(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
          <select class="filter-select" [(ngModel)]="statusFilter" (change)="onFilterChange()">
            <option value="">All statuses</option>
            <option value="active">Working</option>
            <option value="break">On break</option>
            <option value="clocked_out">Offline</option>
          </select>
          <select class="filter-select" [(ngModel)]="employmentFilter" (change)="onFilterChange()">
            <option value="">All employment</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
          <select class="filter-select" [(ngModel)]="agentFilter" (change)="onFilterChange()">
            <option value="">Any agent</option>
            <option value="online">Agent online</option>
            <option value="offline">Agent offline</option>
            <option value="no_agent">No agent</option>
          </select>
        </div>
        <div class="filter-row">
          <div class="date-range">
            <span class="date-label">Joined</span>
            <input type="date" class="date-input" [(ngModel)]="joinedFrom" (change)="onFilterChange()">
            <span class="date-sep">to</span>
            <input type="date" class="date-input" [(ngModel)]="joinedTo" (change)="onFilterChange()">
          </div>
          <label class="chk-label">
            <input type="checkbox" class="chk" [(ngModel)]="includeDeleted" (change)="onFilterChange()">
            Show deleted
          </label>
          @if (hasActiveFilters()) {
            <button class="clear-filters" type="button" (click)="clearFilters()">
              <svg lucideX class="icon-xs"></svg>
              Clear filters
            </button>
          }
          <span class="result-count">{{ pagination().total }} employee(s)</span>
        </div>
      </div>

      <!-- Table -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-skeleton">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="sk-row">
                <div class="sk sk-cell" style="width:200px;height:16px"></div>
                <div class="sk sk-cell" style="width:80px;height:16px"></div>
                <div class="sk sk-cell" style="width:70px;height:16px"></div>
                <div class="sk sk-cell" style="width:90px;height:16px"></div>
                <div class="sk sk-cell" style="width:120px;height:16px"></div>
                <div class="sk sk-cell" style="width:80px;height:16px"></div>
                <div class="sk sk-cell" style="width:60px;height:16px"></div>
              </div>
            }
          </div>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  @for (col of columns; track col.key) {
                    <th class="th-sortable" [class.th-static]="!col.sortable" (click)="onSort(col)">
                      <div class="th-inner">
                        {{ col.label }}
                        @if (col.sortable) {
                          @if (sortBy() === col.sortKey && sortDir() === 'asc') {
                            <svg lucideChevronUp class="sort-icon"></svg>
                          } @else if (sortBy() === col.sortKey && sortDir() === 'desc') {
                            <svg lucideChevronDown class="sort-icon"></svg>
                          } @else {
                            <svg lucideArrowUpDown class="sort-icon sort-icon-dim"></svg>
                          }
                        }
                      </div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (emp of employees(); track emp.userId) {
                  <tr class="data-row" [class.row-suspended]="emp.employmentStatus === 'suspended'"
                    [class.row-terminated]="emp.employmentStatus === 'terminated'">
                    <td>
                      <div class="emp-cell">
                        <div class="avatar" [class.avatar-dim]="emp.employmentStatus !== 'active'">{{ initials(emp.fullName) }}</div>
                        <div class="emp-main">
                          <span class="emp-name">{{ emp.fullName }}</span>
                          <span class="emp-email">{{ emp.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="mono-cell">{{ emp.employeeId || '—' }}</td>
                    <td><span class="role-badge">{{ emp.roleName }}</span></td>
                    <td>{{ emp.team?.name || '—' }}</td>
                    <td>
                      <div class="proj-cell">
                        @for (p of emp.projects.slice(0, 2); track p.id) {
                          <span class="proj-chip">{{ p.name }}</span>
                        }
                        @if (emp.projects.length > 2) {
                          <span class="proj-more">+{{ emp.projects.length - 2 }}</span>
                        }
                        @if (emp.projects.length === 0) {
                          <span class="muted">—</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="status-badge" [class]="'badge-' + emp.currentStatus">
                        <span class="status-dot"></span>
                        {{ emp.currentStatus === 'active' ? 'Working' : emp.currentStatus === 'break' ? 'On break' : 'Offline' }}
                      </span>
                    </td>
                    <td>
                      <div class="agent-cell">
                        <span class="agent-dot" [class.agent-online]="emp.agentOnline"></span>
                        @if (emp.agentDevice) {
                          <span>{{ emp.agentDevice.deviceName }}</span>
                        } @else {
                          <span class="muted">No agent</span>
                        }
                      </div>
                    </td>
                    <td class="mono-cell">{{ timeAgo(emp.lastSeenAt) }}</td>
                    <td>
                      <span class="emp-badge" [class]="'emp-' + emp.employmentStatus">
                        {{ emp.employmentStatus }}
                      </span>
                    </td>
                    <td>
                      <div class="actions-wrap">
                        <button class="icon-btn" type="button" (click)="toggleActions(emp.userId, $event)">
                          <svg lucideMoreVertical class="icon-sm"></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10" class="empty-row">
                      <div class="empty-state">
                        <svg lucideUsers class="empty-icon"></svg>
                        <p class="empty-title">No employees found</p>
                        <p class="empty-sub">Adjust your filters or add a new employee.</p>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (pagination().totalPages > 1) {
            <div class="pagination">
              <button class="pg-btn" [disabled]="pagination().page <= 1" (click)="goPage(pagination().page - 1)">
                <svg lucideChevronLeft class="icon-xs"></svg>
              </button>
              @for (p of pageNumbers(); track p) {
                <button class="pg-btn pg-num" [class.pg-active]="p === pagination().page" (click)="goPage(p)">{{ p }}</button>
              }
              <button class="pg-btn" [disabled]="pagination().page >= pagination().totalPages" (click)="goPage(pagination().page + 1)">
                <svg lucideChevronRight class="icon-xs"></svg>
              </button>
            </div>
          }
        }
      </div>
    </div>

    <!-- Row actions menu -->
    @if (actionMenuFor() !== null) {
      <div class="menu-backdrop" (click)="closeActions()"></div>
      <div class="actions-menu">
        @if (selectedEmployee(); as emp) {
          <button class="menu-item" type="button" (click)="viewEmployee(emp)">
            <svg lucideEye class="icon-sm"></svg> View profile
          </button>
          <button class="menu-item" type="button" (click)="openEdit(emp)">
            <svg lucidePencil class="icon-sm"></svg> Edit
          </button>
          <button class="menu-item" type="button" (click)="resetPassword(emp)">
            <svg lucideKeyRound class="icon-sm"></svg> Reset password
          </button>
          @if (emp.agentDevice) {
            <button class="menu-item" type="button" (click)="revokeAgent(emp)">
              <svg lucideMonitor class="icon-sm"></svg> Revoke agent
            </button>
          }
          @if (emp.employmentStatus === 'active') {
            <button class="menu-item danger" type="button" (click)="suspendEmployee(emp)">
              <svg lucideBan class="icon-sm"></svg> Suspend
            </button>
          } @else if (emp.employmentStatus === 'suspended') {
            <button class="menu-item" type="button" (click)="reactivateEmployee(emp)">
              <svg lucidePlay class="icon-sm"></svg> Reactivate
            </button>
          }
          @if (emp.employmentStatus === 'terminated') {
            <button class="menu-item" type="button" (click)="restoreEmployee(emp)">
              <svg lucideUndo2 class="icon-sm"></svg> Restore
            </button>
          } @else {
            <button class="menu-item danger" type="button" (click)="softDeleteEmployee(emp)">
              <svg lucideTrash2 class="icon-sm"></svg> Delete employee
            </button>
          }
        }
      </div>
    }

    <!-- Add Employee Modal -->
    @if (addOpen()) {
      <div class="dialog-overlay" (click)="addOpen.set(false)"></div>
      <div class="dialog dialog-lg" role="dialog" aria-modal="true" aria-label="Add Employee">
        <div class="dialog-header">
          <h2 class="dialog-title">Add Employee</h2>
          <button class="dialog-close" type="button" (click)="addOpen.set(false)" aria-label="Close">
            <svg lucideX class="icon-sm"></svg>
          </button>
        </div>
        <div class="dialog-body">
          @if (addError()) {
            <div class="form-error">{{ addError() }}</div>
          }
          <div class="form-grid">
            <div class="field">
              <label class="form-label">First name <span class="req">*</span></label>
              <input #addFirstName class="form-input" type="text" autocomplete="off" [(ngModel)]="addForm.firstName" placeholder="Jane">
            </div>
            <div class="field">
              <label class="form-label">Last name <span class="req">*</span></label>
              <input class="form-input" type="text" autocomplete="off" [(ngModel)]="addForm.lastName" placeholder="Doe">
            </div>
            <div class="field">
              <label class="form-label">Email <span class="req">*</span></label>
              <input class="form-input" type="email" autocomplete="off" [(ngModel)]="addForm.email" placeholder="jane@company.com">
            </div>
            <div class="field">
              <label class="form-label">Phone</label>
              <input class="form-input" type="tel" autocomplete="off" [(ngModel)]="addForm.phone" placeholder="+1 555 000 0000">
            </div>
            <div class="field">
              <label class="form-label">Job title</label>
              <input class="form-input" type="text" autocomplete="off" [(ngModel)]="addForm.jobTitle" placeholder="Software Engineer">
            </div>
            <div class="field">
              <label class="form-label">Role <span class="req">*</span></label>
              <select class="form-input" [(ngModel)]="addForm.roleId">
                <option [ngValue]="0">Select a role</option>
                @for (r of availableRoles(); track r.id) {
                  <option [ngValue]="r.id">{{ r.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="form-label">Team</label>
              <select class="form-input" [(ngModel)]="addForm.teamId">
                <option [ngValue]="0">No team</option>
                @for (t of teams(); track t.id) {
                  <option [ngValue]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="form-label">Start date</label>
              <input class="form-input" type="date" [(ngModel)]="addForm.startDate">
            </div>
            <div class="field">
              <label class="form-label">Expected daily hours</label>
              <input class="form-input" type="number" min="1" max="24" step="0.5" [(ngModel)]="addForm.expectedDailyHours">
            </div>
            <div class="field">
              <label class="form-label">Employment status</label>
              <select class="form-input" [(ngModel)]="addForm.employmentStatus">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div class="field checkbox-field">
              <label class="chk-label-lg">
                <input type="checkbox" class="chk" [(ngModel)]="addForm.agentRequired">
                Desktop agent required
              </label>
              <span class="field-hint">Employee must pair the desktop agent before tracking time.</span>
            </div>
          </div>

          <div class="password-section">
            <div class="ps-head">
              <h3 class="ps-title">Password</h3>
              <button class="btn-ghost-sm" type="button" (click)="generatePassword()">
                <svg lucideRefreshCw class="icon-xs"></svg>
                Generate temporary password
              </button>
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="form-label">Password @if (!addForm.sendWelcomeEmail) { <span class="req">*</span> } @else { (optional) }</label>
                <div class="pwd-wrap">
                  <input class="form-input" [type]="addShowPwd() ? 'text' : 'password'" autocomplete="new-password"
                    [(ngModel)]="addForm.password" placeholder="••••••••••••">
                  <button class="pwd-toggle" type="button" (click)="addShowPwd.set(!addShowPwd())"
                    [attr.aria-label]="addShowPwd() ? 'Hide password' : 'Show password'">
                    @if (addShowPwd()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
                  </button>
                </div>
              </div>
              <div class="field">
                <label class="form-label">Confirm password @if (!addForm.sendWelcomeEmail) { <span class="req">*</span> } @else { (optional) }</label>
                <div class="pwd-wrap">
                  <input class="form-input" [type]="addShowConfirm() ? 'text' : 'password'" autocomplete="new-password"
                    [(ngModel)]="addForm.passwordConfirm" placeholder="••••••••••••">
                  <button class="pwd-toggle" type="button" (click)="addShowConfirm.set(!addShowConfirm())"
                    [attr.aria-label]="addShowConfirm() ? 'Hide password' : 'Show password'">
                    @if (addShowConfirm()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
                  </button>
                </div>
              </div>
            </div>
            <label class="chk-label-lg">
              <input type="checkbox" class="chk" [(ngModel)]="addForm.sendWelcomeEmail">
              Send welcome email with password setup link
            </label>
            @if (!addForm.sendWelcomeEmail) {
              <span class="field-hint">The temporary password will be shown once so you can share it with the employee.</span>
            }
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" type="button" (click)="addOpen.set(false)">Cancel</button>
          <button class="btn-primary" type="button" (click)="submitAdd()" [disabled]="addSubmitting()">
            @if (addSubmitting()) {
              <span class="spinner-sm"></span>
            }
            Create employee
          </button>
        </div>
      </div>
    }

    <!-- Edit Employee Modal -->
    @if (editOpen() && editingEmployee(); as emp) {
      <div class="dialog-overlay" (click)="editOpen.set(false)"></div>
      <div class="dialog dialog-lg" role="dialog" aria-modal="true" aria-label="Edit Employee">
        <div class="dialog-header">
          <h2 class="dialog-title">Edit Employee</h2>
          <button class="dialog-close" type="button" (click)="editOpen.set(false)" aria-label="Close">
            <svg lucideX class="icon-sm"></svg>
          </button>
        </div>
        <div class="dialog-body">
          @if (editError()) {
            <div class="form-error">{{ editError() }}</div>
          }
          <div class="form-grid">
            <div class="field">
              <label class="form-label">First name <span class="req">*</span></label>
              <input class="form-input" type="text" autocomplete="off" [(ngModel)]="editForm.firstName">
            </div>
            <div class="field">
              <label class="form-label">Last name <span class="req">*</span></label>
              <input class="form-input" type="text" autocomplete="off" [(ngModel)]="editForm.lastName">
            </div>
            <div class="field">
              <label class="form-label">Email <span class="req">*</span></label>
              <input class="form-input" type="email" autocomplete="off" [(ngModel)]="editForm.email">
            </div>
            <div class="field">
              <label class="form-label">Phone</label>
              <input class="form-input" type="tel" autocomplete="off" [(ngModel)]="editForm.phone">
            </div>
            <div class="field">
              <label class="form-label">Job title</label>
              <input class="form-input" type="text" autocomplete="off" [(ngModel)]="editForm.jobTitle">
            </div>
            <div class="field">
              <label class="form-label">Role <span class="req">*</span></label>
              <select class="form-input" [(ngModel)]="editForm.roleId">
                <option [ngValue]="0">Select a role</option>
                @for (r of availableRoles(); track r.id) {
                  <option [ngValue]="r.id">{{ r.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="form-label">Team</label>
              <select class="form-input" [(ngModel)]="editForm.teamId">
                <option [ngValue]="0">No team</option>
                @for (t of teams(); track t.id) {
                  <option [ngValue]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="form-label">Start date</label>
              <input class="form-input" type="date" [(ngModel)]="editForm.startDate">
            </div>
            <div class="field">
              <label class="form-label">Expected daily hours</label>
              <input class="form-input" type="number" min="1" max="24" step="0.5" [(ngModel)]="editForm.expectedDailyHours">
            </div>
            <div class="field">
              <label class="form-label">Employment status</label>
              <select class="form-input" [(ngModel)]="editForm.employmentStatus">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div class="field checkbox-field">
              <label class="chk-label-lg">
                <input type="checkbox" class="chk" [(ngModel)]="editForm.agentRequired">
                Desktop agent required
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" type="button" (click)="editOpen.set(false)">Cancel</button>
          <button class="btn-primary" type="button" (click)="submitEdit()" [disabled]="editSubmitting()">
            @if (editSubmitting()) {
              <span class="spinner-sm"></span>
            }
            Save changes
          </button>
        </div>
      </div>
    }

    <!-- Confirm dialog -->
    @if (confirmState(); as c) {
      <div class="dialog-overlay" (click)="confirmState.set(null)"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="Confirm">
        <div class="dialog-header">
          <h2 class="dialog-title">{{ c.title }}</h2>
          <button class="dialog-close" type="button" (click)="confirmState.set(null)" aria-label="Close">
            <svg lucideX class="icon-sm"></svg>
          </button>
        </div>
        <div class="dialog-body">
          <p class="confirm-message">{{ c.message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" type="button" (click)="confirmState.set(null)">Cancel</button>
          <button class="btn-danger" type="button" (click)="runConfirm()">{{ c.confirmLabel }}</button>
        </div>
      </div>
    }

    <!-- Employee detail drawer -->
    @if (detailOpen()) {
      <div class="detail-overlay" (click)="closeDetail()"></div>
      <div class="detail-panel">
        @if (detailEmployee(); as det) {
          <div class="detail-header">
            <div class="detail-user">
              <div class="avatar avatar-lg">{{ initials(det.employee.fullName) }}</div>
              <div>
                <h2 class="detail-name">{{ det.employee.fullName }}</h2>
                <span class="detail-email">{{ det.employee.email }}</span>
              </div>
            </div>
            <button class="detail-close" type="button" (click)="closeDetail()">
              <svg lucideX class="icon-sm"></svg>
            </button>
          </div>

          <div class="detail-tabs">
            @for (tab of detailTabs; track tab.key) {
              <button class="detail-tab" [class.tab-active]="detailTab() === tab.key"
                type="button" (click)="switchTab(tab.key)">
                {{ tab.label }}
              </button>
            }
          </div>

          <div class="detail-range">
            <svg lucideCalendar class="icon-xs"></svg>
            <input type="date" class="date-input" [(ngModel)]="detailStart" (change)="onDetailRangeChange()">
            <span class="date-sep">to</span>
            <input type="date" class="date-input" [(ngModel)]="detailEnd" (change)="onDetailRangeChange()">
          </div>

          <div class="detail-body">
            @if (detailLoading()) {
              <div class="detail-skeleton">
                @for (i of [1,2,3,4]; track i) {
                  <div class="sk sk-detail-block"></div>
                }
              </div>
            } @else if (detailTab() === 'overview') {
              <div class="quick-actions">
                <button class="qa-btn" type="button" (click)="openEditFromDetail()">
                  <svg lucidePencil class="icon-sm"></svg> Edit
                </button>
                <button class="qa-btn" type="button" (click)="resetPassword(det.employee)">
                  <svg lucideKeyRound class="icon-sm"></svg> Reset password
                </button>
                @if (det.employee.employmentStatus === 'active') {
                  <button class="qa-btn danger" type="button" (click)="suspendEmployee(det.employee)">
                    <svg lucideBan class="icon-sm"></svg> Suspend
                  </button>
                } @else {
                  <button class="qa-btn" type="button" (click)="reactivateEmployee(det.employee)">
                    <svg lucidePlay class="icon-sm"></svg> Reactivate
                  </button>
                }
                <button class="qa-btn danger" type="button" (click)="softDeleteEmployee(det.employee)">
                  <svg lucideTrash2 class="icon-sm"></svg> Deactivate
                </button>
              </div>

              <div class="det-summary">
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.workedHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Worked</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.expectedHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Expected</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.overtimeHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Overtime</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.daysPresent }}<ng-container *ngIf="det.summary.workingDaysInRange"> / {{ det.summary.workingDaysInRange }}</ng-container></span>
                  <span class="det-stat-lbl">Days present</span>
                </div>
              </div>

              <div class="det-details">
                <div class="det-row"><span class="det-label">Employee ID</span><span class="det-val">{{ det.employee.employeeId || '—' }}</span></div>
                <div class="det-row"><span class="det-label">Role</span><span class="det-val">{{ det.employee.roleName }}</span></div>
                <div class="det-row"><span class="det-label">Job title</span><span class="det-val">{{ det.employee.jobTitle || '—' }}</span></div>
                <div class="det-row"><span class="det-label">Team</span><span class="det-val">{{ det.employee.team?.name || '—' }}</span></div>
                <div class="det-row"><span class="det-label">Phone</span><span class="det-val">{{ det.employee.phone || '—' }}</span></div>
                <div class="det-row"><span class="det-label">Employment</span>
                  <span class="emp-badge" [class]="'emp-' + det.employee.employmentStatus">{{ det.employee.employmentStatus }}</span>
                </div>
                <div class="det-row"><span class="det-label">Member since</span><span class="det-val">{{ det.employee.memberSince | date:'mediumDate' }}</span></div>
                <div class="det-row"><span class="det-label">Start date</span><span class="det-val">{{ det.employee.startDate || '—' }}</span></div>
                <div class="det-row"><span class="det-label">Expected daily hours</span><span class="det-val">{{ det.employee.expectedDailyHours ?? 'Company policy' }}</span></div>
                <div class="det-row"><span class="det-label">Desktop agent required</span><span class="det-val">{{ det.employee.agentRequired ? 'Yes' : 'No' }}</span></div>
              </div>

              <h3 class="detail-section-title">Desktop Agent</h3>
              <div class="agent-card">
                @if (det.employee.agentDevice) {
                  <div class="agent-card-row">
                    <svg lucideMonitor class="icon-sm agent-icon"></svg>
                    <div>
                      <div class="agent-name">{{ det.employee.agentDevice.deviceName }}</div>
                      <div class="agent-sub">{{ det.employee.agentDevice.operatingSystem }} · v{{ det.employee.agentDevice.agentVersion }}</div>
                    </div>
                    <span class="agent-dot-badge" [class.online]="det.employee.agentOnline">
                      {{ det.employee.agentOnline ? 'Online' : 'Offline' }}
                    </span>
                  </div>
                  <div class="agent-card-row sub">
                    <span>Last seen: {{ timeAgo(det.employee.agentDevice.lastSeenAt) }}</span>
                    <span>Paired: {{ det.employee.agentDevice.pairedAt | date:'mediumDate' }}</span>
                  </div>
                } @else {
                  <div class="agent-card-row">
                    <svg lucideMonitor class="icon-sm agent-icon"></svg>
                    <span class="muted">No desktop agent paired</span>
                  </div>
                }
              </div>

              <h3 class="detail-section-title">Quick stats</h3>
              <div class="det-details">
                <div class="det-row"><span class="det-label">Average daily</span><span class="det-val">{{ det.summary.averageDailyHours | number:'1.0-1' }}h</span></div>
                <div class="det-row"><span class="det-label">Longest day</span><span class="det-val">{{ det.summary.longestDayHours | number:'1.0-1' }}h</span></div>
                <div class="det-row"><span class="det-label">Break violations</span><span class="det-val">{{ det.summary.breakViolations }}</span></div>
                <div class="det-row"><span class="det-label">Suspicious screenshots</span><span class="det-val">{{ det.summary.suspiciousScreenshotCount }}</span></div>
                <div class="det-row"><span class="det-label">Auto / manual breaks</span><span class="det-val">{{ det.summary.autoBreakCount }} / {{ det.summary.manualBreakCount }}</span></div>
              </div>
            } @else if (detailTab() === 'projects') {
              <h3 class="detail-section-title">Assigned projects</h3>
              @if (det.employee.projects.length === 0) {
                <div class="tab-empty">
                  <svg lucideFolderOpen class="empty-icon"></svg>
                  <p>No projects assigned</p>
                </div>
              } @else {
                <div class="proj-list">
                  @for (p of det.employee.projects; track p.id) {
                    <div class="proj-item">
                      <svg lucideFolderOpen class="icon-sm proj-item-icon"></svg>
                      <span>{{ p.name }}</span>
                    </div>
                  }
                </div>
              }
            } @else if (detailTab() === 'sessions') {
              <h3 class="detail-section-title">Sessions ({{ detailSessions().length }})</h3>
              @if (detailSessions().length === 0) {
                <div class="tab-empty">
                  <svg lucideClock class="empty-icon"></svg>
                  <p>No sessions in this period</p>
                </div>
              } @else {
                <div class="list">
                  @for (s of detailSessions(); track s.id) {
                    <div class="list-item">
                      <div class="list-item-top">
                        <span class="list-item-title">{{ s.clockIn | date:'EEE, MMM d' }}</span>
                        <span class="eval-badge eval-sm" [class]="'eval-' + (s.status === 'completed' ? 'good' : 'excellent')">{{ s.status }}</span>
                      </div>
                      <div class="list-item-sub">
                        {{ s.clockIn | date:'HH:mm' }} → {{ s.clockOut ? (s.clockOut | date:'HH:mm') : 'now' }}
                        · {{ (s.workedMinutes / 60) | number:'1.0-1' }}h worked
                        · {{ s.totalBreakMinutes }}min break
                      </div>
                    </div>
                  }
                </div>
              }
            } @else if (detailTab() === 'breaks') {
              <h3 class="detail-section-title">Breaks ({{ detailBreaks().length }})</h3>
              @if (detailBreaks().length === 0) {
                <div class="tab-empty">
                  <svg lucideCoffee class="empty-icon"></svg>
                  <p>No breaks in this period</p>
                </div>
              } @else {
                <div class="list">
                  @for (b of detailBreaks(); track b.id) {
                    <div class="list-item">
                      <div class="list-item-top">
                        <span class="list-item-title">{{ b.start | date:'EEE, MMM d HH:mm' }}</span>
                        <span class="tl-break-tag" [class.tl-break-auto]="b.isAuto">{{ b.isAuto ? 'Auto' : 'Manual' }}</span>
                      </div>
                      <div class="list-item-sub">
                        {{ b.duration }}min
                        @if (b.isAuto) {
                          <span class="tl-break-auto-text">Automatic Break</span>
                        } @else if (b.reason) {
                          <span class="tl-break-reason">— {{ b.reason }}</span>
                        } @else {
                          <span class="tl-break-noreason">No reason provided</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            } @else if (detailTab() === 'overtime') {
              <h3 class="detail-section-title">Overtime ({{ detailOvertime().length }})</h3>
              @if (detailOvertime().length === 0) {
                <div class="tab-empty">
                  <svg lucideBarChart3 class="empty-icon"></svg>
                  <p>No overtime declarations</p>
                </div>
              } @else {
                <div class="list">
                  @for (o of detailOvertime(); track o.id) {
                    <div class="list-item">
                      <div class="list-item-top">
                        <span class="list-item-title">{{ o.date }}</span>
                        <span class="eval-badge eval-sm" [class]="'eval-' + (o.status === 'approved' ? 'good' : o.status === 'rejected' ? 'absent' : 'acceptable')">{{ o.status }}</span>
                      </div>
                      <div class="list-item-sub">{{ o.overtimeMinutes }}min overtime · {{ o.workedMinutes }}min worked</div>
                    </div>
                  }
                </div>
              }
            } @else if (detailTab() === 'statistics') {
              <div class="det-summary">
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.workedHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Worked</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.missingHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Missing</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.breakHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Breaks</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ det.summary.averageDailyHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Avg daily</span>
                </div>
              </div>
              <h3 class="detail-section-title">Daily timeline</h3>
              <div class="timeline">
                @for (day of detailTimeline(); track day.date) {
                  <div class="tl-day" [class.tl-absent]="day.attendance === 'absent'" [class.tl-day-off]="day.attendance === 'day_off'">
                    <div class="tl-header">
                      <span class="tl-date">{{ day.date | date:'EEE, MMM d' }}</span>
                      <span class="eval-badge eval-sm" [class]="'eval-' + day.attendance">{{ day.attendance }}</span>
                    </div>
                    @if (day.isWorkingDay && day.clockIn) {
                      <div class="tl-times">
                        <span class="tl-time">{{ day.clockIn | date:'HH:mm' }}{{ day.clockOut ? ' → ' + (day.clockOut | date:'HH:mm') : ' → now' }}</span>
                        <span class="tl-hours">{{ (day.workedMinutes / 60) | number:'1.0-1' }}h</span>
                      </div>
                      @if (day.breaks.length > 0) {
                        <div class="tl-breaks">{{ day.breaks.length }} break(s) — {{ day.breakMinutes }}min</div>
                      }
                      @if (day.overtimeMinutes > 0) {
                        <div class="tl-ot">{{ (day.overtimeMinutes / 60) | number:'1.0-1' }}h overtime</div>
                      }
                      @if (day.suspiciousCount > 0) {
                        <div class="tl-alert">{{ day.suspiciousCount }} suspicious screenshot(s)</div>
                      }
                    } @else if (day.attendance === 'day_off') {
                      <div class="tl-dayoff">Day off</div>
                    } @else {
                      <div class="tl-absent-text">No activity</div>
                    }
                  </div>
                } @empty {
                  <div class="tab-empty">
                    <svg lucideBarChart3 class="empty-icon"></svg>
                    <p>No data in this period</p>
                  </div>
                }
              </div>
            } @else if (detailTab() === 'alerts') {
              <h3 class="detail-section-title">Alerts ({{ detailAlerts().length }})</h3>
              @if (detailAlerts().length === 0) {
                <div class="tab-empty">
                  <svg lucideAlertTriangle class="empty-icon"></svg>
                  <p>No alerts</p>
                </div>
              } @else {
                <div class="list">
                  @for (a of detailAlerts(); track a.id) {
                    <div class="list-item">
                      <div class="list-item-top">
                        <span class="list-item-title">{{ a.title }}</span>
                        <span class="eval-badge eval-sm" [class]="'sev-' + a.severity">{{ a.severity }}</span>
                      </div>
                      <div class="list-item-sub">{{ a.message }} · {{ a.createdAt | date:'medium' }}</div>
                    </div>
                  }
                </div>
              }
            } @else if (detailTab() === 'devices') {
              <h3 class="detail-section-title">Devices ({{ detailDevices().length }})</h3>
              @if (detailDevices().length === 0) {
                <div class="tab-empty">
                  <svg lucideSmartphone class="empty-icon"></svg>
                  <p>No devices paired</p>
                </div>
              } @else {
                <div class="list">
                  @for (d of detailDevices(); track d.id) {
                    <div class="list-item">
                      <div class="list-item-top">
                        <span class="list-item-title">{{ d.deviceName }}</span>
                        <span class="emp-badge" [class]="d.revoked ? 'emp-terminated' : 'emp-active'">{{ d.revoked ? 'Revoked' : 'Active' }}</span>
                      </div>
                      <div class="list-item-sub">
                        {{ d.operatingSystem }} · {{ d.hostname }}
                        · last seen {{ timeAgo(d.lastSeenAt) }}
                      </div>
                      @if (d.active && !d.revoked) {
                        <button class="revoke-link" type="button" (click)="revokeDevice(d)">
                          <svg lucideMonitor class="icon-xs"></svg>
                          Revoke access
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        }
      </div>
    }

    <!-- Toasts -->
    <div class="toast-wrap">
      @for (t of toasts(); track t.id) {
        <div class="toast" [class]="'toast-' + t.type">
          @if (t.type === 'success') {
            <svg lucideCheck class="icon-sm"></svg>
          } @else if (t.type === 'error') {
            <svg lucideAlertTriangle class="icon-sm"></svg>
          } @else {
            <svg lucideClock class="icon-sm"></svg>
          }
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page { padding: 0; }

    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    .header-icon { width: 28px; height: 28px; color: var(--rws-accent); }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--rws-text); }
    .page-subtitle { margin: 0.125rem 0 0; font-size: 0.875rem; color: var(--rws-text-muted); }
    .header-actions { display: flex; align-items: center; gap: 0.625rem; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: none; border-radius: var(--rws-radius);
      background: var(--rws-accent); color: #fff; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: all 150ms;
    }
    .btn-primary:hover { filter: brightness(1.08); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text); font-size: 0.875rem; font-weight: 500;
      cursor: pointer; transition: all 150ms;
    }
    .btn-ghost:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .btn-ghost-sm {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.3125rem 0.625rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text-muted); font-size: 0.75rem; font-weight: 500;
      cursor: pointer; transition: all 150ms;
    }
    .btn-ghost-sm:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .btn-secondary {
      padding: 0.5rem 1rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text); font-size: 0.875rem; font-weight: 500;
      cursor: pointer;
    }
    .btn-secondary:hover { background: var(--rws-bg); }
    .btn-danger {
      padding: 0.5rem 1rem; border: none; border-radius: var(--rws-radius);
      background: #dc2626; color: #fff; font-size: 0.875rem; font-weight: 600;
      cursor: pointer;
    }
    .btn-danger:hover { background: #b91c1c; }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }
    .muted { color: var(--rws-text-muted); }
    .mono-cell { font-family: var(--rws-font-mono); font-size: 0.8125rem; white-space: nowrap; }

    /* Invite banner */
    .invite-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.75rem 1rem; margin-bottom: 1rem; border-radius: 10px;
      background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 0.875rem;
    }
    .invite-banner-body { display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem; }
    .temp-pwd {
      font-family: var(--rws-font-mono); background: #d1fae5; padding: 0.125rem 0.5rem;
      border-radius: 6px; font-weight: 600; color: #065f46;
    }
    .copy-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border: none; border-radius: 6px; background: #a7f3d0;
      color: #065f46; cursor: pointer;
    }
    .copy-btn:hover { background: #6ee7b7; }
    .banner-close {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent;
      color: #065f46; cursor: pointer; flex-shrink: 0;
    }
    .banner-close:hover { background: rgba(0,0,0,0.06); }

    /* Summary cards */
    .summary-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; margin-bottom: 1rem;
    }
    .summary-card {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.875rem 1rem; background: #fff; border-radius: 12px;
      border: 1px solid var(--rws-border); box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .sc-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sc-icon-svg { width: 18px; height: 18px; }
    .sc-total { background: #eef2ff; color: #4f46e5; }
    .sc-active { background: #ecfdf5; color: #059669; }
    .sc-break { background: #fef3c7; color: #d97706; }
    .sc-off { background: #f3f4f6; color: #6b7280; }
    .sc-agent { background: #dbeafe; color: #2563eb; }
    .sc-susp { background: #fef2f2; color: #dc2626; }
    .sc-body { display: flex; flex-direction: column; }
    .sc-value { font-size: 1.125rem; font-weight: 700; color: var(--rws-text); line-height: 1.2; }
    .sc-label { font-size: 0.6875rem; color: var(--rws-text-muted); margin-top: 0.125rem; }

    /* Filter bar */
    .filter-bar {
      display: flex; flex-direction: column; gap: 0.625rem;
      padding: 0.875rem 1.125rem; background: #fff; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--rws-border);
      margin-bottom: 1rem;
    }
    .filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .search-box {
      position: relative; display: flex; align-items: center;
      background: var(--rws-bg); border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      padding: 0 0.625rem;
    }
    .search-icon { width: 16px; height: 16px; color: var(--rws-text-muted); flex-shrink: 0; }
    .search-input {
      border: none; background: transparent; padding: 0.5rem 0.5rem; font-size: 0.875rem;
      color: var(--rws-text); width: 230px; outline: none;
    }
    .filter-select {
      padding: 0.5rem 0.625rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.8125rem; color: var(--rws-text); background: #fff; cursor: pointer;
    }
    .date-range { display: flex; align-items: center; gap: 0.375rem; }
    .date-label { font-size: 0.75rem; color: var(--rws-text-muted); }
    .date-input {
      padding: 0.375rem 0.5rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.8125rem; color: var(--rws-text);
    }
    .date-sep { font-size: 0.75rem; color: var(--rws-text-muted); }
    .chk-label {
      display: inline-flex; align-items: center; gap: 0.375rem;
      font-size: 0.8125rem; color: var(--rws-text-muted); cursor: pointer;
    }
    .chk-label-lg {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; color: var(--rws-text); cursor: pointer;
    }
    .chk { accent-color: var(--rws-accent); }
    .clear-filters {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.625rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text-muted); font-size: 0.75rem; font-weight: 500;
      cursor: pointer; transition: all 150ms;
    }
    .clear-filters:hover { border-color: #dc2626; color: #dc2626; }
    .result-count { margin-left: auto; font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* Table */
    .table-card {
      background: #fff; border-radius: 12px; border: 1px solid var(--rws-border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04); overflow: hidden;
    }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th {
      text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600;
      color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 1px solid var(--rws-border); background: var(--rws-bg);
      white-space: nowrap;
    }
    .th-sortable { cursor: pointer; user-select: none; }
    .th-static { cursor: default; }
    .th-inner { display: flex; align-items: center; gap: 0.25rem; }
    .sort-icon { width: 14px; height: 14px; }
    .sort-icon-dim { opacity: 0.3; }
    .data-table td {
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--rws-border);
      color: var(--rws-text); vertical-align: middle; white-space: nowrap;
    }
    .data-row { transition: background 100ms; }
    .data-row:hover { background: var(--rws-bg-hover); }
    .row-suspended { background: #fffbeb; }
    .row-terminated { background: var(--rws-bg); opacity: 0.75; }

    .emp-cell { display: flex; align-items: center; gap: 0.625rem; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; color: #fff;
    }
    .avatar-lg { width: 44px; height: 44px; font-size: 0.9375rem; }
    .avatar-dim { opacity: 0.5; }
    .emp-main { display: flex; flex-direction: column; }
    .emp-name { font-weight: 600; font-size: 0.875rem; color: var(--rws-text); }
    .emp-email { font-size: 0.75rem; color: var(--rws-text-muted); margin-top: 1px; }

    .role-badge {
      display: inline-flex; padding: 0.25rem 0.5rem; border-radius: 6px;
      background: #f1f5f9; color: #334155; font-size: 0.75rem; font-weight: 600;
    }

    .proj-cell { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; max-width: 180px; }
    .proj-chip {
      padding: 0.125rem 0.375rem; border-radius: 4px; background: #eef2ff;
      color: #4f46e5; font-size: 0.6875rem; font-weight: 500;
    }
    .proj-more { font-size: 0.6875rem; color: var(--rws-text-muted); }

    .status-badge {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.25rem 0.625rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; white-space: nowrap;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-break { background: #fef3c7; color: #92400e; }
    .badge-clocked_out { background: #f3f4f6; color: #6b7280; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    .agent-cell { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; }
    .agent-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; flex-shrink: 0;
    }
    .agent-online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }

    .emp-badge {
      display: inline-flex; padding: 0.25rem 0.5rem; border-radius: 999px;
      font-size: 0.6875rem; font-weight: 600; text-transform: capitalize;
    }
    .emp-active { background: #dcfce7; color: #166534; }
    .emp-suspended { background: #fef3c7; color: #92400e; }
    .emp-terminated { background: #f3f4f6; color: #6b7280; }

    .actions-wrap { text-align: right; }
    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border: none; border-radius: 8px;
      background: transparent; color: var(--rws-text-muted); cursor: pointer;
      transition: all 150ms;
    }
    .icon-btn:hover { background: var(--rws-bg); color: var(--rws-text); }

    .empty-row { padding: 2rem 1rem; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; padding: 2.5rem 0;
      text-align: center;
    }
    .empty-icon { width: 40px; height: 40px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.75rem; }
    .empty-title { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      padding: 1rem; border-top: 1px solid var(--rws-border);
    }
    .pg-btn {
      display: flex; align-items: center; justify-content: center;
      min-width: 36px; height: 36px; border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border); background: #fff; color: var(--rws-text);
      cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 150ms;
    }
    .pg-btn:hover:not(:disabled) { border-color: var(--rws-accent); color: var(--rws-accent); }
    .pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pg-active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }

    /* Skeleton */
    .table-skeleton { padding: 1.25rem; }
    .sk-row { display: flex; gap: 2rem; padding: 0.875rem 0; border-bottom: 1px solid var(--rws-border); }
    .sk { background: #f0f2f5; border-radius: 6px; animation: shimmer 1.5s ease-in-out infinite; }
    .sk-detail-block { height: 48px; margin-bottom: 0.75rem; border-radius: 8px; }
    @keyframes shimmer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

    /* Action menu */
    .menu-backdrop { position: fixed; inset: 0; z-index: 110; }
    .actions-menu {
      position: fixed; z-index: 111; min-width: 210px; background: #fff;
      border: 1px solid var(--rws-border); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 0.375rem;
      top: 50%; left: 50%; transform: translate(-50%, -50%);
    }
    .menu-item {
      display: flex; align-items: center; gap: 0.5rem; width: 100%;
      padding: 0.5rem 0.625rem; border: none; border-radius: 6px; background: transparent;
      color: var(--rws-text); font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      text-align: left; transition: background 100ms;
    }
    .menu-item:hover { background: var(--rws-bg); }
    .menu-item.danger { color: #dc2626; }
    .menu-item.danger:hover { background: #fef2f2; }

    /* Dialog */
    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; }
    .dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 440px; max-width: calc(100vw - 32px); max-height: 86vh; overflow-y: auto;
      background: #fff; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.2);
      z-index: 201; animation: popIn 180ms ease;
    }
    .dialog-lg { width: 680px; }
    @keyframes popIn { from { opacity: 0; transform: translate(-50%, -46%); } to { opacity: 1; transform: translate(-50%, -50%); } }
    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.125rem 1.25rem; border-bottom: 1px solid var(--rws-border);
      position: sticky; top: 0; background: #fff; z-index: 1;
    }
    .dialog-title { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--rws-text); }
    .dialog-close {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: transparent; cursor: pointer; color: var(--rws-text-muted);
    }
    .dialog-close:hover { background: var(--rws-bg); }
    .dialog-body { padding: 1.25rem; }
    .dialog-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem;
      padding: 1rem 1.25rem; border-top: 1px solid var(--rws-border);
      position: sticky; bottom: 0; background: #fff;
    }
    .form-error {
      padding: 0.625rem 0.875rem; margin-bottom: 0.875rem; border-radius: 8px;
      background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 0.8125rem;
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-label { font-size: 0.75rem; font-weight: 600; color: var(--rws-text-muted); }
    .req { color: #dc2626; }
    .form-input {
      padding: 0.5rem 0.75rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.875rem; color: var(--rws-text); background: #fff; outline: none;
      transition: border-color 150ms;
    }
    .form-input:focus { border-color: var(--rws-accent); }
    .field-hint { font-size: 0.6875rem; color: var(--rws-text-muted); }
    .checkbox-field { justify-content: flex-end; padding-bottom: 0.375rem; }
    .pwd-wrap { position: relative; }
    .pwd-wrap .form-input { width: 100%; padding-right: 2.5rem; }
    .pwd-toggle {
      position: absolute; right: 0.375rem; top: 50%; transform: translateY(-50%);
      border: none; background: transparent; padding: 0.25rem; cursor: pointer;
      color: var(--rws-text-muted); display: flex; align-items: center; justify-content: center;
    }
    .pwd-toggle:hover { color: var(--rws-text); }
    .pwd-toggle svg { width: 16px; height: 16px; }

    .password-section {
      margin-top: 1.125rem; padding: 1rem; border: 1px solid var(--rws-border);
      border-radius: 10px; background: var(--rws-bg);
      display: flex; flex-direction: column; gap: 0.75rem;
    }
    .ps-head { display: flex; align-items: center; justify-content: space-between; }
    .ps-title { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--rws-text); }
    .confirm-message { margin: 0; font-size: 0.875rem; color: var(--rws-text); line-height: 1.55; }

    /* Detail drawer */
    .detail-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100;
      animation: fadeIn 200ms ease;
    }
    .detail-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 560px; max-width: 100vw;
      background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,0.12); z-index: 101;
      overflow-y: auto; animation: slideInRight 250ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .detail-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--rws-border);
      position: sticky; top: 0; background: #fff; z-index: 1;
    }
    .detail-user { display: flex; align-items: center; gap: 0.75rem; }
    .detail-name { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--rws-text); }
    .detail-email { font-size: 0.8125rem; color: var(--rws-text-muted); }
    .detail-close {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: transparent; cursor: pointer; color: var(--rws-text-muted);
    }
    .detail-close:hover { background: var(--rws-bg); }
    .detail-tabs {
      display: flex; gap: 0.25rem; padding: 0.625rem 1rem 0; overflow-x: auto;
      border-bottom: 1px solid var(--rws-border);
    }
    .detail-tab {
      padding: 0.5rem 0.75rem; border: none; background: transparent;
      font-size: 0.8125rem; font-weight: 600; color: var(--rws-text-muted);
      cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap;
      transition: all 150ms;
    }
    .detail-tab:hover { color: var(--rws-text); }
    .tab-active { color: var(--rws-accent); border-bottom-color: var(--rws-accent); }
    .detail-range {
      display: flex; align-items: center; gap: 0.375rem;
      padding: 0.625rem 1.5rem; background: var(--rws-bg);
      border-bottom: 1px solid var(--rws-border);
    }
    .detail-body { padding: 1.25rem 1.5rem 2rem; }
    .detail-skeleton { padding: 1rem 0; }

    .quick-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
    .qa-btn {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text); font-size: 0.75rem; font-weight: 600;
      cursor: pointer; transition: all 150ms;
    }
    .qa-btn:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .qa-btn.danger { color: #dc2626; }
    .qa-btn.danger:hover { border-color: #dc2626; color: #dc2626; }

    .det-summary {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.625rem; margin-bottom: 1.25rem;
    }
    .det-stat {
      display: flex; flex-direction: column; padding: 0.625rem;
      background: var(--rws-bg); border-radius: 10px; text-align: center;
    }
    .det-stat-val { font-size: 1rem; font-weight: 700; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .det-stat-lbl { font-size: 0.6875rem; color: var(--rws-text-muted); margin-top: 2px; }
    .det-details { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
    .det-row {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      padding: 0.4375rem 0; border-bottom: 1px solid var(--rws-border);
    }
    .det-label { font-size: 0.8125rem; color: var(--rws-text-muted); }
    .det-val { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); text-align: right; }
    .detail-section-title { margin: 1.25rem 0 0.75rem; font-size: 0.9375rem; font-weight: 600; color: var(--rws-text); }

    .agent-card {
      border: 1px solid var(--rws-border); border-radius: 10px; padding: 0.875rem;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .agent-card-row { display: flex; align-items: center; gap: 0.625rem; font-size: 0.8125rem; color: var(--rws-text); }
    .agent-card-row.sub { font-size: 0.75rem; color: var(--rws-text-muted); justify-content: space-between; }
    .agent-icon { color: var(--rws-accent); }
    .agent-name { font-weight: 600; }
    .agent-sub { font-size: 0.75rem; color: var(--rws-text-muted); }
    .agent-dot-badge {
      margin-left: auto; padding: 0.1875rem 0.5rem; border-radius: 999px;
      background: #f3f4f6; color: #6b7280; font-size: 0.6875rem; font-weight: 600;
    }
    .agent-dot-badge.online { background: #dcfce7; color: #166534; }

    .tab-empty {
      display: flex; flex-direction: column; align-items: center; gap: 0.625rem;
      padding: 2.5rem 0; color: var(--rws-text-muted); font-size: 0.875rem;
    }
    .proj-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .proj-item {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.625rem 0.875rem; border: 1px solid var(--rws-border);
      border-radius: 10px; font-size: 0.875rem; color: var(--rws-text);
    }
    .proj-item-icon { color: var(--rws-accent); }
    .list { display: flex; flex-direction: column; gap: 0.5rem; }
    .list-item {
      padding: 0.75rem 0.875rem; border: 1px solid var(--rws-border);
      border-radius: 10px; background: #fff;
    }
    .list-item-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .list-item-title { font-size: 0.875rem; font-weight: 600; color: var(--rws-text); }
    .list-item-sub { margin-top: 0.25rem; font-size: 0.75rem; color: var(--rws-text-muted); }
    .revoke-link {
      display: inline-flex; align-items: center; gap: 0.375rem; margin-top: 0.5rem;
      padding: 0; border: none; background: transparent; color: #dc2626;
      font-size: 0.75rem; font-weight: 600; cursor: pointer;
    }
    .revoke-link:hover { text-decoration: underline; }

    .timeline { display: flex; flex-direction: column; gap: 0.5rem; }
    .tl-day {
      padding: 0.75rem 0.875rem; border: 1px solid var(--rws-border); border-radius: 10px;
      background: #fff;
    }
    .tl-absent { border-left: 3px solid #ef4444; }
    .tl-day-off { border-left: 3px solid #22c55e; background: #f0fdf9; }
    .tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.375rem; }
    .tl-date { font-weight: 600; font-size: 0.8125rem; color: var(--rws-text); }
    .tl-times { display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--rws-text); }
    .tl-time { font-family: var(--rws-font-mono); }
    .tl-hours { font-family: var(--rws-font-mono); font-weight: 500; }
    .tl-breaks { margin-top: 0.25rem; font-size: 0.75rem; color: #9333ea; }
    .tl-ot { margin-top: 0.25rem; font-size: 0.75rem; font-weight: 500; color: #d97706; }
    .tl-alert { margin-top: 0.25rem; font-size: 0.75rem; font-weight: 500; color: #dc2626; }
    .tl-dayoff { font-size: 0.8125rem; color: #16a34a; font-style: italic; }
    .tl-absent-text { font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }
    .tl-break-tag {
      font-size: 0.625rem; font-weight: 600; padding: 0.0625rem 0.375rem; border-radius: 4px;
      background: rgba(19,141,158,0.1); color: var(--rws-accent); white-space: nowrap;
    }
    .tl-break-tag.tl-break-auto { background: rgba(245,158,11,0.1); color: #d97706; }
    .tl-break-auto-text { font-size: 0.6875rem; color: #d97706; font-weight: 500; }
    .tl-break-reason { font-style: italic; color: var(--rws-text); }
    .tl-break-noreason { font-size: 0.6875rem; color: var(--rws-text-muted); font-style: italic; opacity: 0.7; }

    .eval-badge {
      display: inline-flex; padding: 0.25rem 0.625rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; text-transform: capitalize; white-space: nowrap;
    }
    .eval-sm { font-size: 0.6875rem; padding: 0.125rem 0.5rem; }
    .eval-good { background: #dcfce7; color: #166534; }
    .eval-excellent { background: #dbeafe; color: #1e40af; }
    .eval-acceptable { background: #fef9c3; color: #854d0e; }
    .eval-absent { background: #f3f4f6; color: #6b7280; }
    .eval-day_off { background: #f0fdf4; color: #166534; }
    .sev-info { background: #dbeafe; color: #1e40af; }
    .sev-warning { background: #fef3c7; color: #92400e; }
    .sev-critical { background: #fef2f2; color: #b91c1c; }

    /* Toasts */
    .toast-wrap {
      position: fixed; bottom: 24px; right: 24px; z-index: 300;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .toast {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.8125rem; font-weight: 500;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); animation: popInToast 200ms ease;
    }
    @keyframes popInToast { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .toast-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .toast-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .toast-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

    .spinner-sm {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
      animation: spin 0.6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
      .search-input { width: 160px; }
    }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .form-grid { grid-template-columns: 1fr; }
      .detail-panel { width: 100vw; }
      .dialog-lg { width: calc(100vw - 24px); }
      .search-input { width: 130px; }
      .result-count { display: none; }
      .data-table th, .data-table td { padding: 0.5rem 0.625rem; }
      .emp-email { display: none; }
    }
  `],
})
export class HrEmployeesComponent implements OnInit, OnDestroy {
  private readonly analyticsService = inject(HrAnalyticsService);
  private readonly employeesService = inject(HrEmployeesService);
  private readonly teamsService = inject(HrTeamsService);
  private readonly projectsService = inject(HrProjectsService);
  private readonly overtimeService = inject(HrOvertimeService);
  private readonly alertsService = inject(HrAlertsService);
  private readonly agentDevices = inject(AgentDevicesService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  protected readonly employees = signal<AnalyticsEmployee[]>([]);
  protected readonly loading = signal(true);
  protected readonly pagination = signal({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  protected readonly summary = signal<EmployeeListSummary>({ ...DEFAULT_SUMMARY });
  protected readonly sortBy = signal('fullName');
  protected readonly sortDir = signal<'asc' | 'desc'>('asc');

  protected searchTerm = '';
  protected roleFilter = '';
  protected teamFilter = '';
  protected projectFilter = '';
  protected statusFilter = '';
  protected employmentFilter = '';
  protected agentFilter = '';
  protected joinedFrom = '';
  protected joinedTo = '';
  protected includeDeleted = false;

  protected readonly teams = signal<HrTeam[]>([]);
  protected readonly roles = signal<HrRole[]>([]);
  protected readonly projects = signal<HrProject[]>([]);

  protected readonly addOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly addShowPwd = signal(false);
  protected readonly addShowConfirm = signal(false);
  protected readonly addSubmitting = signal(false);
  protected readonly editSubmitting = signal(false);
  protected readonly addError = signal('');
  protected readonly editError = signal('');
  protected readonly editingEmployee = signal<AnalyticsEmployee | null>(null);
  protected readonly inviteResult = signal<{ email: string; temporaryPassword: string | null } | null>(null);
  protected readonly actionMenuFor = signal<number | null>(null);
  protected readonly selectedEmployee = computed<AnalyticsEmployee | null>(() =>
    this.employees().find((e) => e.userId === this.actionMenuFor()) ?? null,
  );
  protected readonly confirmState = signal<ConfirmState | null>(null);
  protected readonly toasts = signal<ToastState[]>([]);

  protected readonly detailOpen = signal(false);
  protected readonly detailTab = signal<DetailTab>('overview');
  protected readonly detailLoading = signal(false);
  protected readonly detailEmployee = signal<EmployeeDetailSummary | null>(null);
  protected readonly detailSessions = signal<EmployeeSessionRow[]>([]);
  protected readonly detailBreaks = signal<EmployeeBreakRow[]>([]);
  protected readonly detailOvertime = signal<HrOvertimeDeclaration[]>([]);
  protected readonly detailAlerts = signal<HrAlert[]>([]);
  protected readonly detailDevices = signal<AgentDevice[]>([]);
  protected readonly detailTimeline = signal<TimelineEntry[]>([]);
  protected detailStart = '';
  protected detailEnd = '';
  private detailUserId = 0;
  private detailRangeDirty = false;

  protected readonly detailTabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'projects', label: 'Projects' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'breaks', label: 'Breaks' },
    { key: 'overtime', label: 'Overtime' },
    { key: 'statistics', label: 'Statistics' },
    { key: 'alerts', label: 'Alerts' },
    { key: 'devices', label: 'Devices' },
  ];

  protected readonly columns = [
    { key: 'employee', label: 'Employee', sortable: true, sortKey: 'fullName' },
    { key: 'employeeId', label: 'Employee ID', sortable: true, sortKey: 'employeeId' },
    { key: 'roleName', label: 'Role', sortable: true, sortKey: 'roleName' },
    { key: 'team', label: 'Team', sortable: true, sortKey: 'team' },
    { key: 'projects', label: 'Projects', sortable: false, sortKey: '' },
    { key: 'currentStatus', label: 'Status', sortable: true, sortKey: 'currentStatus' },
    { key: 'agent', label: 'Agent', sortable: false, sortKey: '' },
    { key: 'lastSeenAt', label: 'Last Seen', sortable: true, sortKey: 'lastSeenAt' },
    { key: 'employmentStatus', label: 'Employment', sortable: true, sortKey: 'employmentStatus' },
    { key: 'actions', label: '', sortable: false, sortKey: '' },
  ];

  protected readonly availableRoles = computed(() => {
    const isAdmin = this.auth.currentUser?.role?.name === 'Admin';
    return this.roles().filter((r) => isAdmin || r.name !== 'Admin');
  });

  protected addForm: EmployeeForm = this.emptyForm();
  protected editForm: EmployeeForm = this.emptyForm();

  @ViewChild('addFirstName') private addFirstName!: ElementRef<HTMLInputElement>;

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private toastId = 0;

  protected readonly pageNumbers = computed(() => {
    const p = this.pagination();
    const pages: number[] = [];
    const start = Math.max(1, p.page - 2);
    const end = Math.min(p.totalPages, p.page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  protected readonly hasActiveFilters = computed(() =>
    !!(this.searchTerm.trim() || this.roleFilter || this.teamFilter || this.projectFilter ||
       this.statusFilter || this.employmentFilter || this.agentFilter ||
       this.joinedFrom || this.joinedTo || this.includeDeleted),
  );

  ngOnInit(): void {
    this.loadReferenceData();
    this.loadEmployees();
    this.setupRealtime();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  private emptyForm(): EmployeeForm {
    return {
      firstName: '', lastName: '', email: '', phone: '',
      roleId: 0, teamId: 0, jobTitle: '', startDate: '', expectedDailyHours: null,
      agentRequired: true, employmentStatus: 'active', password: '', passwordConfirm: '',
      sendWelcomeEmail: true,
    };
  }

  private loadReferenceData(): void {
    this.teamsService.getTeams().subscribe({ next: (res) => this.teams.set(res.teams), error: () => undefined });
    this.projectsService.listAll().subscribe({ next: (res) => this.projects.set(res.projects), error: () => undefined });
    this.employeesService.getRoles().subscribe({
      next: (res) => this.roles.set(res.roles),
      error: () => this.roles.set([{ id: 3, name: 'Employee', type: 'employee' }, { id: 5, name: 'HR', type: 'hr' }]),
    });
  }

  private loadEmployees(): void {
    this.loading.set(true);
    const q: EmployeeQuery = {
      page: this.pagination().page,
      pageSize: this.pagination().pageSize,
      search: this.searchTerm.trim() || undefined,
      status: this.statusFilter || undefined,
      employment: this.employmentFilter || undefined,
      agentStatus: this.agentFilter || undefined,
      roleId: this.roleFilter ? Number(this.roleFilter) : undefined,
      teamId: this.teamFilter ? Number(this.teamFilter) : undefined,
      projectId: this.projectFilter ? Number(this.projectFilter) : undefined,
      joinedFrom: this.joinedFrom || undefined,
      joinedTo: this.joinedTo || undefined,
      includeDeleted: this.includeDeleted ? true : undefined,
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
    this.analyticsService.getEmployees(q).subscribe({
      next: (res) => {
        this.employees.set(res.employees);
        this.pagination.set(res.pagination);
        this.summary.set(res.summary ?? { ...DEFAULT_SUMMARY });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.pagination.update((p) => ({ ...p, page: 1 }));
      this.loadEmployees();
    }, 350);
  }

  protected onFilterChange(): void {
    this.pagination.update((p) => ({ ...p, page: 1 }));
    this.loadEmployees();
  }

  protected clearFilters(): void {
    this.searchTerm = '';
    this.roleFilter = '';
    this.teamFilter = '';
    this.projectFilter = '';
    this.statusFilter = '';
    this.employmentFilter = '';
    this.agentFilter = '';
    this.joinedFrom = '';
    this.joinedTo = '';
    this.includeDeleted = false;
    this.onFilterChange();
  }

  protected onSort(col: { sortable: boolean; sortKey: string }): void {
    if (!col.sortable || !col.sortKey) return;
    if (this.sortBy() === col.sortKey) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(col.sortKey);
      this.sortDir.set('asc');
    }
    this.loadEmployees();
  }

  protected goPage(page: number): void {
    this.pagination.update((p) => ({ ...p, page }));
    this.loadEmployees();
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  protected timeAgo(ts: string | null): string {
    return timeAgo(ts);
  }

  protected exportCsv(): void {
    this.analyticsService.exportCsv({
      search: this.searchTerm.trim() || undefined,
      status: this.statusFilter || undefined,
      attendance: undefined,
      employment: this.employmentFilter || undefined,
      agentStatus: this.agentFilter || undefined,
      roleId: this.roleFilter ? Number(this.roleFilter) : undefined,
      teamId: this.teamFilter ? Number(this.teamFilter) : undefined,
      projectId: this.projectFilter ? Number(this.projectFilter) : undefined,
      joinedFrom: this.joinedFrom || undefined,
      joinedTo: this.joinedTo || undefined,
    });
  }

  /* ── Add / Edit ─────────────────────────────────────────────── */

  protected openAdd(): void {
    this.addForm = this.emptyForm();
    this.addError.set('');
    this.addSubmitting.set(false);
    this.addOpen.set(true);
    setTimeout(() => this.addFirstName?.nativeElement.focus(), 0);
  }

  protected generatePassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    if (!/\d/.test(pwd)) pwd += '7';
    if (pwd.length < 10) pwd = 'A' + pwd;
    this.addForm.password = pwd;
    this.addForm.passwordConfirm = pwd;
  }

  protected submitAdd(): void {
    const err = this.validateForm(this.addForm);
    if (err) { this.addError.set(err); return; }

    const pwd = this.addForm.password;
    if (pwd && !/^(?=.*\d).{10,}$/.test(pwd)) {
      this.addError.set('Password must be at least 10 characters and contain at least one number.');
      return;
    }
    if (pwd !== this.addForm.passwordConfirm) {
      this.addError.set('Passwords do not match.');
      return;
    }
    if (!this.addForm.sendWelcomeEmail && !pwd) {
      this.addError.set('Provide a temporary password or enable the welcome email.');
      return;
    }

    this.addSubmitting.set(true);
    this.addError.set('');

    const payload: InviteEmployeePayload = {
      fullName: `${this.addForm.firstName} ${this.addForm.lastName}`.trim(),
      email: this.addForm.email.trim(),
      roleId: this.addForm.roleId,
      teamId: this.addForm.teamId || null,
      phone: this.addForm.phone.trim() || null,
      jobTitle: this.addForm.jobTitle.trim() || null,
      startDate: this.addForm.startDate || null,
      expectedDailyHours: this.addForm.expectedDailyHours && this.addForm.expectedDailyHours > 0
        ? this.addForm.expectedDailyHours : null,
      agentRequired: this.addForm.agentRequired,
      employmentStatus: this.addForm.employmentStatus,
      password: pwd || undefined,
      sendWelcomeEmail: this.addForm.sendWelcomeEmail,
    };

    this.auth.invite(payload).subscribe({
      next: (res) => {
        this.addSubmitting.set(false);
        this.addOpen.set(false);
        this.inviteResult.set({
          email: this.addForm.email.trim(),
          temporaryPassword: (res as any).temporaryPassword ?? null,
        });
        this.toast('Employee created successfully', 'success');
        this.loadEmployees();
      },
      error: (e) => {
        this.addSubmitting.set(false);
        this.addError.set(this.errMsg(e));
      },
    });
  }

  protected copyTempPassword(): void {
    const pwd = this.inviteResult()?.temporaryPassword;
    if (pwd) {
      void navigator.clipboard?.writeText(pwd);
      this.toast('Temporary password copied', 'info');
    }
  }

  protected openEdit(emp: AnalyticsEmployee): void {
    this.editingEmployee.set(emp);
    const parts = emp.fullName.split(/\s+/);
    this.editForm = {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      email: emp.email,
      phone: emp.phone ?? '',
      roleId: this.roles().find((r) => r.name === emp.roleName)?.id ?? 0,
      teamId: emp.team?.id ?? 0,
      jobTitle: emp.jobTitle ?? '',
      startDate: emp.startDate ?? '',
      expectedDailyHours: emp.expectedDailyHours ?? null,
      agentRequired: emp.agentRequired,
      employmentStatus: emp.employmentStatus,
      password: '',
      passwordConfirm: '',
      sendWelcomeEmail: true,
    };
    this.editError.set('');
    this.editSubmitting.set(false);
    this.editOpen.set(true);
    this.closeActions();
  }

  protected openEditFromDetail(): void {
    const det = this.detailEmployee();
    if (!det) return;
    const row = this.employees().find((e) => e.userId === det.employee.id);
    if (row) this.openEdit(row);
  }

  protected submitEdit(): void {
    const err = this.validateForm(this.editForm);
    if (err) { this.editError.set(err); return; }
    const emp = this.editingEmployee();
    if (!emp) return;

    this.editSubmitting.set(true);
    this.editError.set('');

    const payload: UpdateEmployeePayload = {
      fullName: `${this.editForm.firstName} ${this.editForm.lastName}`.trim(),
      email: this.editForm.email.trim(),
      phone: this.editForm.phone.trim() || null,
      jobTitle: this.editForm.jobTitle.trim() || null,
      teamId: this.editForm.teamId || null,
      roleId: this.editForm.roleId,
      employmentStatus: this.editForm.employmentStatus,
      startDate: this.editForm.startDate || null,
      expectedDailyHours: this.editForm.expectedDailyHours && this.editForm.expectedDailyHours > 0
        ? this.editForm.expectedDailyHours : null,
      agentRequired: this.editForm.agentRequired,
    };

    this.employeesService.updateEmployee(emp.userId, payload).subscribe({
      next: () => {
        this.editSubmitting.set(false);
        this.editOpen.set(false);
        this.toast('Employee updated', 'success');
        this.loadEmployees();
        this.refreshOpenDetail();
      },
      error: (e) => {
        this.editSubmitting.set(false);
        this.editError.set(this.errMsg(e));
      },
    });
  }

  private validateForm(f: EmployeeForm): string | null {
    const name = `${f.firstName} ${f.lastName}`.trim();
    if (name.length < 2) return 'First and last name are required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'A valid email address is required.';
    if (!f.roleId) return 'Please select a role.';
    return null;
  }

  /* ── Row actions ───────────────────────────────────────────── */

  protected toggleActions(userId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.actionMenuFor.set(this.actionMenuFor() === userId ? null : userId);
  }

  protected closeActions(): void {
    this.actionMenuFor.set(null);
  }

  protected viewEmployee(emp: AnalyticsEmployee): void {
    this.closeActions();
    this.openDetail(emp.userId);
  }

  protected resetPassword(emp: AnalyticsEmployee | { id: number; fullName: string }): void {
    this.closeActions();
    this.confirmState.set({
      title: 'Reset password',
      message: `Send a password reset link to ${emp.fullName}? All trusted devices for this employee will be revoked.`,
      confirmLabel: 'Reset password',
      danger: false,
      action: () => {
        this.employeesService.resetPassword(this.empId(emp)).subscribe({
          next: () => this.toast('Password reset link sent', 'success'),
          error: (e) => this.toast(this.errMsg(e), 'error'),
        });
      },
    });
  }

  protected suspendEmployee(emp: AnalyticsEmployee | { id: number; fullName: string }): void {
    this.closeActions();
    this.confirmState.set({
      title: 'Suspend employee',
      message: `${emp.fullName} will be blocked from signing in until reactivated. Their status will change to suspended.`,
      confirmLabel: 'Suspend',
      danger: true,
      action: () => {
        this.employeesService.suspendEmployee(this.empId(emp)).subscribe({
          next: () => {
            this.toast('Employee suspended', 'success');
            this.loadEmployees();
            this.refreshOpenDetail();
          },
          error: (e) => this.toast(this.errMsg(e), 'error'),
        });
      },
    });
  }

  protected reactivateEmployee(emp: AnalyticsEmployee | { id: number; fullName: string }): void {
    this.closeActions();
    this.employeesService.reactivateEmployee(this.empId(emp)).subscribe({
      next: () => {
        this.toast('Employee reactivated', 'success');
        this.loadEmployees();
        this.refreshOpenDetail();
      },
      error: (e) => this.toast(this.errMsg(e), 'error'),
    });
  }

  protected softDeleteEmployee(emp: AnalyticsEmployee | { id: number; fullName: string }): void {
    this.closeActions();
    this.confirmState.set({
      title: 'Delete employee',
      message: `This will deactivate ${emp.fullName}'s account and mark them as terminated. This action cannot be undone.`,
      confirmLabel: 'Delete employee',
      danger: true,
      action: () => {
        this.employeesService.softDeleteEmployee(this.empId(emp)).subscribe({
          next: () => {
            this.toast('Employee deleted', 'success');
            this.loadEmployees();
            this.refreshOpenDetail();
          },
          error: (e) => this.toast(this.errMsg(e), 'error'),
        });
      },
    });
  }

  protected restoreEmployee(emp: AnalyticsEmployee): void {
    this.closeActions();
    this.employeesService.restoreEmployee(emp.userId).subscribe({
      next: () => {
        this.toast('Employee restored', 'success');
        this.loadEmployees();
      },
      error: (e) => this.toast(this.errMsg(e), 'error'),
    });
  }

  protected revokeAgent(emp: AnalyticsEmployee): void {
    this.closeActions();
    const deviceId = emp.agentDevice?.id;
    if (!deviceId) { this.toast('No active agent to revoke', 'info'); return; }
    this.confirmState.set({
      title: 'Revoke desktop agent',
      message: `This will revoke ${emp.fullName}'s desktop agent access. They will need to pair again.`,
      confirmLabel: 'Revoke agent',
      danger: true,
      action: () => {
        this.agentDevices.revokeByHr(deviceId).subscribe({
          next: () => {
            this.toast('Desktop agent revoked', 'success');
            this.loadEmployees();
            this.refreshOpenDetail();
          },
          error: (e) => this.toast(this.errMsg(e), 'error'),
        });
      },
    });
  }

  protected revokeDevice(device: AgentDevice): void {
    this.confirmState.set({
      title: 'Revoke device',
      message: `Revoke access for "${device.deviceName}"? The employee will need to pair again.`,
      confirmLabel: 'Revoke',
      danger: true,
      action: () => {
        this.agentDevices.revokeByHr(device.id).subscribe({
          next: () => {
            this.toast('Device revoked', 'success');
            this.loadDetailTab('devices');
          },
          error: (e) => this.toast(this.errMsg(e), 'error'),
        });
      },
    });
  }

  protected runConfirm(): void {
    const c = this.confirmState();
    if (c) {
      this.confirmState.set(null);
      c.action();
    }
  }

  /* ── Detail drawer ──────────────────────────────────────────── */

  protected openDetail(userId: number): void {
    this.detailUserId = userId;
    this.detailOpen.set(true);
    this.detailTab.set('overview');
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    this.detailStart = toLocalDateStr(start);
    this.detailEnd = toLocalDateStr(end);
    this.detailRangeDirty = false;
    this.resetDetailData();
    this.loadDetailTab('overview');
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.resetDetailData();
  }

  protected switchTab(tab: DetailTab): void {
    this.detailTab.set(tab);
    this.loadDetailTab(tab);
  }

  protected onDetailRangeChange(): void {
    this.detailRangeDirty = true;
    this.loadDetailTab(this.detailTab());
  }

  private resetDetailData(): void {
    this.detailEmployee.set(null);
    this.detailSessions.set([]);
    this.detailBreaks.set([]);
    this.detailOvertime.set([]);
    this.detailAlerts.set([]);
    this.detailDevices.set([]);
    this.detailTimeline.set([]);
  }

  private loadDetailTab(tab: DetailTab): void {
    const userId = this.detailUserId;
    if (!userId) return;
    this.detailLoading.set(true);

    if (tab === 'overview' || tab === 'statistics') {
      this.analyticsService.getEmployeeDetail(userId, this.detailStart, this.detailEnd).subscribe({
        next: (res) => {
          this.detailEmployee.set(res);
          if (tab === 'statistics') {
            this.analyticsService.getTimeline(userId, this.detailStart, this.detailEnd).subscribe({
              next: (t) => this.detailTimeline.set(t.timeline),
              error: () => undefined,
            });
          }
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
      return;
    }

    if (tab === 'projects') {
      this.ensureDetailLoaded(userId);
      return;
    }

    if (tab === 'sessions') {
      this.employeesService.getEmployeeSessions(userId, this.detailStart, this.detailEnd).subscribe({
        next: (res) => { this.detailSessions.set(res.sessions); this.detailLoading.set(false); },
        error: () => this.detailLoading.set(false),
      });
      return;
    }

    if (tab === 'breaks') {
      this.employeesService.getEmployeeBreaks(userId, this.detailStart, this.detailEnd).subscribe({
        next: (res) => { this.detailBreaks.set(res.breaks); this.detailLoading.set(false); },
        error: () => this.detailLoading.set(false),
      });
      return;
    }

    if (tab === 'overtime') {
      this.overtimeService.getAllDeclarations({ employeeId: userId, limit: 50, dateFrom: this.detailStart, dateTo: this.detailEnd }).subscribe({
        next: (res) => { this.detailOvertime.set(res.declarations); this.detailLoading.set(false); },
        error: () => this.detailLoading.set(false),
      });
      return;
    }

    if (tab === 'alerts') {
      this.alertsService.getAllAlerts({ employeeId: userId, limit: 50, from: this.detailStart, to: this.detailEnd }).subscribe({
        next: (res) => { this.detailAlerts.set(res.alerts); this.detailLoading.set(false); },
        error: () => this.detailLoading.set(false),
      });
      return;
    }

    if (tab === 'devices') {
      this.agentDevices.hrListAllDevices().subscribe({
        next: (res) => {
          this.detailDevices.set(res.devices.filter((d) => d.employee?.id === userId));
          this.detailLoading.set(false);
        },
        error: () => this.detailLoading.set(false),
      });
    }
  }

  private ensureDetailLoaded(userId: number): void {
    if (this.detailEmployee()?.employee.id === userId) {
      this.detailLoading.set(false);
      return;
    }
    this.analyticsService.getEmployeeDetail(userId, this.detailStart, this.detailEnd).subscribe({
      next: (res) => {
        this.detailEmployee.set(res);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  private refreshOpenDetail(): void {
    if (!this.detailOpen() || !this.detailUserId) return;
    this.loadDetailTab('overview');
  }

  /* ── Realtime ───────────────────────────────────────────────── */

  private setupRealtime(): void {
    this.realtime.sessionChanged$.subscribe((e: SessionStatusEvent) => {
      const status = e.status === 'active' ? 'active' : e.status === 'break' ? 'break' : 'clocked_out';
      this.employees.update((list) =>
        list.map((emp) => (emp.userId === e.userId ? { ...emp, currentStatus: status as AnalyticsEmployee['currentStatus'] } : emp)),
      );
      const prev = this.statusCache.get(e.userId);
      if (prev && prev !== status) {
        this.summary.update((s) => this.shiftStatus(s, prev, status));
      }
      this.statusCache.set(e.userId, status);
    });

    this.realtime.sessionUpdated$.subscribe((e: SessionUpdatedEvent) => {
      this.employees.update((list) =>
        list.map((emp) =>
          emp.userId === e.userId
            ? { ...emp, agentOnline: e.agentOnline, currentStatus: e.status === 'clocked_out' ? 'clocked_out' : e.status }
            : emp,
        ),
      );
      this.statusCache.set(e.userId, e.status === 'clocked_out' ? 'clocked_out' : e.status);
    });
  }

  private readonly statusCache = new Map<number, string>();

  private shiftStatus(s: EmployeeListSummary, prev: string, next: string): EmployeeListSummary {
    const dec = prev === 'active' ? { activeNow: -1 } : prev === 'break' ? { onBreak: -1 } : { clockedOut: -1 };
    const inc = next === 'active' ? { activeNow: 1 } : next === 'break' ? { onBreak: 1 } : { clockedOut: 1 };
    const clamp = (v: number) => Math.max(0, v);
    return {
      ...s,
      activeNow: clamp(s.activeNow + (dec.activeNow ?? 0) + (inc.activeNow ?? 0)),
      onBreak: clamp(s.onBreak + (dec.onBreak ?? 0) + (inc.onBreak ?? 0)),
      clockedOut: clamp(s.clockedOut + (dec.clockedOut ?? 0) + (inc.clockedOut ?? 0)),
    };
  }

  /* ── Misc helpers ───────────────────────────────────────────── */

  private toast(message: string, type: ToastState['type'] = 'success'): void {
    const id = ++this.toastId;
    this.toasts.update((list) => [...list, { id, type, message }]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== id)), 4000);
  }

  private errMsg(e: any): string {
    return e?.error?.error?.message || 'Something went wrong. Please try again.';
  }

  private empId(emp: AnalyticsEmployee | { id: number; fullName: string }): number {
    return 'userId' in emp ? emp.userId : emp.id;
  }
}
