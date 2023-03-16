import express from "express";
const socket = require("socket.io");

import { fileUploadController } from "./controlers/uploader/uploader.controller";
import { Logger } from "./logger";
import * as conf from "../../global.conf";

const logger = new Logger();

const app = express();
app.use(express.urlencoded({ extended: true }));

const server = app.listen(conf.BACKEND_LISTEN_PORT, () => {
	logger.info(`Started in ${conf.BACKEND_LISTEN_PORT}`);
});

const io = socket(server, {
	allowEIO3: true,
	cors: {
		origin: conf.BACKEND_SOCKETIO_ORIGIN,
		credentials: true,
	},
});

io.sockets.on("connection", (socket: any) => {
	logger.info(`new connection id: ${socket.id}`);

	fileUploadController(socket);
});
