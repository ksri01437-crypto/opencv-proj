const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    default: 'CyberHunter'
  },
  score: {
    type: Number,
    required: true
  },
  enemiesShot: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  totalEnemies: {
    type: Number,
    default: 10
  },
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  durationSeconds: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Score', scoreSchema);
