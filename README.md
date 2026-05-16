# @i2v-systems/property-schema-editor-ng12 (Angular 12 backport)

Angular **12.2** backport of analytic-manager's event property-**schema** editor
(`Analytic/ClientApp/src/app/modules/settings/edit-event-properties`). It is an
editable table for property *definitions* — name, columnName, type,
defaultValues, options, filterable, isEditable, showInUI, showInPopup,
appendText — with add / remove / import-from-another-event, type-aware
validators, duplicate-name validation, search filter, a "show advanced
properties" toggle, and change-row highlighting.

> The analytic-manager original used Kendo Grid purely as a layout container
> (no sort/page/Kendo-edit/commands). Kendo Grid requires a ~937 KB **global**
> theme that repaints the host app's own elements — unacceptable for an
> embeddable library. So the grid was replaced with a **self-styled native
> table** driven by the same reactive `FormArray`: zero `@progress/*` deps,
> no Kendo licence, no global CSS, no host bleed.

> **v1.1 — `<lib-property-schema-section>`.** A read-only "Properties (N)"
> panel (properties grouped by type as chips) with a pencil button that
> opens the editor inside **`@i2v-systems/common-modal-ng12`**'s
> `CommonModalComponent` via `MatDialog` — exactly analytic-manager's
> `event-details → editProperties()` flow. The bare
> `<lib-property-schema-editor>` is still exported for standalone use.
> Adds one peer dep: `@i2v-systems/common-modal-ng12@^1.0.1`.

**Pure UI / data-agnostic.** The v17 original was wired to analytic-manager's
`MatDialog`, `EventsClientManager`, `CommonService`, `ValidationService`,
`HumanizePipe` and `TranslateService`. This backport injects **none** of those:
all data goes in via `@Input`, all results come out via `@Output`. Drop it into
any Angular 12 app.

