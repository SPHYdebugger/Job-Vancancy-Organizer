import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe } from '../../pipes/translate.pipe';

interface ConfirmationDialogData {
  title: string;
  message: string;
  variant?: 'confirm' | 'info';
  details?: string[];
  warningMessage?: string;
  cancelLabelKey?: string;
  confirmLabelKey?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.details && data.details.length > 0) {
        <ul class="details-list">
          @for (detail of data.details; track detail) {
            <li>{{ detail }}</li>
          }
        </ul>
      }
      @if (data.warningMessage) {
        <p class="warning-text">{{ data.warningMessage }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if ((data.variant ?? 'confirm') === 'confirm') {
        <button mat-stroked-button type="button" (click)="close(false)">
          {{ data.cancelLabelKey ? (data.cancelLabelKey | t) : ('common.cancel' | t) }}
        </button>
      }
      <button mat-flat-button color="primary" type="button" (click)="close(true)">
        {{
          data.confirmLabelKey
            ? (data.confirmLabelKey | t)
            : ((data.variant ?? 'confirm') === 'info' ? ('common.close' | t) : ('common.delete' | t))
        }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .details-list {
        margin: 0.75rem 0 0;
        padding-left: 1.25rem;
      }

      .details-list li {
        margin-bottom: 0.25rem;
      }

      .warning-text {
        margin-top: 0.75rem;
        font-weight: 700;
        color: #1e3a8a;
        text-align: center;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationDialogComponent {
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
