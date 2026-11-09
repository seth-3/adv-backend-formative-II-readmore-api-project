const Book = require('../models/Book');
const isValidId = require('../utils/validateId');

const AUTHOR_FIELDS = 'name country bio';

const bookNotFound = (res, id) =>
  res.status(404).json({ message: `No book found with id ${id}` });

// POST /books
const createBook = async (req, res) => {
  const { title, genre, price, publishedYear, author } = req.body;
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
