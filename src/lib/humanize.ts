/*
 * Inline replacement for @i2v-systems/common-components' HumanizePipe
 * (which wraps the `humanize-string` npm package). Reproduced inline so
 * the library has zero extra runtime deps — same approach i2v-utility-ng12
 * took for its textNormalize pipe.
 *
 *   humanize('columnName')  -> 'Column name'
 *   humanize('show_in_ui')  -> 'Show in ui'
 *   humanize('show-in-ui')  -> 'Show in ui'
 */
import { Pipe, PipeTransform } from '@angular/core';

export function humanize(value: string): string {
  if (!value) {
    return value;
  }
  const spaced = String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform(value: string): string {
    return humanize(value);
  }
}
