import fs from "fs-extra";
import * as path from "path";
import * as conf from "../../../../global.conf";
import { Logger } from "../../logger";

const logger = new Logger();

// Keep files data in memory until we RW them.
let files: any = {};
let fileDownloadReadStream: fs.ReadStream;

// Ensure we have dirs before start upload/download operation.
fs.ensureDirSync(conf.DATA_FOLDER);
fs.ensureDirSync(conf.STREAM_FOLDER);

export function fileUploadController(socket: {
	id?: any;
	on?: any;
	emit?: any;
}) {
	socket.on("disconnect", () => {
		logger.info("user disconnected");
	});

	socket.on("fileInit", (data: { [x: string]: any }) => {
		logger.info("Socket.IO on #fileInit");

		let fileName = data["fileName"];

		files[fileName] = {
			fileSize: data["size"],
			data: "",
			downloaded: 0,
			handler: null,
		};

		let startingRange = 0;

		let stats: fs.Stats | undefined = undefined;
		try {
			// Check if the file that we upload exist under STREAM_FOLDER/
			stats = fs.statSync(`${conf.STREAM_FOLDER}/` + fileName);
			if (stats && stats.isFile()) {
				logger.info(`Continue uploading the file from last state`);
				files[fileName]["downloaded"] = stats.size;
				// startingRange = stats.size / conf.RW_BUFFER_GET_SIZE;
				startingRange = stats.size;
			}
		} catch {
			// File was found under data_stream directory.
			// It's a new file.
			logger.info(`Uploading a new file`);
			logger.info(
				`Check and delete existing stream for '${fileName}' file.`
			);
		}

		// Store the file handler so we can write to it later
		// Open file to append. File is created if it doesn’t exists.
		fs.open(
			`${conf.STREAM_FOLDER}/` + fileName,
			"a",
			"0755",
			(err: any, fd: number) => {
				if (err) {
					logger.error(err);
					throw new Error(err);
				}
				logger.info(
					`Store the file handler so we can write to it later`
				);
				files[fileName]["handler"] = fd;

				logger.info(`File data: ${JSON.stringify(files)}`);

				socket.emit("fileDataGet", {
					startingRange: startingRange,
					percent: 0,
				});
			}
		);
	});

	socket.on("fileDownloadInit", (data: any) => {});

	socket.on("fileDownload", (data: any) => {
		let fileName = data["fileName"];

		let receivedBytes: number = 0;
		let getPercentage: number = 0;

		// Check if file exists before download it.
		const fileExists = fs.existsSync(`./${conf.DATA_FOLDER}/` + fileName);
		if (!fileExists) {
			logger.error(`File not found: ${fileName}`);
			socket.emit("fileError", { message: "File not found!" });
			return;
		}

		const stats = fs.statSync(`./${conf.DATA_FOLDER}/` + fileName);
		const fileSizeInBytes: number = stats.size;

		files[fileName] = {
			fileSize: fileSizeInBytes,
			data: "",
			downloaded: 0,
		};

		fileDownloadReadStream = fs.createReadStream(
			`./${conf.DATA_FOLDER}/` + fileName,
			{
				highWaterMark: conf.RW_CHUNK_SIZE,
			}
		);

		fileDownloadReadStream
			.on("data", function (chunk: Buffer) {
				logger.info(`Total data sent: ${bytesToSize(receivedBytes)}`);

				// Calling pause method
				fileDownloadReadStream.pause();

				receivedBytes += chunk.length;

				let getCurrentPercentage: number =
					(100 * receivedBytes) / fileSizeInBytes;

				if (getPercentage !== getCurrentPercentage) {
					getPercentage = getCurrentPercentage;

					socket.emit("fileProgress", {
						percentage: getPercentage,
						bufferData: chunk,
					});
				}

				// Using some small timeout for proper communication and W/R operations.
				setTimeout(() => {
					fileDownloadReadStream.resume();
				}, 200);
			})
			.on("end", function () {
				logger.info(`Finished 100%. Bytes sent: ${receivedBytes}`);

				socket.emit("fileDownloaded", {
					percentage: 100,
				});
			})
			.on("error", function (error) {
				logger.info(
					`Failed to send the file due to error: ${JSON.stringify(
						error
					)}`
				);

				socket.emit("fileError", { error });
			});
	});

	socket.on("abortFileDownloading", () => {
		if (fileDownloadReadStream && !fileDownloadReadStream.destroyed) {
			logger.debug("Abort Signal sent from UI.");

			fileDownloadReadStream.destroy({
				name: "abort",
				message:
					"Download interupted due to aborted signal sent from the UI or network connectivity issue.",
			});

			socket.emit("abortFileDownloadingStatus", {
				abortStatus: true,
			});

			return;
		}
		socket.emit("abortFileDownloadingStatus", { abortStatus: false });
	});

	socket.on("fileUpload", async (data: any) => {
		logger.info("#fileUpload ---> ");
		let fileName = data["fileName"];
		files[fileName]["downloaded"] += data["data"].length;
		logger.info(data["data"].length);

		//If File is Fully Stream at data_stream, go and write it to data folder.
		if (files[fileName]["downloaded"] === files[fileName]["fileSize"]) {
			await writeChunkData(files[fileName]["handler"], data["data"]);

			fs.close(files[fileName]["handler"]);

			logger.info(`DATA: ${JSON.stringify(files[fileName])}`);

			await moveStreamedFile(
				path.join(conf.STREAM_FOLDER, fileName),
				path.join(conf.DATA_FOLDER, fileName)
			);

			files[fileName] = null;

			socket.emit("fileDone", {
				uploadedFiles: getFilesStat(),
			});
		} else {
			logger.info(`Writting to handler: ${files[fileName]["handler"]}`);
			await writeChunkData(files[fileName]["handler"], data["data"]);

			let percent =
				(files[fileName]["downloaded"] / files[fileName]["fileSize"]) *
				100;

			socket.emit("fileDataGet", {
				startingRange: files[fileName]["downloaded"],
				percent: percent,
			});
		}
	});

	socket.emit("uploadedFiles", {
		uploadedFiles: getFilesStat(),
	});
}

async function writeChunkData(fd: number, data: Buffer) {
	return new Promise((resolve, reject) => {
		fs.write(fd, data, (err: any, writen: any) => {
			if (err)
				return reject(
					`Error in #writeChunkData. ${JSON.stringify(err)}`
				);
			logger.info(`Written Bytes: ${writen}`);
			resolve("resolve");
		});
	});
}

async function moveStreamedFile(src: string, des: string) {
	logger.info("Moving streamed file to the data folder...");
	try {
		await fs.move(src, des);
		logger.info("Moving file ready!");
	} catch (err) {
		logger.error(`Moving file error: ${JSON.stringify(err)}`);
	}
}

function getFilesStat() {
	const uploadedFiles: { name: string; size: number }[] = [];
	const filesInDataFolder = fs.readdirSync(conf.DATA_FOLDER);
	filesInDataFolder.forEach((f) =>
		uploadedFiles.push({
			name: f,
			size: fs.statSync(path.join(conf.DATA_FOLDER, f)).size,
		})
	);
	return uploadedFiles;
}

function bytesToSize(bytes: any) {
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	if (bytes === 0) return "0";
	const i: number = Math.floor(Math.log(bytes) / Math.log(1024));
	if (i === 0) return `${bytes} ${sizes[i]})`;
	return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}
