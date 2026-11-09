// Catches anything a controller didn't handle itself.
// Express 5 forwards errors thrown in async handlers here automatically.
const notFound = (req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
};

const errorHandler = (err, req, res, next) => {
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }

  // Schema validation failed (e.g. a required field is missing)
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // A value could not be converted to the schema type (e.g. price: "abc")
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}: ${err.value}` });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
};

module.exports = { notFound, errorHandler };
