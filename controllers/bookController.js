const Book = require('../models/Book');
const Author = require('../models/Author');
const isValidId = require('../utils/validateId');

const AUTHOR_FIELDS = 'name country bio';

const bookNotFound = (res, id) =>
  res.status(404).json({ message: `No book found with id ${id}` });

// Rule 1 - No orphan books.
// `required` on the schema only checks that *some* value is present; it never
// looks in the authors collection, so a made-up id would still be saved.
// We have to check that the author actually exists.
const authorExists = async (authorId) =>
  isValidId(String(authorId)) && (await Author.exists({ _id: authorId })) !== null;

// POST /books
const createBook = async (req, res) => {
  const { title, genre, price, publishedYear, author } = req.body;

  if (!(await authorExists(author))) {
    return res.status(400).json({ message: `Author with id ${author} does not exist` });
  }
  const book = await Book.create({ title, genre, price, publishedYear, author });
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

  const { title, genre, price, publishedYear, author } = req.body;

  if (author !== undefined && !(await authorExists(author))) {
    return res.status(400).json({ message: `Author with id ${author} does not exist` });
  }

  const book = await Book.findByIdAndUpdate(
    id,
    { title, genre, price, publishedYear, author },
    { new: true, runValidators: true }
  ).populate('author', AUTHOR_FIELDS);
  if (!book) return bookNotFound(res, id);

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