> **Build location:** built from a dedicated Angular-12 harness at
> `c:\projects\property-schema-editor-build\` (mirrors the tree-ng12 /
> i2v-utility-ng12 / i2vquerybuilder-ng12 pattern). The library source is
> standalone at `c:\projects\property-schema-editor-ng12\`.

---

## Table of contents
- [Public API](#public-api)
- [What was vendored / changed in the backport](#what-was-vendored--changed-in-the-backport)
- [Consuming the library](#consuming-the-library)
- [Build & develop (harness)](#build--develop-harness)
- [Gotchas & troubleshooting](#gotchas--troubleshooting)

---

## Public API

`<lib-property-schema-editor>` (`PropertySchemaEditorComponent`), exported by
`PropertySchemaEditorModule`.

### Inputs

| Input | Type | Default | Purpose |
|---|---|---|---|
| `properties` | `PropertyModel[]` | `[]` | The schema rows to edit. Deep-cloned internally — your array is never mutated. |
| `eventName` | `string` | `''` | The owning event's name. Excluded from the import dropdown. |
| `eventId` | `string` | `''` | Stamped onto `analyticEventId` of built/saved properties. |
| `canImportProperties` | `boolean` | `false` | Shows the "import properties from another event" multiselect. **Default `false` — keep it off (see [Known limitation](#known-limitation--import-from-another-analytic)).** |
| `importableEvents` | `ImportableEvent[]` | `[]` | `{ name; properties: PropertyModel[] }[]` — the events whose properties can be imported. Replaces analytic-manager's `EventsClientManager.entityDetailsMap`. |
| `propertyNamesUsedInRules` | `string[]` | `[]` | Property names currently used in rules. The editor blocks deleting any of these (and emits `warn`). Replaces `EventsClientManager.ruleGroupsMap` traversal. |
| `advancedPropertyKeys` | `string[]` | *derived* | Optional override of which keys appear when "Show advanced properties" is on. |
| `translateFn` | `(key:string)=>string` | — | Optional translation hook. Resolution order: `translateFn` → injected `@ngx-translate` `TranslateService` (if present) → identity. |
| `hideFooter` | `boolean` | `false` | Hide the built-in Save / Import / Cancel footer (drive the public methods from host chrome instead). |
| `importPlaceholder` | `string` | `'Select analytic/s to import properties:'` | Placeholder text for the import multiselect. Pass an already-translated string; the lib does **not** run this through `translateFn`. |
| `maxHeight` | `string?` | *unset* | Optional CSS height cap for the whole editor (any CSS length, e.g. `'460px'`, `'70vh'`). When set, the editor bounds its own height and the property table scrolls **inside** (horizontal + vertical) with the toolbar and footer pinned. Leave unset to grow with content or fill a height-constrained parent (CommonModal already forces `height:100%` inline — the modal still scrolls correctly without this). **Overflow handling lives in the library** — to embed the editor in a small container, just pass `[maxHeight]`; no wrapper `overflow` CSS needed on the host. |

### Outputs

| Output | Payload | Purpose |
|---|---|---|
| `save` | `PropertySaveResult` `{ added; updated; deleted: PropertyModel[] }` | Emitted by the footer **Save** button (replaces `dialogRef.close({added,updated,deleted})`). |
| `importSave` | `PropertyImportResult` `{ importedEventNames:string[]; importedProperties:PropertyModel[] }` | Emitted by the footer **Import** button. |
| `cancel` | `void` | Emitted by the footer **Cancel** button. |
| `warn` | `string` | A user-actionable warning (e.g. deleting a rule-bound property, no properties on an imported event). The action is still vetoed internally — surface this via your own toast/snackbar. Replaces 4 `CommonService.showWarningToastr(...)` calls. |
| `validityChange` | `boolean` | Current form validity — convenience for host-owned chrome. |

### Public methods (for `hideFooter` / host-owned chrome)

`submitChanges()`, `submitImport()`, `requestCancel()` — equivalent to the
footer buttons.

### Exported models

`PropertyModel` (class — keep using `new PropertyModel()` if you build rows
imperatively), `PropertykeyTypes`, `EventPropertyType`, `PropertyFormInput`,
`ImportableEvent`, `PropertySaveResult`, `PropertyImportResult`, `HumanizePipe`,
and the vendored validators.

### Data contract — what goes in, what comes back

**You give it `PropertyModel[]`** (the `[properties]` input). `PropertyModel`
is an exported **class**:

```ts
class PropertyModel {
  id: string;                 // null/empty ⇒ treated as a NEW row
  name: string;               // unique within the event; no spaces/special chars
  columnName: string;         // backing column key; required
  type: EventPropertyType;    // numeric enum (String=1, Float=2, Boolean=3, …)
  analyticEventId: string;    // stamped from the `eventId` input on save
  analytic: unknown;          // always null in this lib (domain coupling dropped)
  defaultValues: string;      // comma-separated; validated per `type`
  options: string;            // comma-separated; for select-like types
  filterable: boolean;        // auto-disabled unless showInUI
  isEditable: boolean;
  showInUI: boolean;
  showInPopup: boolean;
  appendText: string;         // e.g. "Mbps", "%"
  isCustomProperty: boolean;  // only custom rows can be removed
  cellRenderer: string;       // preserved round-trip
  placeholder: string;        // preserved round-trip
  trueIcon / falseIcon / expression: string;  // preserved, not edited here
}
```

Plain objects shaped like this are fine — the lib deep-clones the input
(your array is never mutated) and reads keys by name. Use
`new PropertyModel()` only if you want the class defaults.

**It hands results back via `@Output` events (no service, no promise).**
Wire callbacks in your template:

```html
<lib-property-schema-editor
  [properties]="props" [eventId]="evtId" [eventName]="evtName"
  (save)="onSave($event)"          <!-- user clicked Save  -->
  (importSave)="onImport($event)"  <!-- user clicked Import -->
  (cancel)="onCancel()"            <!-- user clicked Cancel -->
  (warn)="toast($event)">          <!-- blocked action message -->
</lib-property-schema-editor>
```

```ts
import { PropertySaveResult, PropertyImportResult } from '@i2v-systems/property-schema-editor-ng12';

onSave(r: PropertySaveResult) {
  // r.added:   PropertyModel[]  — new rows (no id)
  // r.updated: PropertyModel[]  — existing rows whose fields changed (id kept)
  // r.deleted: PropertyModel[]  — removed / soft-removed rows (id kept)
  this.api.persist(r.added, r.updated, r.deleted);
}

