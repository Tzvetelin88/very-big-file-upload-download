# Solution Design

Proper way to download or upload very big files with realtime data streaming and information.<br />
Consume less memory and do not break or crash server or client browser.<br />
Control Blob chunks to be r/w and streamed.<br />
Resumability for uploaded files.<br />
Cancelation for downloading file.<br />
Handle Browser refresh and cancel downloading file.<br />

Using Socket.io for real time streaming.<br />
NodeJS as backend using fs to r/w files in proper way.<br />
Angular as Frontend is using StreamSaver to instruct client browser to write Blob chunks directly on client OS.<br />

### If file uploading interrupted, next time when we upload the same file it will continue uploading from where it left.

## Application UI Example:

### Upload

<img src="./docs/upload.png" width="40%"/>

### Download

<img src="./docs/download.png" width="40%"/>

### Interuption due browser refresh or cancel button clicked

<img src="./docs/cancel.png" width="40%"/>
<br />
<img src="./docs/page_refreshed.png" width="40%"/>

# Run Backend

Install dependencies

```shell
yarn install
```

Run app:

```shell
npx ts-node server/src/server.ts
```

Exposed on port: 3300 (Change LISTEN_PORT in server.ts)

# Run Frontend

cd client/

Install dependencies

```shell
yarn install
```

Run app:

```shell
yarn start
```

Application is listening on

```
http://localhost:4200/
```

# Configurations - global.conf.ts

```ts
// Port to be used in the backend to expose the application.
export const BACKEND_LISTEN_PORT = 3300;

// SocketIO origin URL
export const BACKEND_SOCKETIO_ORIGIN = "http://localhost:4200";

// SocketIO URL that also depends on BACKEND_LISTEN_PORT
export const FRONTEND_SOCKETIO_URL = `http://localhost:${BACKEND_LISTEN_PORT}`;

// This is createReadStream highWaterMark size.
export const RW_CHUNK_SIZE = 8 * 1024 * 100; // 500kb;

// How much of the file we want to read, which defines startingRange for R/W.
export const RW_BUFFER_GET_SIZE = 8 * 1024 * 100; // 500kb

// Stream file here, once all content is ready copy to data Folder.
export const STREAM_FOLDER = "./server/data_stream";

// Directory to save files to
export const DATA_FOLDER = "./server/data";
```
