import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe } from '../../pipes/translate.pipe';

interface ConfirmationDialogData {
  title: string;
  message: string;
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
      @if (data.warningMessage) {
        <p class="warning-text">{{ data.warningMessage }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close(false)">
        {{ data.cancelLabelKey ? (data.cancelLabelKey | t) : ('common.cancel' | t) }}
      </button>
      <button mat-flat-button color="primary" type="button" (click)="close(true)">
        {{ data.confirmLabelKey ? (data.confirmLabelKey | t) : ('common.delete' | t) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
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