onImport(r: PropertyImportResult) {
  // r.importedEventNames:  string[]
  // r.importedProperties:  PropertyModel[]  — prefixed `${eventName}_${name}`
}
```

`save` partitions rows into **added** (no `id`), **updated** (had `id`, a
field changed), and **deleted** (was present, now removed or toggled
*Remove*). `type` comes back as the numeric `EventPropertyType`.
`analyticEventId` is set from the `eventId` input. The component performs
**no network/persistence itself** — you receive the diff and decide what
to do with it.

---

## `<lib-property-schema-section>` (v1.1) — read-only panel + modal editor

Mirrors analytic-manager's `event-details` Properties block: a read-only
"Properties (N)" panel (properties grouped by `EventPropertyType`, names
shown as chips) with a pencil that opens the editor inside
`@i2v-systems/common-modal-ng12`'s `CommonModalComponent` via `MatDialog`.

### Inputs

Same data inputs as the editor — `properties`, `eventName`, `eventId`,
`canImportProperties`, `importableEvents`, `propertyNamesUsedInRules`,
`advancedPropertyKeys`, `translateFn`, `importPlaceholder` — forwarded to
the editor when the modal opens. Plus:

| Input | Type | Default | Purpose |
|---|---|---|---|
| `editHeading` | `string` | `'Edit event properties ({event})'` | Modal heading; `{event}` is replaced with `eventName`. |
| `readonly` | `boolean` | `false` | Hide the pencil (display-only). |
| `maxHeight` | `string?` | _unset_ | Optional CSS height cap for the read-only panel itself (not the modal — see `modalHeight` for that). When set, the header (title + pencil) stays pinned and the grouped chip list scrolls **inside**. Leave unset to grow with content. Embed the panel in a small container by just passing `[maxHeight]` — no wrapper `overflow` CSS needed. |
| `modalHeight` | `string?` | _unset_ | Optional. Leave unset (default) to use **CommonModal's own normal size** — the editor table scrolls inside (H+V). Set a fixed CSS value only if you want to override. |
| `modalWidth` | `string?` | _unset_ | Optional. Leave unset (default) to use **CommonModal's own normal size**. Override with a fixed value if needed (avoid `'auto'`). |
| `modalPanelClass` | `string` | `'common-modal-panel'` | MatDialog `panelClass`. Defaults to the class `@i2v-systems/common-modal-ng12` documents — the host **must** ship a global rule `.common-modal-panel .mat-dialog-container { padding: 0 !important }` (see [Required global CSS](#required-global-css-angularjson-styles)). Without it, Material's default 24px `.mat-dialog-container` padding leaks in and the heading/footer/scroll look wrong vs. opening CommonModal directly. |

### Outputs

`save` / `importSave` / `cancel` / `warn` — bubbled from the editor after
the user acts in the modal (the section subscribes to the modal's
`afterAction`, then closes it).

### How the modal bridge works

`CommonModalComponent` dynamically creates the editor via
`ComponentFactoryResolver` and does **not** pass `@Input`s. So the editor
has an optional bridge (active **only** when hosted in the modal; the
standalone `@Input`/`@Output` path is untouched):

- `@Optional() @Inject(MAT_DIALOG_DATA)` → editor hydrates its inputs from
  `data.event.data` and auto-sets `hideFooter` (the modal renders the footer).
- `@Output() DataSubmitted` → emitted on save/import/cancel; CommonModal
  re-emits it through its `afterAction`. The editor also closes the
  inherited `MatDialogRef`.
- Footer buttons are declared by the section as analytic does —
  `basedOnChildTemplate: true`, `Callback: 'addMoreProperty' | 'submitChanges'`,
  `disabledWith: 'leftUpdateButtonEnable' | 'updateButtonEnable'` — resolved
  by name against the editor instance.

### Usage

```html
<lib-property-schema-section
  [properties]="props" [eventId]="evtId" [eventName]="evtName"
  [canImportProperties]="true" [importableEvents]="importable"
  [propertyNamesUsedInRules]="ruleNames"
  (save)="onSave($event)" (importSave)="onImport($event)"
  (cancel)="onCancel()" (warn)="toast($event)">
