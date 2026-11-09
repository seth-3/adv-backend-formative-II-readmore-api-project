const Book = require('../models/Book');
const Author = require('../models/Author');
const isValidId = require('../utils/validateId');

const AUTHOR_FIELDS = 'name country bio';
const EARLIEST_YEAR = 1450; // roughly when the printing press arrived

const bookNotFound = (res, id) =>
  res.status(404).json({ message: `No book found with id ${id}` });

// Rule 1 - No orphan books.
// `required` on the schema only checks that *some* value is present; it never
// looks in the authors collection, so a made-up id would still be saved.
// We have to check that the author actually exists.
const authorExists = async (authorId) =>
  isValidId(String(authorId)) && (await Author.exists({ _id: authorId })) !== null;

// Rule 3 - Rules the schema can't express.
// Returns a list of problems; an empty list means the values are fine.
// Only checks fields that are present - missing required fields are left to the schema.
const checkPriceAndYear = ({ price, publishedYear }) => {
  const problems = [];
  const currentYear = new Date().getFullYear();

  if (price !== undefined) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) {
      problems.push('price must be a number greater than 0');
    }
  }

  if (publishedYear !== undefined) {
    const year = Number(publishedYear);
    if (!Number.isInteger(year)) {
      problems.push('publishedYear must be a whole number');
    } else if (year > currentYear) {
      problems.push(`publishedYear cannot be in the future (after ${currentYear})`);
    } else if (year < EARLIEST_YEAR) {
      problems.push(`publishedYear cannot be before ${EARLIEST_YEAR}`);
    }
  }

  return problems;
};

// Runs the business rules against the book as it will look once saved.
// Returns { status, body } when a rule is broken, or null when everything passes.
const checkBookRules = async (book) => {
  if (book.author === undefined || book.author === null || book.author === '') {
    return { status: 400, body: { message: 'author is required' } };
  }
  if (!(await authorExists(book.author))) {
    return { status: 400, body: { message: `Author with id ${book.author} does not exist` } };
  }

  const problems = checkPriceAndYear(book);
  if (problems.length > 0) {
    return { status: 422, body: { message: 'Invalid book data', errors: problems } };
  }

  return null;
};

// POST /books
const createBook = async (req, res) => {
  const { title, genre, price, publishedYear, author } = req.body;
  const data = { title, genre, price, publishedYear, author };

  const broken = await checkBookRules(data);
  if (broken) return res.status(broken.status).json(broken.body);

  const book = await Book.create(data);
  await book.populate('author', AUTHOR_FIELDS);
  res.status(201).json(book);
};

// GET /books
const getBooks = async (req, res) => {
  const books = await Book.find().populate('author', AUTHOR_FIELDS);
  res.json(books);
};

// GET /books/:id
const getBookById = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return bookNotFound(res, id);

  const book = await Book.findById(id).populate('author', AUTHOR_FIELDS);
  if (!book) return bookNotFound(res, id);

  res.json(book);
};

// PUT /books/:id
const updateBook = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return bookNotFound(res, id);

  const book = await Book.findById(id);
  if (!book) return bookNotFound(res, id);

  // Only take the fields the client actually sent
  const changes = {};
  for (const field of ['title', 'genre', 'price', 'publishedYear', 'author']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }

  // Check the rules against the merged result, not just the changed fields
  const merged = {
    title: changes.title ?? book.title,
    author: changes.author ?? String(book.author),
    price: changes.price,
    publishedYear: changes.publishedYear,
  };
  const broken = await checkBookRules(merged);
  if (broken) return res.status(broken.status).json(broken.body);

  book.set(changes);
  await book.save(); // save() runs the schema validators
  await book.populate('author', AUTHOR_FIELDS);
  res.json(book);
};

// DELETE /books/:id
const deleteBook = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return bookNotFound(res, id);

  const book = await Book.findByIdAndDelete(id);
  if (!book) return bookNotFound(res, id);

  res.json({ message: `Book "${book.title}" deleted` });
};

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
};
