/*
 * Vendored, pure form validators — extracted verbatim from analytic-manager's
 * ValidationService (services/validation.service.ts). Only the 7 validators the
 * property-schema editor uses are vendored, as standalone functions (the
 * originals were methods but never used `this`, so extraction is mechanical).
 */
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function nameValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value.toString().trim() === '') {
    return { invalidName: 'Name is required.' };
  }
  if (/\s/.test(value)) {
    return { invalidName: 'Spaces are not allowed in name.' };
  }
  if (/[^a-zA-Z0-9_]/.test(value)) {
    return { invalidName: 'Special characters are not allowed in name.' };
  }
  return null;
}

export function notEmptyValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value.toString().trim() === '') {
    return { invalidName: 'Name is required.' };
  }
  return null;
}

export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  return /^-?\d+$/.test(str) ? null : { invalidInteger: true };
}

export function decimalValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  return /^-?\d+(\.\d+)?$/.test(str) ? null : { invalidDecimal: true };
}

export function booleanValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim().toLowerCase();
  return str === 'true' || str === 'false' ? null : { invalidBoolean: true };
}

export function commaSeparatedTypedValidator(itemValidator: ValidatorFn): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (typeof control.value !== 'string') return null;
    const value = control.value;
    if (!value.trim()) return null;
    if (value.startsWith(',') || value.endsWith(',')) return { invalidCommaPlacement: true };
    if (/,{2,}/.test(value)) return { consecutiveCommas: true };
    const parts = value.split(',');
    for (const part of parts) {
      if (!part.trim()) return { emptyOrWhitespaceValue: true };
      if (part !== part.trim()) return { spaceAroundValue: true };
      const itemError = itemValidator({ value: part } as AbstractControl);
      if (itemError) return itemError;
    }
    if (new Set(parts).size !== parts.length) return { duplicateValues: true };
    return null;
  };
}

export function CommaSeparatedStringValidator(control: AbstractControl): ValidationErrors | null {
  if (typeof control.value !== 'string') return null;

  const value = control.value;

  if (!value.trim()) return null;

  if (value.startsWith(',') || value.endsWith(',')) {
    return { invalidCommaPlacement: true };
  }

  if (/,{2,}/.test(value) || /,\s*,/.test(value)) {
    return { consecutiveCommas: true };
  }

  const parts = value.split(',');

  for (const part of parts) {
    if (!part.trim()) {
      return { emptyOrWhitespaceValue: true };
    }

    if (part !== part.trim()) {
      return { spaceAroundValue: true };
    }
    if (/\s/.test(part)) {
      return { internalSpaceInvalid: true };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(part)) {
      return { invalidCharacters: true };
    }
  }

  const unique = new Set(parts);
  if (unique.size !== parts.length) {
    return { duplicateValues: true };
  }

  return null;
}
