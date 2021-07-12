const fs = require('fs');
const consts = require('./consts.js')

/**
 * Logger class, instanciated once to provide logging functionality
 */
module.exports.Logger = class Logger {
    /**
     * Logfile location
     */
    logfile

    /**
     * Instanciates the logger, creating a log file if it does not exist
     */
    constructor() {
        this.logfile = `logs/map-${Date.now()}.log`;
        var message = `Logger has started.`;

        // Create 'logs' folder if it doesn't exist
        if (!fs.existsSync('logs')){
            fs.mkdirSync('logs');
        }

        this.log(message, (result, message="[None]") => {
            if (result == consts.ERROR) console.log(`${this.generateLogStamp(consts.CONSOLE_LOGGING_ONLY)} Unable to write to log file. Using console logging only. ` +
                `Error detail:\n\t ${message}`);
        });
    }

    /**
     * Generates a log stamp that is added at the beginning of log messages, to indicate project name and timestamp
     * @param {bool} logError Optional flag, if true, adds a note to log stamps to indicate that only console logging is being used.
     * @returns {string} A log stamp that is added at the beginning of log messages
     */
    generateLogStamp = (logError=false) => {
        if (logError)
            return `[${consts.projectName}, CONSOLE LOGGING ONLY, ${Date.now()}]`;
        return `[${consts.projectName}, ${Date.now()}]`;
    }
    /**
     * Default callback for Logger.log.
     * @param {int} result One of consts.ERROR or consts.OK used to indicate logging success
     * @param {string} message The optional error or message passed from log.
     */
    #defaultLogCallback = (result, message="[Unknown]") => {
        if (result == consts.ERROR)
            console.log(`${this.generateLogStamp(consts.CONSOLE_LOGGING_ONLY)} ${message}`);
    }
    /**
     * Used to write a log message to console and file.
     * @param {string} message Message to write to log
     * @param {function(result, message)} callback Optional callback on log completion
     */
    log(message, callback=this.#defaultLogCallback) {
        var stampedMessage = `${this.generateLogStamp()} ${message}`;

        fs.appendFile(this.logfile, stampedMessage, err => {
            if (err) {
                callback(consts.ERROR, err);
            } else {
                callback(consts.OK, message);
                console.log(stampedMessage);
            }
        });
    }
}