</lib-property-schema-section>
```

Host module must import `PropertySchemaEditorModule`, plus have
`MatDialogModule`, `CommonModalNg12Module`, `BrowserAnimationsModule` and a
Material theme (the lib's module already imports `CommonModalNg12Module` +
`MatDialogModule`; the host just needs the peer deps installed). After
`(save)`, update your bound `[properties]` (the panel re-groups on change).

---

## What was vendored / changed in the backport

- **DI ripped out:** `MAT_DIALOG_DATA`/`MatDialogRef`, `EventsClientManager`,
  `CommonService`, `ValidationService`, `HumanizePipe`, `AnalyticEventModel`
  removed. `TranslateService` is now `@Optional()`.
- **Validators vendored** as pure functions (`property-validators.ts`) from
  analytic-manager's `ValidationService` (only the 7 the editor uses).
- **`HumanizePipe`** re-implemented inline (no `humanize-string` npm dep).
- **`Property` / `EventPropertyType`** vendored into `property-schema-editor.models.ts`;
  `Analytic` coupling dropped (`analytic` is `unknown`). `PropertyModel` kept a
  **class with initialised fields** so `Object.keys(new PropertyModel())` (used to
  build the advanced column set) works on the ES2017 build target.
- **`structuredClone` → `deepClone`** (JSON round-trip; payloads are plain JSON).
- **`appendTo="body"` removed** from `<p-dropdown>`/`<p-multiSelect>` so the
  PrimeNG overlay panels render in-component where the lib's `:host ::ng-deep`
  theme reaches them — host needs **no PrimeNG theme stylesheet** (same approach
  as i2vquerybuilder-ng12).
- **Kendo Grid removed entirely.** The v17 source rendered the rows in
  `<kendo-grid>`, but used **no** Kendo feature (no sort/page/Kendo-edit/
  commands) — it was a dumb layout container. Kendo Grid only renders with a
  ~937 KB **global** theme stylesheet that repaints the host app's own
  `ul/li/input/button/table`, which is unacceptable for an embeddable library
  (it visibly wrecked other libraries in the shared demo). It was replaced
  with a **self-styled native `<table>`** that `*ngFor`s the same
  `filteredControls` FormGroups through the same cell templates. Result: no
  `@progress/*` deps, no Kendo licence, no global CSS, no host bleed — all
  styling is `:host`-scoped like the rest of the lib.
- **Footer added:** the v17 component had no buttons (the MatDialog wrapper owned
  them). The lib now renders its own Save / Import / Cancel footer (`[hideFooter]`
  to opt out).

---

## Consuming the library

### Install (registry flow — after publish)

```powershell
npm install @i2v-systems/property-schema-editor-ng12@1.0.0 --save
```

### Peer dependencies

```
@angular/{common,core,forms,cdk,material}  ^12.2.0
@ngx-translate/core                        ^13.0.0
primeng ^12.2.0   primeicons ^4.1.0
@i2v-systems/common-modal-ng12             ^1.0.1   (v1.1 — the section's modal)
@i2v-systems/i2v-utility-ng12              ^3.0.0   (v1.1 — i2v-btn / i2v-chips global classes)
```

- `@angular/material` + `@angular/cdk` — `matTooltip` (editor) and `MatDialog`
  (section opens the modal).
- `primeng` — the type `<p-dropdown>` and import `<p-multiSelect>`.
- `@i2v-systems/common-modal-ng12` — only needed if you use
  `<lib-property-schema-section>` (it opens the editor inside
  `CommonModalComponent`). The bare `<lib-property-schema-editor>` does **not**
  need it.
- `@i2v-systems/i2v-utility-ng12` — **CSS-class dependency only** (no module
  import). The section's value chips use its global `.i2v-chips` class and the
  CommonModal footer buttons use its global `.i2v-btn` classes (the footer is
  rendered in a body-attached MatDialog overlay, so it can only be styled by
  global classes — exactly as analytic-manager does). Not needed for the bare
  editor.
- **No `@progress/*` / Kendo, no Kendo licence.**

### Required global CSS (`angular.json` `styles[]`)

```jsonc
"node_modules/primeng/resources/primeng.min.css",                 // PrimeNG structural only (NO PrimeNG theme — the lib themes it)
"node_modules/primeicons/primeicons.css",
"node_modules/@angular/material/prebuilt-themes/indigo-pink.css",  // any Material theme (matTooltip + MatDialog)
// v1.1 section / CommonModal only — i2v-utility-ng12 design-system classes:
"node_modules/@i2v-systems/i2v-utility-ng12/assets/light.css",            // theme tokens
"node_modules/@i2v-systems/i2v-utility-ng12/assets/common.css",
"node_modules/@i2v-systems/i2v-utility-ng12/assets/button.component.css", // .i2v-btn  (modal footer buttons)
"node_modules/@i2v-systems/i2v-utility-ng12/assets/chips.component.css"   // .i2v-chips (section value chips)
```

Plus this **global rule** in your `src/styles.scss` (or any global stylesheet)
— it is `@i2v-systems/common-modal-ng12`'s own documented requirement, and the
section relies on it for correct modal chrome:

```scss
/* MatDialog's .mat-dialog-container is body-attached (outside any component)
 * — only a GLOBAL rule can zero Material's default 24px padding. */
