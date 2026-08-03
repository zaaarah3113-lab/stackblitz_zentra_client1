const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);

async function getSetting(key, defaultValue = null) {
  const doc = await Setting.findOne({ key });
  return doc ? doc.value : defaultValue;
}

async function setSetting(key, value) {
  return Setting.findOneAndUpdate(
    { key },
    { value },
    { new: true, upsert: true, runValidators: true }
  );
}

module.exports = { Setting, getSetting, setSetting };
