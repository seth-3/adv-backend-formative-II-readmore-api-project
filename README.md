# ReadMore API

A REST API for a bookstore built with **Express.js**, **MongoDB** and **Mongoose**.
It manages two linked entities, **Authors** and **Books** (one author → many books), and enforces the business rules from Part 4 of the assignment.

---

## Getting started

```bash
npm install
cp .env.example .env      # then put your own MongoDB connection string in .env
npm run dev               # or: npm start
```

`.env`

```
MONGO_URI=mongodb://127.0.0.1:27017/readmore   # or your MongoDB Atlas string
PORT=3000
```

The server only starts listening once the MongoDB connection succeeds. If it fails, the error is logged and the process exits.

`requests.http` has a ready-made request for every endpoint and rule (VS Code **REST Client** extension).

---

## Project structure

```
├── server.js                  entry point: load .env, connect to MongoDB, then listen
├── app.js                     Express app: JSON parsing, routes, error handling
├── config/db.js               Mongoose connection
├── models/
│   ├── Author.js              name (required), country, bio
│   └── Book.js                title, genre, price, publishedYear, author → Author (all required)
├── controllers/
│   ├── authorController.js    author CRUD, /books, /stats, delete policy
│   └── bookController.js      book CRUD, rules 1–3, dynamic filter, pagination
├── routes/
│   ├── authorRoutes.js        URL → controller wiring only
│   └── bookRoutes.js
├── middleware/errorHandler.js 404 for unknown routes + central error responses
└── utils/validateId.js        checks a string is a valid ObjectId
```

Routes only map URLs to controller functions. The controllers read the request, apply the rules, talk to the database and choose the status code. Express 5 forwards errors from `async` controllers to the central error handler, so there is no `try/catch` repeated in every function.

---

## Endpoints

### Authors

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| POST   | `/authors`            | Create an author                         |
| GET    | `/authors`            | List all authors                         |
| GET    | `/authors/:id`        | Get one author                           |
| PUT    | `/authors/:id`        | Update an author                         |
| DELETE | `/authors/:id`        | Delete an author (blocked if they have books) |
| GET    | `/authors/:id/books`  | All books by this author                 |
| GET    | `/authors/:id/stats`  | Book count, average price, cheapest / most expensive book |

### Books

| Method | Path          | Description                                    |
|--------|---------------|------------------------------------------------|
| POST   | `/books`      | Create a book for an existing author           |
| GET    | `/books`      | List books, with filters, sorting and pagination |
| GET    | `/books/:id`  | Get one book                                   |
| PUT    | `/books/:id`  | Update a book (send only the fields to change) |
| DELETE | `/books/:id`  | Delete a book                                  |

`GET /books` and `GET /books/:id` return the **full author details** using Mongoose `populate`.

An id that doesn't match any document, including a malformed id, returns **404**.

---

## Status codes

| Code | When |
|------|------|
| 200 / 201 | Success / created |
| 400 | Missing required field, malformed JSON, invalid query param, or **author id that doesn't exist** (rule 1) |
| 404 | Author / book / route not found |
| 409 | **Duplicate title for the same author** (rule 2) or **deleting an author who still has books** (rule 4) |
| 422 | **Price ≤ 0, or publishedYear in the future or before 1450** (rule 3) |
| 500 | Unexpected server error |

---

## Part 4 — Business rules and design decisions

### 1. No orphan books → 400
`required: true` on `author` only checks that *a value* was sent. MongoDB does not check that the id points to a real document, so `"000000000000000000000000"` would be saved happily. The controller looks the author up with `Author.exists()` before creating or updating a book, and rejects with 400 if it's missing.

### 2. No duplicate titles per author → 409
Before saving, the controller searches for a book with **the same author and the same title**, using a collation (`strength: 2`) so the comparison ignores case. `"the silent sea"` and `"The Silent Sea"` clash, but two *different* authors may both have a book called `"Home"`. On update, the book being edited is excluded so it doesn't clash with itself.

As a safety net, `Book` also has a **unique, case-insensitive compound index** on `{ author, title }`. If two identical requests arrive at the same moment and both pass the controller check, the database rejects the second, and the error handler turns that into a 409.

### 3. Price and year → 422
The schema can say "price is a number", but not "price is greater than 0" or "the year is not in the future". The controller rejects:
- `price` that is not a number or is `<= 0`
- `publishedYear` that is not a whole number, is after the current year, or is before 1450

All problems are returned together in an `errors` array. On updates, the rules run against the **merged** book (existing values + changes), so a partial update can't sneak past them.

### 4. Deleting an author who still has books — **Option A: block (409)**

`DELETE /authors/:id` counts the author's books. If there are any, it returns **409** with the count and tells the client to delete or reassign them first. An author with no books is deleted normally.

**Why block:**
- **No silent data loss.** Cascade (B) would delete a whole catalogue with one request. In a real store those books may already have been sold and appear in orders, invoices and reviews. Losing them breaks that history and can't be undone.
- **No made-up data.** Reassign (C) would credit books to a fake "Unknown Author", which is wrong for customers and for royalties.
- **The decision stays with a person.** The API makes the client handle the books on purpose, then delete the author. Every other option guesses what the user wanted.

**Downside:** it's less convenient. Removing an author with 40 books takes 41 requests, and an author who left the store can't be removed while their books are still listed. A real system would probably go further with a *soft delete* (an `active: false` flag) so the author is hidden but sales history stays intact.

### 5. Search & filter on `GET /books`
`buildBookQuery()` starts from an **empty filter `{}`** and adds a condition only for each parameter that is present:

| Query | Resulting filter |
|-------|------------------|
| *(none)* | `{}`, all books |
| `?genre=Thriller` | `{ genre: /^Thriller$/i }` |
| `?minPrice=10` | `{ price: { $gte: 10 } }` |
| `?minPrice=10&maxPrice=30` | `{ price: { $gte: 10, $lte: 30 } }` |
| `?search=sea` | `{ title: /sea/i }` |
| `?author=<id>` | `{ author: <id> }` |

`sort` accepts `price`, `title` or `publishedYear`. `order` is `asc` (default) or `desc`. Invalid values (non-numeric price, unknown sort field, bad author id) return **400** instead of being silently ignored. Search text is regex-escaped, so input like `(.*` is treated as plain text.

### 6. Author statistics
`GET /authors/:id/stats` returns `bookCount`, `averagePrice` (rounded to 2 decimal places), `cheapestBook` and `mostExpensiveBook`.

**No books:** the response is `bookCount: 0` with `averagePrice`, `cheapestBook` and `mostExpensiveBook` set to `null`. `null` means "there is no value". `0` would look like a real price of zero, which rule 3 says is impossible.

### Challenge — pagination
`GET /books?page=2&limit=10` works together with all the filters and returns:

```json
{ "page": 2, "limit": 10, "total": 23, "totalPages": 3, "results": [ ... ] }
```

Without `limit`, every matching book is returned on page 1, so "no params = everything" still holds. Results are always sorted with `_id` as a tie-breaker, so the same book never appears on two pages.
