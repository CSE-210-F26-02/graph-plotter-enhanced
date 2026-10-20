class InvalidFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidFileError';
  }
}

class MalformedCSVError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MalformedCSVError';
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

export { InvalidFileError, MalformedCSVError, NoDataFoundError, NotEnoughColumnsError, InvalidFileTypeError };