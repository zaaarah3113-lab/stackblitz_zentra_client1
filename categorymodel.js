const mongoose = require('mongoose');

/**
 * Turn a category name into a stable, URL/attribute-safe slug that matches
 * however the storefront's normalizeCategory() collapses plurals/casing/
 * spacing — e.g. "3-Piece Set" -> "3pieceset", "Hijab" -> "hijab".
 * Kept here (not just on the frontend) so the slug stored in the DB is
 * predictable and unique regardless of how the admin types the name.
 */
function slugifyCategory(name) {
  let s = String(name || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (s.endsWith('ies')) {
    s = s.slice(0, -3) + 'y';
  } else if (s.endsWith('s') && !s.endsWith('ss')) {
    s = s.slice(0, -1);
  }
  return s;
}

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A category must have a name'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function setSlug(next) {
  if (this.name) {
    this.slug = slugifyCategory(this.name);
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
module.exports.slugifyCategory = slugifyCategory;