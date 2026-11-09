const mongoose = require('mongoose');

// True only for strings that are valid MongoDB ObjectIds
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;

module.exports = isValidId;
