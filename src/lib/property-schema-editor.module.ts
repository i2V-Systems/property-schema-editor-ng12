import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CommonModalNg12Module } from '@i2v-systems/common-modal-ng12';

import { PropertySchemaEditorComponent } from './property-schema-editor.component';
import { PropertySchemaSectionComponent } from './property-schema-section.component';
import { HumanizePipe } from './humanize';

@NgModule({
  declarations: [
    PropertySchemaEditorComponent,
    PropertySchemaSectionComponent,
    HumanizePipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTooltipModule,
    MatDialogModule,
    TranslateModule,
    DropdownModule,
    MultiSelectModule,
    CommonModalNg12Module,
  ],
  exports: [PropertySchemaEditorComponent, PropertySchemaSectionComponent],
})
export class PropertySchemaEditorModule {}
