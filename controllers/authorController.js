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

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
};
