let log4js = require("log4js")

const path = "../logs"
const conf = {
    appenders: {
        console: { type: 'console' },
        file: {
            type: 'dateFile',
            filename: `${path}/leave_back.log`,
            pattern: '.yyyy-MM-dd',
            keepFileExt: true,
            layout: {
                type: 'pattern',
                pattern: '[%d{yyyy-MM-dd hh:mm:ss.SSS}] %m',
            },
        },
    },
    categories: {
        default: { appenders: ['console', 'file'], level: 'debug' },
    },
}

log4js.configure(conf)
let logger = log4js.getLogger()

module.exports = {
    log: (msg, level = "info", req = null) => {
        level = level.toUpperCase()
        
        if (typeof userSession != "undefined" && userSession != null) {
            msg = `(${userSession.id}) - ${msg}`
        }
        if (level == "TRACE") logger.trace(msg)
        else if (level == "INFO") logger.info(msg)
        else if (level == "DEBUG") logger.debug(msg)
        else if (level == "WARN") logger.warn(msg)
        else if (level == "ERROR") logger.error(msg)
        else if (level == "FATAL") logger.fatal(msg)

    },
}