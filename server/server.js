const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/opencv_gesture_game';

app.use(cors());
app.use(express.json());

// In-Memory Fallback Storage if MongoDB is offline
let inMemoryScores = [
  { _id: '1', username: 'CyberAce', score: 1250, enemiesShot: 10, totalEnemies: 10, accuracy: 92, durationSeconds: 24, createdAt: new Date() },
  { _id: '2', username: 'GazeSniper', score: 1100, enemiesShot: 10, totalEnemies: 10, accuracy: 85, durationSeconds: 29, createdAt: new Date() },
  { _id: '3', username: 'VisionHawk', score: 980, enemiesShot: 9, totalEnemies: 10, accuracy: 80, durationSeconds: 32, createdAt: new Date() },
  { _id: '4', username: 'HandCommander', score: 850, enemiesShot: 8, totalEnemies: 10, accuracy: 75, durationSeconds: 38, createdAt: new Date() }
];

let isDbConnected = false;

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 2000
}).then(() => {
  isDbConnected = true;
  console.log(' Successfully connected to MongoDB database!');
}).catch((err) => {
  isDbConnected = false;
  console.log(' Notice: MongoDB connection timed out or unavailable. Using high-performance In-Memory database mode.');
});

const Score = require('./models/Score');

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    dbStatus: isDbConnected ? 'MongoDB Connected' : 'In-Memory Fallback Active',
    timestamp: new Date()
  });
});

// GET Leaderboard (Top 10 High Scores)
app.get('/api/scores/leaderboard', async (req, res) => {
  try {
    if (isDbConnected) {
      const scores = await Score.find()
        .sort({ score: -1, enemiesShot: -1, durationSeconds: 1 })
        .limit(10);
      return res.json({ success: true, source: 'MongoDB', data: scores });
    } else {
      const sorted = [...inMemoryScores].sort((a, b) => b.score - a.score || b.enemiesShot - a.enemiesShot);
      return res.json({ success: true, source: 'InMemory', data: sorted.slice(0, 10) });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST Submit New Game Score
app.post('/api/scores', async (req, res) => {
  try {
    const { username, score, enemiesShot, totalEnemies, accuracy, durationSeconds } = req.body;

    if (enemiesShot === undefined || score === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required score fields' });
    }

    const scoreData = {
      username: username && username.trim() ? username.trim() : 'CyberHunter',
      score: Number(score),
      enemiesShot: Number(enemiesShot),
      totalEnemies: Number(totalEnemies) || 10,
      accuracy: Number(accuracy) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      createdAt: new Date()
    };

    if (isDbConnected) {
      const newScore = new Score(scoreData);
      await newScore.save();
      return res.status(201).json({ success: true, source: 'MongoDB', data: newScore });
    } else {
      const newMemoryEntry = { _id: Date.now().toString(), ...scoreData };
      inMemoryScores.push(newMemoryEntry);
      return res.status(201).json({ success: true, source: 'InMemory', data: newMemoryEntry });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(` OpenCV Gesture Gaming MERN Express Server running on http://localhost:${PORT}`);
});
