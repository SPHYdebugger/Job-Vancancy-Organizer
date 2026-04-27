import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslatePipe } from '../../pipes/translate.pipe';

interface LoadingDialogData {
  message?: string;
  messageKey?: string;
}

@Component({
  selector: 'app-loading-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatProgressSpinnerModule, TranslatePipe],
  template: `
    <mat-dialog-content class="loading-dialog-content">
      <mat-spinner diameter="44"></mat-spinner>
      <p>
        {{ data.messageKey ? (data.messageKey | t) : (data.message ?? '') }}
      </p>
    </mat-dialog-content>
  `,
  styles: [
    `
      .loading-dialog-content {
        min-width: 280px;
        padding: 1.4rem 1.25rem 1.1rem;
        display: grid;
        justify-items: center;
        gap: 0.9rem;
        text-align: center;
      }

      .loading-dialog-content p {
        margin: 0;
        color: var(--text-secondary);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingDialogComponent {
  protected readonly data = inject<LoadingDialogData>(MAT_DIALOG_DATA);
}
