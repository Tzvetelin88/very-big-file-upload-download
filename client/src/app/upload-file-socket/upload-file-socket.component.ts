import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Socket } from 'ngx-socket-io';
import { Subscription } from 'rxjs';
import * as streamSaver from 'streamsaver';

import * as conf from '../../../../global.conf';

@Component({
  selector: 'app-upload-file-socket',
  templateUrl: './upload-file-socket.component.html',
  styleUrls: ['./upload-file-socket.component.less'],
})
export class UploadFileSocketComponent implements OnInit, OnDestroy {
  title = 'resumeUpload-ui';
  abortSignal: boolean = false;
  selectedFile: any;
  fReader: any;
  name: string = '';
  uploadPercent: any;
  uploadedBytes: any;
  uploadedFiles: { name: string; size: number }[] = [];
  fileUploaded: boolean = false;
  downloadPercent: any;
  fileToDownload: any;
  fileDownloaded: boolean = false;
  fileError: any;
  inProgress: boolean = false;
  downloadTitle = 'Download';
  color = 'primary';
  mode = 'determinate';

  writer: any;
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
    this.name = this.selectedFile.name;
  }

  upload() {
    if (!this.selectedFile) {
      this.fileError = 'Please attach a file and then click upload!';
      return;
    }

    this.fReader = new FileReader();

    this.fReader.onload = (evnt: any) => {
      this.socket.emit('fileUpload', {
        fileName: this.name,
        data: evnt.target.result,
      });
    };

    this.socket.emit('fileInit', {
      fileName: this.name,
      size: this.selectedFile.size,
    });
  }

  download() {
    this.inProgress = true;
    this.downloadTitle = 'Downloading...';

    const fileStream = streamSaver.createWriteStream(this.fileToDownload.name, {
      size: this.fileToDownload.size, // (optional filesize) Will show progress
    });
    this.writer = fileStream.getWriter();

    // let dataToDownload: ArrayBuffer[] = [];
    this.socket.emit('fileDownload', {
      fileName: this.fileToDownload.name,
    });

    this.socket.on(
      'fileProgress',
      (data: { percentage: any; bufferData: any }) => {
        this.downloadPercent = parseInt(data.percentage);
        // dataToDownload.push(data.bufferData);
        this.writer.write(new Uint8Array(data.bufferData)).catch(() => {
          console.error(`Download interupted due to aborted signal!`);
          this.writer.abort();
          this.socket.emit('abortFileDownloading');

          this.abortSignal = true;
          this.resetDownloading();
        });
      }
    );

    this.socket.on('fileDownloaded', () => {
      !this.abortSignal && this.writer.close();
      this.fileDownloaded = true;
      this.resetDownloading();

      // Alternative use saveAs or:
      // let blob: any = new Blob(dataToDownload);
      // console.log(blob);
      // const url = window.URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = `dasdas.zip`;
      // a.click();
      // URL.revokeObjectURL(url);
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
        console.log(`INSIDE 3 ..... ${data.abortStatus}`);
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

  bytesToSize(bytes: any) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0';
    const i: number = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i === 0) return `${bytes} ${sizes[i]})`;
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
  }
}
