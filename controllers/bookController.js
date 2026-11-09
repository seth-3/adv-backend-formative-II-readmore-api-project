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

// Rule 2 - No duplicate titles per author (case-insensitive).
// The check is scoped to one author, so two different authors can both have "Home".
// A collation with strength 2 makes the comparison ignore upper/lower case.
// excludeId lets an update keep its own title without clashing with itself.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const isDuplicateTitle = async ({ title, author }, excludeId) => {
  const filter = { author, title: String(title).trim() };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Book.findOne(filter).collation(CASE_INSENSITIVE);
  return existing !== null;
};

// Runs the business rules against the book as it will look once saved.
// Returns { status, body } when a rule is broken, or null when everything passes.
const checkBookRules = async (book, excludeId) => {
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

  if (book.title && (await isDuplicateTitle(book, excludeId))) {
    return {
      status: 409,
      body: { message: `This author already has a book titled "${String(book.title).trim()}"` },
    };
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

// Escape characters that have a special meaning in regular expressions,
// so a search like "c++" is treated as plain text
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];

// Rule 5 - Build the filter dynamically.
// Start from an empty filter and add a condition only for each query param that
// is actually present. No params -> {} -> every book.
// Returns { filter, sort } or { error } if a param is invalid.
const buildBookQuery = (query) => {
  const { genre, minPrice, maxPrice, author, search, sort, order } = query;
  const filter = {};

  if (genre) {
    filter.genre = new RegExp(`^${escapeRegex(String(genre))}$`, 'i');
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      if (!Number.isFinite(Number(minPrice))) return { error: 'minPrice must be a number' };
      filter.price.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      if (!Number.isFinite(Number(maxPrice))) return { error: 'maxPrice must be a number' };
      filter.price.$lte = Number(maxPrice);
    }
  }

  if (author) {
    if (!isValidId(author)) return { error: 'author must be a valid author id' };
    filter.author = author;
  }

  if (search) {
    filter.title = new RegExp(escapeRegex(String(search)), 'i');
  }

  let sortBy;
  if (sort) {
    if (!SORTABLE_FIELDS.includes(sort)) {
      return { error: `sort must be one of: ${SORTABLE_FIELDS.join(', ')}` };
    }
    const direction = String(order || 'asc').toLowerCase();
    if (!['asc', 'desc'].includes(direction)) return { error: 'order must be asc or desc' };
    sortBy = { [sort]: direction === 'asc' ? 1 : -1 };
  }

  return { filter, sort: sortBy };
};

// Challenge - pagination.
// page and limit are optional. Without a limit every matching book is returned
// on a single page, so the "no params = everything" behaviour still holds.
const parsePagination = ({ page, limit }) => {
  const pageNumber = page === undefined ? 1 : Number(page);
  const limitNumber = limit === undefined ? null : Number(limit);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return { error: 'page must be a whole number of 1 or more' };
  }
  if (limitNumber !== null && (!Number.isInteger(limitNumber) || limitNumber < 1)) {
    return { error: 'limit must be a whole number of 1 or more' };
  }
  return { page: pageNumber, limit: limitNumber };
};

// GET /books?genre=&minPrice=&maxPrice=&author=&search=&sort=&order=&page=&limit=
const getBooks = async (req, res) => {
  const { filter, sort, error } = buildBookQuery(req.query);
  if (error) return res.status(400).json({ message: error });

  const pagination = parsePagination(req.query);
  if (pagination.error) return res.status(400).json({ message: pagination.error });
  const { page } = pagination;

  const total = await Book.countDocuments(filter);
  const limit = pagination.limit ?? total;

  // _id as a tie-breaker keeps the order stable between pages
  let query = Book.find(filter)
    .sort({ ...sort, _id: 1 })
    .populate('author', AUTHOR_FIELDS);
  if (pagination.limit !== null) {
    query = query.skip((page - 1) * limit).limit(limit);
  }

  const results = await query;
  res.json({
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    results,
  });
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
  const broken = await checkBookRules(merged, book._id);
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
