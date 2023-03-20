import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';
import { Subscription } from 'rxjs';

import * as conf from '../../../../global.conf';

@Component({
  selector: 'app-upload-file-socket',
  templateUrl: './upload-file-socket.component.html',
  styleUrls: ['./upload-file-socket.component.less'],
})
export class UploadFileSocketComponent implements OnInit, OnDestroy {
  fileManagerTitle = 'File Manager';
  fReader: any;
  fWriter: any;
  abortSignal: boolean = false;
  // Uploading
  selectedFile: any;
  uploadPercent: any;
  uploadedBytes: any;
  uploadedFiles: { name: string; size: number }[] = [];
  fileUploaded: boolean = false;
  // Downloading
  fileToDownload: any;
  downloadPercent: any;
  fileDownloaded: boolean = false;

  fileError: any;
  inProgress: boolean = false;
  downloadTitle = 'Download';

  nativeSaveAs: boolean = false;
  dataToDownload: ArrayBuffer[] = [];

  subscription: Subscription;

  constructor(private socket: Socket, private router: Router) {
    this.subscription = this.router.events.subscribe(async (event) => {
      if (event instanceof NavigationStart) {
        this.abortFileDownload();
      }
    });
  }

  ngOnInit() {
    this.socket.on('uploadedFiles', (data: any) => {
      this.uploadedFiles = data.uploadedFiles;
    });

    this.socket.on('fileDataGet', (data: any) => {
      this.uploadPercent = parseInt(data['percent']);

      //The Next Blocks Starting Position
      let startingRange = data['startingRange'];

      this.uploadedBytes = this.bytesToSize(startingRange);

      // Get next portion of data based on our progress.
      // If last chunk is smaller than the actual size,
      // we get either RW_BUFFER_GET_SIZE step size or left size from the file.
      let newFileBlob: Blob = this.selectedFile.slice(
        startingRange,
        startingRange +
          Math.min(
            conf.RW_BUFFER_GET_SIZE,
            this.selectedFile.size - startingRange
          )
      );

      // Get next Blob portion of data to be written
      this.fReader.readAsArrayBuffer(newFileBlob);
    });

    this.socket.on(
      'fileDone',
      (data: { uploadedFiles: { name: string; size: number }[] }) => {
        console.log('File uploaded successfully');
        this.uploadedFiles = data.uploadedFiles;
        this.uploadPercent = null;
        this.selectedFile = null;
        this.fileUploaded = true;
      }
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onFileSelect(event: any) {
    this.resetDownloading();
    this.fileError = null;
    this.selectedFile = event.target.files[0];
  }

  upload() {
    if (!this.selectedFile) {
      this.fileError = 'Please attach a file and then click upload!';
      return;
    }

    this.fReader = new FileReader();

    this.fReader.onload = (evnt: any) => {
      this.socket.emit('fileUpload', {
        fileName: this.selectedFile.name,
        data: evnt.target.result,
      });
    };

    this.socket.emit('fileInit', {
      fileName: this.selectedFile.name,
      size: this.selectedFile.size,
    });
  }

  async download() {
    this.inProgress = true;
    this.downloadTitle = 'Downloading...';

    try {
      // Show the file save dialog.
      const handle = await window.showSaveFilePicker({
        suggestedName: this.fileToDownload.name,
      });

      // Write the blob to the file.
      this.fWriter = await handle.createWritable();
    } catch (err: any) {
      this.resetDownloading();
      return;
    }

    // If true - native saveAs
    this.nativeSaveAs && (this.dataToDownload = []);

    this.socket.emit('fileDownload', {
      fileName: this.fileToDownload.name,
    });

    this.socket.on(
      'fileProgress',
      async (data: { percentage: any; bufferData: any }) => {
        this.downloadPercent = parseInt(data.percentage);

        // If true - native saveAs
        this.nativeSaveAs && this.dataToDownload.push(data.bufferData);

        try {
          await this.fWriter.write(new Uint8Array(data.bufferData));
        } catch (err: any) {
          this.abortFileDownload();
        }
      }
    );

    this.socket.on('fileDownloaded', async () => {
      !this.abortSignal && (await this.fWriter.close());
      this.fileDownloaded = true;
      this.resetDownloading();

      // If true - native saveAs
      this.nativeSaveAs && this.nativeSaveAsFn();
    });

    this.socket.on('fileError', (error: any) => {
      this.fileError = error.error.message;
    });
  }

  fileSelection(file: any) {
    this.fileToDownload = file;
    this.fileError = null;
  }
  resetDownloading() {
    this.downloadTitle = 'Download';
    this.fileToDownload = undefined;
    this.inProgress = false;
    this.downloadPercent = null;
  }

  abortFileDownload(message?: string) {
    this.socket.emit('abortFileDownloading');

    this.socket.on(
      'abortFileDownloadingStatus',
      (data: { abortStatus: boolean }) => {
        if (data.abortStatus) {
          let errrorMessage = message
            ? message
            : `Download interupted due to page refreshed`;
          this.fileError = errrorMessage;
          console.error(errrorMessage);
          this.abortSignal = true;
          this.resetDownloading();
        }
      }
    );
  }

  nativeSaveAsFn() {
    let blob: any = new Blob(this.dataToDownload);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileToDownload.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  bytesToSize(bytes: any) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0';
    const i: number = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i === 0) return `${bytes} ${sizes[i]})`;
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
  }
}
