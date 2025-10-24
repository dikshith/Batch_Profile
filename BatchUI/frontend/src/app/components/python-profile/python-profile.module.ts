import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PythonProfileComponent } from './python-profile';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PythonProfileComponent
  ],
  exports: [PythonProfileComponent]
})
export class PythonProfileModule { }
