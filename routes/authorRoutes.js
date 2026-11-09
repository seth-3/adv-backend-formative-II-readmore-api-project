const express = require('express');
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
  getAuthorStats,
} = require('../controllers/authorController');

const router = express.Router();

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthorById).put(updateAuthor).delete(deleteAuthor);
router.get('/:id/books', getAuthorBooks);
router.get('/:id/stats', getAuthorStats);

module.exports = router;
