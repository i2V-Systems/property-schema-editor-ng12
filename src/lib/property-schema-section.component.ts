import { Component, EventEmitter, HostBinding, Input, OnChanges, Optional, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { CommonModalComponent } from '@i2v-systems/common-modal-ng12';

import { PropertySchemaEditorComponent } from './property-schema-editor.component';
import {
  EventPropertyType,
  ImportableEvent,
  PropertyImportResult,
  PropertyModel,
  PropertySaveResult,
} from './property-schema-editor.models';
import { humanize } from './humanize';

interface PropertyGroup {
  /** Humanized EventPropertyType name, e.g. "String", "Float". */
  type: string;
  /** Property display names in this type group. */
  names: string[];
}

/**
 * Read-only "Properties (N)" panel + pencil button. Clicking the pencil
 * opens the `PropertySchemaEditorComponent` inside
 * `@i2v-systems/common-modal-ng12`'s `CommonModalComponent` via MatDialog —
 * exactly analytic-manager's event-details → editProperties() flow.
 *
 * Pure-UI: data in via @Input, results out via @Output. The host only
 * needs `CommonModalNg12Module` + `MatDialogModule` + `BrowserAnimationsModule`
 * (+ a Material theme), same as the editor.
 */
@Component({
  selector: 'lib-property-schema-section',
  templateUrl: './property-schema-section.component.html',
  styleUrls: ['./property-schema-section.component.scss'],
})
export class PropertySchemaSectionComponent implements OnChanges {
  @Input() properties: PropertyModel[] = [];
  @Input() eventName = '';
  @Input() eventId = '';
  @Input() canImportProperties = false;
  @Input() importableEvents: ImportableEvent[] = [];
  @Input() propertyNamesUsedInRules: string[] = [];
  @Input() advancedPropertyKeys?: string[];
  @Input() translateFn?: (key: string) => string;
  @Input() importPlaceholder = 'Select analytic/s to import properties:';
  /** Modal heading. `{event}` is replaced with `eventName`. */
  @Input() editHeading = 'Edit event properties ({event})';
  /** Hide the pencil (read-only, no editing). */
  @Input() readonly = false;
  /**
   * Optional CSS height cap for the whole panel (any CSS length, e.g.
   * `'320px'`, `'40vh'`). When set, the header (title + pencil) stays
   * pinned and the grouped chip list scrolls inside. Leave unset to grow
   * with content. Overflow handling lives in the library so a consumer
   * dropping this into a small container just passes `[maxHeight]`. */
  @Input() maxHeight?: string;

  /** Binds `maxHeight` to the host element's `max-height` (null = no
   *  cap, panel grows with content). */
  @HostBinding('style.max-height')
  get hostMaxHeight(): string | null {
    return this.maxHeight || null;
  }
  /** Optional CommonModal height. Leave unset to use CommonModal's own
   *  default size (recommended) — the editor table scrolls inside. */
  @Input() modalHeight?: string;
  /** Optional CommonModal width. Leave unset to use CommonModal's own
   *  default size (recommended) — the editor table scrolls inside. */
  @Input() modalWidth?: string;
  /**
   * MatDialog `panelClass`. Defaults to `'common-modal-panel'` — the exact
   * class `@i2v-systems/common-modal-ng12`'s README mandates a GLOBAL rule
   * for: `.common-modal-panel .mat-dialog-container { padding:0 !important }`.
   * `.mat-dialog-container` is MatDialog's body-attached wrapper (outside any
   * component) so it can only be zeroed by global CSS; reusing the documented
   * class means the host's existing common-modal rule applies here too,
   * instead of Material's default 24px container padding leaking in.
   */
  @Input() modalPanelClass = 'common-modal-panel';

  @Output() save = new EventEmitter<PropertySaveResult>();
  @Output() importSave = new EventEmitter<PropertyImportResult>();
  @Output() cancel = new EventEmitter<void>();
  @Output() warn = new EventEmitter<string>();

  public groups: PropertyGroup[] = [];
  public count = 0;

  constructor(
    private readonly dialog: MatDialog,
    @Optional() private readonly translate?: TranslateService,
  ) {}

  ngOnChanges(_changes: SimpleChanges): void {
    this.rebuildGroups();
  }

  private tr(key: string): string {
    if (this.translateFn) return this.translateFn(key);
    if (this.translate) return this.translate.instant(key);
    return key;
  }

  /** Display helper used by the template. */
  public label(value: string): string {
    return this.tr(humanize(value));
  }

  private rebuildGroups(): void {
    const props = this.properties ?? [];
    this.count = props.length;
    const byType = new Map<string, string[]>();
    for (const p of props) {
      const typeName =
        typeof p.type === 'number'
          ? EventPropertyType[p.type] ?? String(p.type)
          : String(p.type ?? 'Unknown');
      if (!byType.has(typeName)) {
        byType.set(typeName, []);
      }
      byType.get(typeName)!.push(p.name);
    }
    this.groups = Array.from(byType.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, names]) => ({ type, names }));
  }

  public openEditor(): void {
    if (this.readonly) {
      return;
    }
    const heading = this.tr(this.editHeading).replace('{event}', this.tr(this.eventName));
    const ref = this.dialog.open(CommonModalComponent, {
      // Reuse common-modal-ng12's documented panelClass so the host's
      // global `.common-modal-panel .mat-dialog-container { padding:0 }`
      // rule applies (Material's default container padding would otherwise
      // leak in — that was the real cause of the heading/footer/scroll
      // discrepancy vs. opening CommonModal directly).
      panelClass: this.modalPanelClass,
      data: {
        heading,
        showHeading: true,
        showCloseButtonForHeader: true,
        showPreviousButton: false,
        showNextButton: false,
        showBackButton: false,
        // width/height default to undefined → CommonModal uses its OWN
        // normal default size & padding (no overrides). The editor table
        // is the only thing that can exceed it and scrolls inside its
        // own .pse-table-wrap (H+V). Consumers may still pass fixed
        // values via [modalWidth]/[modalHeight] if they want.
        width: this.modalWidth,
        height: this.modalHeight,
        event: {
          component: PropertySchemaEditorComponent,
          data: {
            properties: this.properties,
            eventName: this.eventName,
            eventId: this.eventId,
            canImportProperties: this.canImportProperties,
            importableEvents: this.importableEvents,
            propertyNamesUsedInRules: this.propertyNamesUsedInRules,
            advancedPropertyKeys: this.advancedPropertyKeys,
            translateFn: this.translateFn,
            importPlaceholder: this.importPlaceholder,
          },
        },
        // Footer buttons are rendered by CommonModalComponent in a
        // body-attached MatDialog overlay — OUTSIDE this component's
        // style scope — so the `style` strings MUST be GLOBAL classes.
        // We use i2v-utility-ng12's `i2v-btn` design-system classes,
        // exactly as analytic-manager's editProperties() does. Requires
        // the host to load i2v-utility-ng12's button.component.css
        // globally (see README).
        // NOTE: no "Add new property" footer button — the editor's own
        // toolbar already has one; a footer duplicate is redundant.
        footerButtons: [
          {
            title: this.tr('Update'),
            basedOnChildTemplate: true,
            Callback: 'submitChanges',
            disabledWith: 'updateButtonEnable',
            style: 'i2v-btn medium primary-default',
          },
          {
            title: this.tr('Cancel'),
            Callback: () => this.dialog.closeAll(),
            style: 'i2v-btn tertiary-outline medium',
          },
        ],
      },
    });

    // CommonModal re-emits the editor's `DataSubmitted` via `afterAction`.
    const sub = ref.componentInstance?.afterAction?.subscribe((res: any) => {
      if (!res) {
        return;
      }
      if (res.type === 'save' && res.payload) {
        this.save.emit(res.payload as PropertySaveResult);
      } else if (res.type === 'import' && res.payload) {
        this.importSave.emit(res.payload as PropertyImportResult);
      } else if (res.type === 'cancel') {
        this.cancel.emit();
      }
      this.dialog.closeAll();
    });

    ref.afterClosed().subscribe(() => sub?.unsubscribe());
  }
}
