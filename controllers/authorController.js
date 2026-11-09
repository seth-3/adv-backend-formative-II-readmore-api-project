const Author = require('../models/Author');
const Book = require('../models/Book');
const isValidId = require('../utils/validateId');

const authorNotFound = (res, id) =>
  res.status(404).json({ message: `No author found with id ${id}` });

// POST /authors
const createAuthor = async (req, res) => {
  const { name, country, bio } = req.body;
  const author = await Author.create({ name, country, bio });
  res.status(201).json(author);
};

// GET /authors
const getAuthors = async (req, res) => {
  const authors = await Author.find().sort({ name: 1 });
  res.json(authors);
};

// GET /authors/:id
const getAuthorById = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const author = await Author.findById(id);
  if (!author) return authorNotFound(res, id);

  res.json(author);
};

// PUT /authors/:id
const updateAuthor = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const { name, country, bio } = req.body;
  const author = await Author.findByIdAndUpdate(
    id,
    { name, country, bio },
    { new: true, runValidators: true }
  );
  if (!author) return authorNotFound(res, id);

  res.json(author);
};

// DELETE /authors/:id
// Rule 4 - Policy A: block the delete while the author still has books.
// Nothing is removed silently: the client must deal with the books first
// (delete them or move them to another author), then delete the author.
const deleteAuthor = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const author = await Author.findById(id);
  if (!author) return authorNotFound(res, id);

  const bookCount = await Book.countDocuments({ author: id });
  if (bookCount > 0) {
    return res.status(409).json({
      message: `Cannot delete "${author.name}" because they still have ${bookCount} book(s). Delete or reassign those books first.`,
      bookCount,
    });
  }

  await author.deleteOne();
  res.json({ message: `Author "${author.name}" deleted` });
};

// GET /authors/:id/books
const getAuthorBooks = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const author = await Author.findById(id);
  if (!author) return authorNotFound(res, id);

  const books = await Book.find({ author: id }).sort({ publishedYear: 1 });
  res.json({ author, count: books.length, books });
};

// GET /authors/:id/stats
// Rule 6 - Summary of an author's books.
// With no books there is nothing to average, so bookCount is 0 and the other
// values are null ("no value") rather than 0, which would look like a real price.
const getAuthorStats = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const author = await Author.findById(id);
  if (!author) return authorNotFound(res, id);

  const books = await Book.find({ author: id }).sort({ price: 1, title: 1 });

  if (books.length === 0) {
    return res.json({
      author: author.name,
      bookCount: 0,
      averagePrice: null,
      cheapestBook: null,
      mostExpensiveBook: null,
    });
  }

  const total = books.reduce((sum, book) => sum + book.price, 0);

  res.json({
    author: author.name,
    bookCount: books.length,
    averagePrice: Math.round((total / books.length) * 100) / 100,
    cheapestBook: books[0].title,
    mostExpensiveBook: books[books.length - 1].title,
  });
};

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
  getAuthorStats,
};
