class InvalidFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

class NoDataFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NoDataFoundError';
  }
}

class NotEnoughColumnsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotEnoughColumnsError';
  }
}

class InvalidFileTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileTypeError';
  }
}

export { InvalidFileError, NoDataFoundError, NotEnoughColumnsError, InvalidFileTypeError };