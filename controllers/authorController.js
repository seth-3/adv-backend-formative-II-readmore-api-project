const Author = require('../models/Author');
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
const deleteAuthor = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return authorNotFound(res, id);

  const author = await Author.findByIdAndDelete(id);
  if (!author) return authorNotFound(res, id);

  res.json({ message: `Author "${author.name}" deleted` });
};

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
};
