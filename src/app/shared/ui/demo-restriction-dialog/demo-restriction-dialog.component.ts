import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe } from '../../pipes/translate.pipe';

interface DemoRestrictionDialogData {
  titleKey: string;
  messageKey: string;
}

@Component({
  selector: 'app-demo-restriction-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | t }}</h2>
    <mat-dialog-content>
      <p>{{ data.messageKey | t }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close(false)">{{ 'common.close' | t }}</button>
      <button mat-flat-button color="primary" type="button" (click)="close(true)">
        {{ 'auth.register.createAccount' | t }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoRestrictionDialogComponent {
  protected readonly data = inject<DemoRestrictionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DemoRestrictionDialogComponent>);

  protected close(shouldRegister: boolean): void {
    this.dialogRef.close(shouldRegister);
  }
}

