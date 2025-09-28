import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { PythonProfileComponent } from './python-profile';

@NgModule({
  declarations: [PythonProfileComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HttpClientModule
  ],
  exports: [PythonProfileComponent]
})
export class PythonProfileModule { }
