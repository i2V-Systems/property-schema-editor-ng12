/*
 * Public models — vendored from analytic-manager
 * (Models/property.model.ts + Models/eventPropertyType.model.ts), domain
 * coupling dropped (`analytic` is now `unknown`, no `Analytic` import).
 *
 * NOTE: PropertyModel MUST be a class with INITIALISED fields. The editor
 * does `Object.keys(new PropertyModel())` to build the "advanced" column
 * set. Under the v12 build target (ES2017, useDefineForClassFields=false)
 * a declared-but-uninitialised field emits nothing, so `Object.keys`
 * would return []. Initialising every field to a default keeps the keys
 * enumerable on any target.
 */
export class PropertyModel {
  public id: string = null;
  public name: string = null;
  public columnName: string = null;
  public type: EventPropertyType = null;
  public analyticEventId: string = null;
  public analytic: unknown = null;
  public defaultValues: string = null;
  public filterable: boolean = false;
  public showInUI: boolean = false;
  public showInPopup: boolean = false;
  public cellRenderer: string = null;
  public appendText: string = null;
  public isCustomProperty: boolean = false;
  public isEditable: boolean = false;
  public trueIcon: string = null;
  public falseIcon: string = null;
  public options: string = null;
  public expression: string = null;
  public placeholder: string = null;
}

export const PropertykeyTypes: { [key: string]: string } = {
  id: 'string',
  name: 'string',
  columnName: 'string',
  type: 'object',
  analyticEventId: 'string',
  analytic: 'object',
  defaultValues: 'string',
  filterable: 'boolean',
  showInUI: 'boolean',
  showInPopup: 'boolean',
  cellRenderer: 'string',
  appendText: 'string',
  trueIcon: 'string',
  falseIcon: 'string',
  isCustomProperty: 'boolean',
  isEditable: 'boolean',
  options: 'string',
};

export enum EventPropertyType {
  Integer = 0,
  String = 1,
  Float = 2,
  Boolean = 3,
  IpAddress = 4,
  DateTime = 5,
  Image = 6,
  Date = 7,
  TimeOfDay = 8,
  DayOfWeek = 9,
  ImagePath = 10,
  UNIXDateTime = 11,
  FilePath = 12,
  Array = 13,
  Custom = 14,
  MultiSelect = 15,
  FloatArray = 16,
  StringArray = 17,
  Vector = 18,
  Guid = 19,
  SingleSelect = 20,
  Jsonb = 21,
  JsonArray = 22,
  GuidArray = 23,
  Search = 100,
  Hours = 101,
  Long = 102,
  Double = 103,
  ImagePathArray = 104,
}

/** Per-row form value shape used internally and surfaced for typing. */
export interface PropertyFormInput {
  id?: string | null;
  name?: string | null;
  columnName?: string | null;
  type?: string | null;
  defaultValues?: string | null;
  options?: string | null;
  filterable?: boolean;
  isEditable?: boolean;
  showInUI?: boolean;
  showInPopup?: boolean;
  appendText?: string | null;
  isCustomProperty?: boolean;
  analyticEventId?: string | null;
  cellRenderer?: string | null;
  placeholder?: string | null;
  remove?: boolean;
}

/** An event whose properties can be imported into the one being edited. */
export interface ImportableEvent {
  name: string;
  properties: PropertyModel[];
}

/** Payload emitted by `(save)`. */
export interface PropertySaveResult {
  added: PropertyModel[];
  updated: PropertyModel[];
  deleted: PropertyModel[];
}

/** Payload emitted by `(importSave)`. */
export interface PropertyImportResult {
  importedEventNames: string[];
  importedProperties: PropertyModel[];
}
