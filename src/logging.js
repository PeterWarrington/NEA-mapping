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

        this.log(message);
    }

    /**
     * Generates a log stamp that is added at the beginning of log messages, to indicate project name and timestamp
     * @param {bool} logError Optional flag, if true, adds a note to log stamps to indicate that only console logging is being used.
     * @returns {string} A log stamp that is added at the beginning of log messages
     */
    generateLogStamp = () => `[${consts.projectName}, ${Date.now()}]`;

    /**
     * Used to write a log message to console and file.
     * @param {string} message Message to write to log
     */
    log(message) {
        var stampedMessage = `${this.generateLogStamp()} ${message}`;

        console.log(stampedMessage);

        fs.appendFile(this.logfile, stampedMessage + "\n", err => {
            if (err) console.log("Logging error: " + err.name);
        });
    }
}