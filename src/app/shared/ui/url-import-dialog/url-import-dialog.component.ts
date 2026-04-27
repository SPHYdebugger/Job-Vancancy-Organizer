import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TranslatePipe } from '../../pipes/translate.pipe';

interface UrlImportDialogData {
  titleKey: string;
  messageKey: string;
  placeholderKey: string;
  confirmKey: string;
}

@Component({
  selector: 'app-url-import-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | t }}</h2>
    <mat-dialog-content>
      <p>{{ data.messageKey | t }}</p>
      <form [formGroup]="form" (ngSubmit)="confirm()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ data.placeholderKey | t }}</mat-label>
          <input matInput formControlName="url" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">{{ 'common.cancel' | t }}</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="confirm()">
        {{ data.confirmKey | t }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UrlImportDialogComponent {
  protected readonly data = inject<UrlImportDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UrlImportDialogComponent>);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    url: ['', [Validators.required, Validators.minLength(10)]]
  });

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close(this.form.getRawValue().url.trim());
  }
}
