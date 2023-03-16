import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent {
  title: string =
    'Upload/Download File with Socket IO. Handle network interuption, big files and resumable uploading.';
  selectedFile: any;
  name: string = '';

  constructor() {}

  ngOnInit() {}

  onFileSelect(event: any) {
    this.selectedFile = event.target.files[0];
    this.name = this.selectedFile.name;
    console.log(this.selectedFile);
  }
}
