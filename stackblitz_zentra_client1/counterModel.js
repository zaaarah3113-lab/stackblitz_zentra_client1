const mongoose = require('mongoose');

// Generic atomic counter collection. Each document is one named sequence
// (e.g. "orderNumber") with a current value. We use MongoDB's atomic
// findOneAndUpdate + $inc to hand out the next number safely even if two
// orders are created in the exact same millisecond — no two orders can
// ever receive the same number, because the increment happens as a single
// atomic operation at the database level, not in application code.
const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: Number,
    required: true,
    default: 100000, // first order will be value+1 = 100001 -> "MT100001"
  },
});

const Counter = mongoose.model('Counter', counterSchema);

// Returns the next number in the named sequence, creating the counter
// (starting at the default above) if it doesn't exist yet.
async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

module.exports = { Counter, getNextSequence };