import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import {
  EventPropertyType,
  ImportableEvent,
  PropertyFormInput,
  PropertyImportResult,
  PropertyModel,
  PropertykeyTypes,
  PropertySaveResult,
} from './property-schema-editor.models';
import {
  booleanValidator,
  CommaSeparatedStringValidator,
  commaSeparatedTypedValidator,
  decimalValidator,
  integerValidator,
  nameValidator,
  notEmptyValidator,
} from './property-validators';
import { humanize } from './humanize';
import { deepClone } from './clone.util';

@Component({
  selector: 'lib-property-schema-editor',
  templateUrl: './property-schema-editor.component.html',
  styleUrls: ['./property-schema-editor.component.scss'],
})
export class PropertySchemaEditorComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('tableWrap') private tableWrap?: ElementRef<HTMLElement>;

  // ---- Inputs (replace MAT_DIALOG_DATA + EventsClientManager) ----
  @Input() properties: PropertyModel[] = [];
  @Input() eventName = '';
  @Input() eventId = '';
  @Input() canImportProperties = false;
  @Input() importableEvents: ImportableEvent[] = [];
  @Input() propertyNamesUsedInRules: string[] = [];
  @Input() advancedPropertyKeys?: string[];
  @Input() translateFn?: (key: string) => string;
  @Input() hideFooter = false;
  /** Placeholder for the "import properties from another event" multiselect.
   *  Pass an already-translated string; defaults to English. */
  @Input() importPlaceholder = 'Select analytic/s to import properties:';
  /**
   * Optional CSS height cap for the whole editor (any CSS length, e.g.
   * `'460px'`, `'70vh'`). When set, the component bounds its own height
   * and the property table scrolls (H+V) inside — the toolbar and footer
   * stay pinned. Leave unset to grow with content / fill a constrained
   * parent (e.g. CommonModal forces height:100% inline, which still works).
   * This keeps overflow handling inside the library: a consumer dropping
   * the editor into any small container just passes `[maxHeight]`.
   */
  @Input() maxHeight?: string;

  /** Binds `maxHeight` to the host element's `max-height` (null = no cap,
   *  so it falls back to natural / parent-constrained height). */
  @HostBinding('style.max-height')
  get hostMaxHeight(): string | null {
    return this.maxHeight || null;
  }

  // ---- Outputs (replace dialogRef.close + showWarningToastr) ----
  @Output() save = new EventEmitter<PropertySaveResult>();
  @Output() importSave = new EventEmitter<PropertyImportResult>();
  @Output() cancel = new EventEmitter<void>();
  @Output() warn = new EventEmitter<string>();
  @Output() validityChange = new EventEmitter<boolean>();

  /**
   * Bridge for @i2v-systems/common-modal-ng12. When this component is
   * created dynamically inside `CommonModalComponent`, the modal does NOT
   * pass @Inputs — it (a) lets the child read the modal data via
   * MAT_DIALOG_DATA and (b) re-emits the child's `DataSubmitted` through
   * its own `afterAction`. So we expose a `DataSubmitted` emitter and
   * also close the (inherited) CommonModal dialogRef on save/import/cancel.
   * Standalone @Input/@Output usage is unaffected.
   */
  @Output() DataSubmitted = new EventEmitter<
    | { type: 'save'; payload: PropertySaveResult }
    | { type: 'import'; payload: PropertyImportResult }
    | { type: 'cancel' }
  >();

  public leftUpdateButtonEnable = true;
  public updateButtonEnable = false;

  private eventsToImportProperties: string[] = [];
  private advancePropertyFormOn = false;
  private readonly propertyKeyToDiscard = [
    'trueIcon',
    'falseIcon',
    'analyticEventId',
    'id',
    'analytic',
    'cellRenderer',
    'placeholder',
    'isCustomProperty',
    'expression',
  ];

  private readonly destroy$ = new Subject<void>();
  private originalPropertyById = new Map<string, PropertyFormInput>();
  private initialized = false;

  public showableKeys: string[] = [];
  public originalEventProperties: PropertyFormInput[] = [];
  public editEventPropForm!: FormGroup;
  public propertiesFormArray!: FormArray;
  public typeOptions: { label: string; value: string }[] = [];
  public eventsToImportPropertiesOptions: { label: string; value: string }[] = [];
  public activeInput: string | null = null;
  public errorMessage = '';
  public PropertykeyTypes = PropertykeyTypes;
  public importedEventNames: string[] = [];
  public searchTerm = '';
  public filteredControls: FormGroup[] = [];

  constructor(
    private readonly zone: NgZone,
    private readonly fb: FormBuilder,
    @Optional() private readonly translate?: TranslateService,
    // Both are present only when hosted inside CommonModalComponent
    // (it's opened via MatDialog, so the dynamically-created child
    // inherits the dialog injector). Optional → standalone use is fine.
    @Optional() @Inject(MAT_DIALOG_DATA) private readonly modalData?: any,
    @Optional() private readonly modalRef?: MatDialogRef<any>,
  ) {}

  /** True when rendered inside CommonModalComponent (vs. embedded directly). */
  private get hostedInModal(): boolean {
    return !!(this.modalData && this.modalData.event);
  }

  /** Pull @Input values from the CommonModal `event.data` payload. */
  private hydrateFromModalData(): void {
    const d = this.modalData?.event?.data;
    if (!d) {
      return;
    }
    if (d.properties != null) this.properties = d.properties;
    if (d.eventName != null) this.eventName = d.eventName;
    if (d.eventId != null) this.eventId = d.eventId;
    if (d.canImportProperties != null) this.canImportProperties = d.canImportProperties;
    if (d.importableEvents != null) this.importableEvents = d.importableEvents;
    if (d.propertyNamesUsedInRules != null) this.propertyNamesUsedInRules = d.propertyNamesUsedInRules;
    if (d.advancedPropertyKeys != null) this.advancedPropertyKeys = d.advancedPropertyKeys;
    if (d.translateFn != null) this.translateFn = d.translateFn;
    if (d.importPlaceholder != null) this.importPlaceholder = d.importPlaceholder;
    // CommonModal renders its own footer → hide ours.
    this.hideFooter = true;
  }

  ngOnInit(): void {
    this.hydrateFromModalData();
    this.initializeData();
    this.rebuildShowableKeys();
    this.buildForm();
    this.subscribeToFormChanges();
    this.validateAndUpdateButtonState();
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-initialise when the host swaps the schema after first render
    // (a dialog created this fresh each time; an embedded host may reuse it).
    if (
      this.initialized &&
      (changes['properties'] || changes['importableEvents'] || changes['eventName'])
    ) {
      this.destroy$.next();
      this.initializeData();
      this.rebuildShowableKeys();
      this.buildForm();
      this.subscribeToFormChanges();
      this.validateAndUpdateButtonState();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- translation hook: translateFn input > ngx-translate > identity ----
  private tr(key: string): string {
    if (this.translateFn) {
      return this.translateFn(key);
    }
    if (this.translate) {
      return this.translate.instant(key);
    }
    return key;
  }

  private initializeData(): void {
    this.originalEventProperties = (deepClone(this.properties ?? []) as PropertyModel[]).map(
      (p: PropertyModel): PropertyFormInput => ({
        ...p,
        type: this.toTypeKey(p.type),
      }),
    );
    this.originalPropertyById.clear();
    for (const property of this.originalEventProperties) {
      if (property.id) {
        this.originalPropertyById.set(property.id, property);
      }
    }
    this.eventsToImportProperties = (this.importableEvents ?? [])
      .map(e => e.name)
      .filter(name => name !== this.eventName)
      .sort();
    this.eventsToImportPropertiesOptions = this.eventsToImportProperties.map(name => ({
      label: this.tr(name),
      value: name,
    }));
    this.typeOptions = Object.keys(EventPropertyType)
      .filter(key => Number.isNaN(Number(key)))
      .map(key => ({
        label: this.tr(humanize(key)),
        value: key,
      }));
  }

  private toTypeKey(type: any): string | null {
    if (type == null) {
      return null;
    }
    const asString = String(type);
    if (Number.isNaN(Number(asString)) && asString in EventPropertyType) {
      return asString;
    }
    const key = Object.keys(EventPropertyType).find(
      k =>
        Number.isNaN(Number(k)) &&
        EventPropertyType[k as keyof typeof EventPropertyType] === Number(asString),
    );
    return key ?? null;
  }

  private rebuildShowableKeys(): void {
    const allKeys = Object.keys(new PropertyModel());
    if (!this.advancePropertyFormOn) {
      this.showableKeys = ['name', 'columnName', 'type'];
    } else if (this.advancedPropertyKeys && this.advancedPropertyKeys.length) {
      this.showableKeys = [...this.advancedPropertyKeys];
    } else {
      this.showableKeys = allKeys.filter(key => !this.propertyKeyToDiscard.includes(key));
    }
  }

  private buildForm(): void {
    this.propertiesFormArray = this.fb.array(
      this.originalEventProperties.map((property: PropertyFormInput) =>
        this.createPropertyFormGroup(property, true),
      ),
      { validators: [this.duplicatePropertyNamesValidator()] },
    );
    this.editEventPropForm = this.fb.group({
      properties: this.propertiesFormArray,
    });
    this.refreshFilter();
  }

  private createPropertyFormGroup(
    property: PropertyFormInput,
    nameAndTypeDisabled: boolean,
  ): FormGroup {
    const isCustom = property.isCustomProperty ?? true;
    const group = this.fb.group({
      id: [property.id ?? null],
      name: [
        { value: property.name ?? '', disabled: nameAndTypeDisabled },
        [Validators.required, nameValidator],
      ],
      columnName: [
        { value: property.columnName ?? '', disabled: nameAndTypeDisabled },
        [Validators.required, notEmptyValidator],
      ],
      type: [
        { value: property.type ?? null, disabled: nameAndTypeDisabled },
        Validators.required,
      ],
      defaultValues: [
        property.defaultValues ?? null,
        this.getDefaultValuesValidators(property.type),
      ],
      options: [property.options ?? null, this.getOptionsValidators(property.type)],
      filterable: [{ value: property.filterable ?? false, disabled: !property.showInUI }],
      isEditable: [property.isEditable ?? false],
      showInUI: [property.showInUI ?? false],
      showInPopup: [property.showInPopup ?? false],
      appendText: [property.appendText ?? null],
      isCustomProperty: [isCustom],
      remove: [false],
    });

    group
      .get('showInUI')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((showInUI: boolean) => {
        const filterableControl = group.get('filterable')!;
        if (showInUI) {
          filterableControl.enable({ emitEvent: false });
        } else {
          filterableControl.disable({ emitEvent: false });
          filterableControl.setValue(false, { emitEvent: false });
        }
      });
    if (!nameAndTypeDisabled) {
      group
        .get('type')!
        .valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe((newType: string | null) => {
          this.applyTypeAwareValidators(group, newType);
        });
    }

    return group;
  }

  private applyTypeAwareValidators(group: FormGroup, type: string | null | undefined): void {
    const defaultValuesCtrl = group.get('defaultValues')!;
    const optionsCtrl = group.get('options')!;
    defaultValuesCtrl.setValidators(this.getDefaultValuesValidators(type));
    optionsCtrl.setValidators(this.getOptionsValidators(type));
    defaultValuesCtrl.updateValueAndValidity();
    optionsCtrl.updateValueAndValidity();
  }

  private getDefaultValuesValidators(type: string | null | undefined): ValidatorFn[] {
    const itemValidator = this.getItemValidatorForType(type);
    if (!itemValidator) return [];
    return [commaSeparatedTypedValidator(itemValidator)];
  }

  private getOptionsValidators(type: string | null | undefined): ValidatorFn[] {
    const itemValidator = this.getItemValidatorForType(type);
    if (itemValidator) {
      return [commaSeparatedTypedValidator(itemValidator)];
    }
    return [CommaSeparatedStringValidator];
  }

  private getItemValidatorForType(type: string | null | undefined): ValidatorFn | null {
    switch (type) {
      case 'Integer':
      case 'Long':
        return integerValidator;
      case 'Decimal':
      case 'Double':
      case 'Float':
        return decimalValidator;
      case 'Boolean':
        return booleanValidator;
      default:
        return null;
    }
  }

  private subscribeToFormChanges(): void {
    this.propertiesFormArray.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshFilter();
      this.validateAndUpdateButtonState();
    });
  }

  private duplicatePropertyNamesValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const formArray = control as FormArray;
      const activeNames = formArray.controls
        .filter(row => !row.get('remove')?.value)
        .map(row => this.normalizeName(row.get('name')?.value))
        .filter(Boolean);
      return activeNames.length !== new Set(activeNames).size ? { duplicateNames: true } : null;
    };
  }

  private validateAndUpdateButtonState(): void {
    if (this.propertiesFormArray.hasError('duplicateNames')) {
      this.errorMessage = 'Duplicate property names are not allowed.';
      this.leftUpdateButtonEnable = false;
      this.updateButtonEnable = false;
      this.validityChange.emit(false);
      return;
    }
    this.errorMessage = '';
    const isValid = this.propertiesFormArray.valid;
    this.leftUpdateButtonEnable = isValid;
    this.updateButtonEnable = isValid;
    this.validityChange.emit(isValid);
  }

  public onSearchChange(): void {
    this.refreshFilter();
  }

  private refreshFilter(): void {
    const term = this.searchTerm?.toLowerCase().trim() ?? '';
    const controls = this.propertiesFormArray.controls as FormGroup[];
    if (!term) {
      this.filteredControls = controls;
      return;
    }
    this.filteredControls = controls.filter(group => {
      const name = (group.get('name')?.value as string)?.toLowerCase() ?? '';
      const column = (group.get('columnName')?.value as string)?.toLowerCase() ?? '';
      return name.includes(term) || column.includes(term);
    });
  }

  public getClassIfChanged(control: FormGroup, key: string): boolean {
    const id = control.get('id')?.value as string | null;
    if (!id) {
      return false;
    }
    const original = this.originalPropertyById.get(id);
    if (!original) {
      return false;
    }
    const current = control.get(key)?.value;
    const previous = original[key as keyof PropertyFormInput];
    return this.normalizeComparableValue(current) !== this.normalizeComparableValue(previous);
  }

  public isNewRow(control: FormGroup): boolean {
    return !control.get('id')?.value;
  }

  public setActiveInput(field: string | null): void {
    this.activeInput = field;
  }

  public getFieldError(control: FormGroup, fieldName: string): string | null {
    const ctrl = control.get(fieldName);
    if (!ctrl || !ctrl.dirty || !ctrl.errors) return null;
    const errors = ctrl.errors;
    if (typeof errors.invalidName === 'string') return errors.invalidName;
    if (errors.invalidInteger) return this.tr('Value must be a valid integer');
    if (errors.invalidDecimal) return this.tr('Value must be a valid number');
    if (errors.invalidBoolean) return this.tr('Value must be true or false');
    if (errors.invalidCommaPlacement) return this.tr('Cannot start or end with a comma');
    if (errors.consecutiveCommas) return this.tr('Consecutive commas are not allowed');
    if (errors.emptyOrWhitespaceValue) return this.tr('Empty values are not allowed');
    if (errors.spaceAroundValue || errors.internalSpaceInvalid) {
      return this.tr('Spaces are not allowed inside values');
    }
    if (errors.invalidCharacters) return this.tr('Invalid characters in value');
    if (errors.duplicateValues) return this.tr('Duplicate values are not allowed');
    if (errors.required) return this.tr('This field is required');
    return null;
  }

  public handleCheckboxChange(event: Event): void {
    this.advancePropertyFormOn = (event.target as HTMLInputElement).checked;
    this.rebuildShowableKeys();
  }

  /** Add a new (custom) property row. Wired to the lib's own toolbar button. */
  public addMoreProperty(): void {
    // Block adding a new row while any existing row has a validation
    // issue (invalid field or duplicate name). `leftUpdateButtonEnable`
    // is already kept in sync with propertiesFormArray validity by
    // validateAndUpdateButtonState(); an empty form is valid so the
    // first row can always be added.
    if (!this.leftUpdateButtonEnable) {
      this.warn.emit('Resolve the issues in the existing properties before adding a new one.');
      return;
    }
    const newProperty: PropertyFormInput = { isCustomProperty: true };
    const group = this.createPropertyFormGroup(newProperty, false);
    this.propertiesFormArray.push(group);
    this.refreshFilter();
    this.validateAndUpdateButtonState();
    const newIndex = this.filteredControls.length - 1;
    this.zone.onStable.pipe(take(1), takeUntil(this.destroy$)).subscribe(() => {
      this.scrollToRow(newIndex);
      this.focusFirstInput(newIndex);
    });
  }

  public removeProperty(control: FormGroup): void {
    if (!control.get('isCustomProperty')?.value) {
      return;
    }
    const propertyName = control.get('name')?.value as string;
    if (propertyName && this.propertyNamesUsedInRules.includes(propertyName)) {
      this.warn.emit('This property is being used in a rule and cannot be deleted.');
      return;
    }
    const hasId = !!control.get('id')?.value;
    const hasName = !!(control.get('name')?.value as string)?.length;
    if (!hasId && !hasName) {
      const index = this.propertiesFormArray.controls.indexOf(control);
      if (index >= 0) {
        this.propertiesFormArray.removeAt(index);
      }
    } else {
      control.patchValue({ remove: !control.get('remove')!.value });
    }
    this.refreshFilter();
    this.validateAndUpdateButtonState();
  }

  public onEventSelectionChange(event: { value?: string[] } | null): void {
    this.importedEventNames = Array.isArray(event?.value) ? [...event!.value!] : [];
    const allImportedProperties = new Map<string, PropertyModel>();
    for (const eventName of this.importedEventNames) {
      const properties =
        (this.importableEvents ?? []).find(e => e.name === eventName)?.properties ?? [];
      if (!properties.length) {
        this.warn.emit(`No properties found for the ${eventName} analytic.`);
        continue;
      }
      for (const property of properties) {
        const prefixedName = `${eventName}_${property.name}`;
        if (!allImportedProperties.has(prefixedName)) {
          allImportedProperties.set(prefixedName, {
            ...property,
            name: prefixedName,
            columnName: `${eventName}_${property.columnName}`,
          } as PropertyModel);
        }
      }
    }
    const importedProperties: PropertyFormInput[] = Array.from(
      allImportedProperties.values(),
    ).map(property => ({
      ...property,
      id: null,
      isCustomProperty: true,
      analyticEventId: this.eventId,
      type: this.toTypeKey(property.type),
    }));
    this.propertiesFormArray.clear();
    for (const property of importedProperties) {
      this.propertiesFormArray.push(this.createPropertyFormGroup(property, true));
    }
    this.refreshFilter();
    this.validateAndUpdateButtonState();
    this.updateButtonEnable = importedProperties.length > 0;
    if (!importedProperties.length && event?.value?.length) {
      this.warn.emit('No properties found for the selected analytics.');
    }
  }

  // ---- public chrome hooks (footer buttons or host-owned chrome) ----
  public submitChanges(): void {
    this.updateAnalyticProperties();
  }

  public submitImport(): void {
    this.importAnalyticProperties();
  }

  public requestCancel(): void {
    this.cancel.emit();
    if (this.hostedInModal) {
      this.DataSubmitted.emit({ type: 'cancel' });
      this.modalRef?.close();
    }
  }

  private scrollToRow(rowIndex: number): void {
    const wrapper = this.tableWrap?.nativeElement;
    if (!wrapper) {
      return;
    }
    const rows = wrapper.querySelectorAll('tr.pse-row');
    const row = rows[rowIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private focusFirstInput(rowIndex: number): void {
    const wrapper = this.tableWrap?.nativeElement;
    if (!wrapper) {
      return;
    }
    const rows = wrapper.querySelectorAll('tr.pse-row');
    const row = rows[rowIndex] as HTMLElement | undefined;
    const cell = row?.querySelector('td input') as HTMLInputElement | null;
    cell?.focus();
  }

  private updateAnalyticProperties(): void {
    if (!this.editEventPropForm.valid && !this.propertiesFormArray.valid) {
      return;
    }
    const controls = this.propertiesFormArray.controls as FormGroup[];
    const propToAdd: PropertyModel[] = [];
    const propToUpdate: PropertyModel[] = [];
    const propToDelete: PropertyModel[] = [];
    for (const group of controls) {
      const raw = group.getRawValue() as PropertyFormInput;
      const original = raw.id ? this.originalPropertyById.get(raw.id) : undefined;
      if (raw.remove) {
        if (original) {
          propToDelete.push(
            this.mergeIntoOriginal(original, { ...original, analyticEventId: this.eventId }),
          );
        }
        continue;
      }
      if (original) {
        if (group.dirty) {
          propToUpdate.push(this.mergeIntoOriginal(original, raw));
        }
      } else {
        propToAdd.push(this.buildNewProperty(raw));
      }
    }
    const remainingIds = new Set(
      controls.map(group => group.getRawValue().id).filter(Boolean),
    );
    for (const original of this.originalEventProperties) {
      if (original.id && !remainingIds.has(original.id)) {
        propToDelete.push(
          this.mergeIntoOriginal(original, { ...original, analyticEventId: this.eventId }),
        );
      }
    }
    const result: PropertySaveResult = {
      added: propToAdd,
      updated: propToUpdate,
      deleted: propToDelete,
    };
    this.save.emit(result);
    if (this.hostedInModal) {
      this.DataSubmitted.emit({ type: 'save', payload: result });
      this.modalRef?.close(result);
    }
  }

  private importAnalyticProperties(): void {
    const controls = this.propertiesFormArray.controls as FormGroup[];
    const propToAdd: PropertyModel[] = controls
      .filter(group => !group.get('remove')!.value)
      .map(group => this.buildNewProperty(group.getRawValue() as PropertyFormInput));
    const result: PropertyImportResult = {
      importedEventNames: this.importedEventNames,
      importedProperties: propToAdd,
    };
    this.importSave.emit(result);
    if (this.hostedInModal) {
      this.DataSubmitted.emit({ type: 'import', payload: result });
      this.modalRef?.close(result);
    }
  }

  private mergeIntoOriginal(original: PropertyFormInput, raw: PropertyFormInput): PropertyModel {
    const property = this.buildNewProperty(raw, original);
    if (original.id) {
      property.id = original.id;
    }
    return property;
  }

  private nullIfBlank(value: string | null | undefined): string | null {
    return value == null || value.trim() === '' ? null : value;
  }

  private normalizeName(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeComparableValue(value: unknown): string {
    if (value == null) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private buildNewProperty(
    raw: PropertyFormInput,
    original: PropertyFormInput = {},
  ): PropertyModel {
    const property = new PropertyModel();
    property.analyticEventId = raw.analyticEventId ?? this.eventId;
    property.analytic = null;
    property.name = raw.name ?? '';
    property.columnName = raw.columnName ?? '';
    property.type = EventPropertyType[raw.type as keyof typeof EventPropertyType] ?? null;
    property.defaultValues = this.nullIfBlank(raw.defaultValues);
    property.filterable = raw.filterable ?? false;
    property.isEditable = raw.isEditable ?? false;
    property.showInUI = raw.showInUI ?? false;
    property.showInPopup = raw.showInPopup ?? false;
    property.appendText = this.nullIfBlank(raw.appendText);
    property.isCustomProperty = raw.isCustomProperty ?? true;
    property.options = this.nullIfBlank(raw.options);
    property.cellRenderer = original.cellRenderer ?? null;
    property.placeholder = original.placeholder ?? null;
    return property;
  }
}
