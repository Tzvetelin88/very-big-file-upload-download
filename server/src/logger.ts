import fs from "fs-extra";

// Utility to write simple file logger file instead of console.log
export class Logger {
	info(data: any) {
		fs.appendFile("./logger.txt", "[INFO]: " + data + "\n");
	}

	error(data: any) {
		fs.appendFile("./logger.txt", "[ERROR]: " + data + "\n");
	}

	warn(data: any) {
		fs.appendFile("./logger.txt", "[WARN]: " + data + "\n");
	}

	debug(data: any) {
		fs.appendFile("./logger.txt", "[DEBUG]: " + data + "\n");
	}
}