.common-modal-panel .mat-dialog-container {
  padding: 0 !important;
  border-radius: 12px;
  overflow: hidden;
}
```

(If you pass a custom `[modalPanelClass]`, scope the rule to that class
instead.) Without this the modal heading/footer get Material's container
padding and a spurious scrollbar appears — exactly the discrepancy vs.
opening `CommonModalComponent` directly.

> **Why i2v-utility CSS for the section?** `CommonModalComponent` renders its
> footer buttons in a **body-attached MatDialog overlay**, outside any
> component's style scope — a library literally cannot style them with
> `:host`-scoped CSS. analytic-manager solves this by passing global
> `i2v-btn …` class strings; we do the same. The read-only chips likewise use
> the global `.i2v-chips` for pixel parity. The bare `<lib-property-schema-editor>`
> stays 100% self-styled and needs none of the i2v-utility CSS.

> **No Kendo theme — ever.** This library does not use Kendo. Do **not** add any
> `@progress/kendo-theme-*` stylesheet for it; that file is ~937 KB of
> globally-scoped CSS (bare `ul/li/input/button/table/*` selectors) and will
> repaint your whole app's own elements. The table itself is fully `:host`-scoped.

### Module + usage

```typescript
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PropertySchemaEditorModule } from '@i2v-systems/property-schema-editor-ng12';

@NgModule({ imports: [ BrowserAnimationsModule, ReactiveFormsModule, PropertySchemaEditorModule ] })
export class AppModule {}
```

```html
<lib-property-schema-editor
  [properties]="props" [eventName]="'Camera'" [eventId]="'evt-1'"
  [canImportProperties]="true" [importableEvents]="importable"
  [propertyNamesUsedInRules]="ruleNames"
  (save)="onSave($event)" (importSave)="onImport($event)"
  (cancel)="onCancel()" (warn)="toast($event)">
</lib-property-schema-editor>
```

---

## Build & develop (harness)

```
c:\projects\property-schema-editor-ng12\        # standalone lib source
c:\projects\property-schema-editor-build\       # Angular-12 build harness
  projects\property-schema-editor-ng12  ->  JUNCTION to the source
```

```powershell
cd c:\projects\property-schema-editor-build
npm install --no-audit --no-fund          # ~2-3 min
npm run build                              # one-off  -> dist\property-schema-editor-ng12
npm run watch                              # rebuild on every source change
```

Both scripts prepend `NODE_OPTIONS=--openssl-legacy-provider` (Node 17+ + webpack 4).

Local consumption before publishing: `cd dist\property-schema-editor-ng12 && npm link`,
then `npm link @i2v-systems/property-schema-editor-ng12` in the host.

---

## Known limitation — import-from-another-analytic

`canImportProperties` (the "import properties from another analytic"
multiselect) is **disabled by default and should stay off until reworked.**
The analytic-manager port's behaviour is incomplete:

- selecting analytics **clears the whole form** and replaces it with the
  imported rows (destructive — should *append*),
- no de-duplication, so two properties with the same name can be added,
- import happens implicitly on multiselect change instead of via an
  explicit, intentional action.

**Intended (future) behaviour**, to be implemented in a later version:

- The consumer supplies the importable analytics + which model properties
  are offered (already the `importableEvents: { name; properties }[]`
  input).
- The control is a **multi-checkbox** dropdown of analytics.
- An explicit **"Import properties"** button (enabled only when ≥1
  analytic is selected) performs the import.
- Imported properties are **appended**, skipping any whose `name` already
  exists (no duplicate names).

Until then: leave `canImportProperties` as `false` (the default). The rest
of the editor — add / edit / remove / validate / save — is unaffected.

---

## Gotchas & troubleshooting

| Symptom | Fix |
|---|---|
| Table renders unstyled | The lib's component CSS didn't load — check the package built/linked correctly. There is no Kendo/global theme to add; styling is `:host`-scoped. |
| Host app's own `ul`/`button`/`input` got restyled | You added a `@progress/kendo-theme-*` stylesheet. This lib does **not** use Kendo — remove it. |
| Dropdown panels unstyled | You added a PrimeNG theme — remove it. The lib themes PrimeNG itself; load only `primeng.min.css` + `primeicons.css`. |
| `NG0203` / duplicate Angular under `npm link` | Set `preserveSymlinks: true` in the host's `tsconfig.json` + `angular.json`. |
| Advanced columns empty | Ensure you pass `PropertyModel` instances (or objects with all keys present) — the advanced key set is `Object.keys(new PropertyModel())`. |
