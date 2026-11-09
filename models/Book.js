const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
    },
    genre: {
      type: String,
      required: [true, 'Book genre is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Book price is required'],
    },
    publishedYear: {
      type: Number,
      required: [true, 'Published year is required'],
    },
    // The link to the Author collection - lets us populate full author details
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author',
      required: [true, 'Author id is required'],
    },
  },
  { timestamps: true }
);

// Safety net for rule 2: if two identical requests arrive at the same moment,
// both could pass the controller check. This unique, case-insensitive index
// makes the database reject the second one.
bookSchema.index(
  { author: 1, title: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('Book', bookSchema);
