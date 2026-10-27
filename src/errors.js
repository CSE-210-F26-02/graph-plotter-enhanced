/**
 * Custom error classes for specific error scenarios in the application.
 * Each class extends the built-in Error class and provides a unique name for identification.
 */

/**
 * Represents an error that occurs when an invalid file is encountered.
 */
class InvalidFileError extends Error {
    constructor(message) {
        super(message)
        this.name = 'InvalidFileError'
    }
}

/**
 * Represents an error that occurs when no data is found.
 */
class NoDataFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = 'NoDataFoundError'
    }
}

/**
 * Represents an error that occurs when there are not enough columns in the data.
 */
class NotEnoughColumnsError extends Error {
    constructor(message) {
        super(message)
        this.name = 'NotEnoughColumnsError'
    }
}

/**
 * Represents an error that occurs when an invalid file type is encountered.
 */
class InvalidFileTypeError extends Error {
    constructor(message) {
        super(message)
        this.name = 'InvalidFileTypeError'
    }
}

/**
 * Represents an error that occurs when a malformed CSV is encountered.
 */
class MalformedCSVError extends Error {
    constructor(message) {
        super(message)
        this.name = 'MalformedCSVError'
    }
}

export {
    InvalidFileError,
    MalformedCSVError,
    NoDataFoundError,
    NotEnoughColumnsError,
    InvalidFileTypeError,
}
