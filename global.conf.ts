// Port to be used in the backend to expose the application.
export const BACKEND_LISTEN_PORT = 3300;

// SocketIO origin URL
export const BACKEND_SOCKETIO_ORIGIN = "http://localhost:4200";

// SocketIO URL that also depends on BACKEND_LISTEN_PORT
export const FRONTEND_SOCKETIO_URL = `http://localhost:${BACKEND_LISTEN_PORT}`;

// This is createReadStream highWaterMark size.
export const RW_CHUNK_SIZE = 8 * 1024 * 100; // 800kb;

// How much of the file we want to read, which defines startingRange for R/W.
export const RW_BUFFER_GET_SIZE = 8 * 1024 * 100; // 800kb

// Stream file here, once all content is ready copy to data Folder.
export const STREAM_FOLDER = "./server/data_stream";

// Directory to save files to
export const DATA_FOLDER = "./server/data";

// If there is interupption on the file upload, like browser refresh or network interupption
// we can upload the file again, but continue from the place where we stopped if true.
// In case of false, file upload will start from the begging.
