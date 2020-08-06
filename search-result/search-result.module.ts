import { NgModule } from '@angular/core';
import { SearchResultRoutingModule } from './search-result-routing.module';
import { SearchResultComponent } from './search-result.component';
import { SharingModule } from '../shared/shared.module';

@NgModule({
  imports: [   
    SearchResultRoutingModule,
    SharingModule,
  ],
  declarations: [
  	SearchResultComponent,
  ],
  providers: []
})
export class SearchResultModule { }
