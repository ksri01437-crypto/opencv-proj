# OpenCV / MediaPipe CyberSniper (MERN Stack Gaming Application)

A full-stack **MERN (MongoDB, Express, React, Node.js)** computer vision web gaming application where players aim using **hand gestures** (index finger pointing) and shoot using **eye gestures** (winking/blinking) to eliminate 10 enemies per game match.

---

## Features

- **Hand Gesture Aiming**: MediaPipe Hands tracks landmark #8 (Index Finger Tip) and translates webcam movement into smooth screen crosshairs.
- **Eye Gesture Shooting**: MediaPipe Face Mesh calculates Eye Aspect Ratio (EAR) for left and right eyes to detect winks/blinks and trigger high-speed laser blasts.
- **10 Enemies Wave System**: Each game session spawns 10 animated target drones with varying movement speeds and points.
- **MERN Stack Leaderboard**: Saves high scores, enemies shot count (0 to 10), accuracy percentage, and time taken to a MongoDB / Express API backend with real-time global leaderboard rendering.
- **Web Audio Sound Synthesizer**: Programmatic arcade laser blasts, explosion booms, and victory fanfares via Web Audio API.

---

## Tech Stack

- **Frontend**: React 18, Vite, Canvas 2D Engine, MediaPipe Hands & Face Mesh, Lucide Icons, Canvas Confetti.
- **Backend**: Node.js, Express.js, Mongoose / MongoDB (with auto In-Memory fallback).

---

## Quick Start Guide

### 1. Install Dependencies

```bash
# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../client
npm install
```

### 2. Start the Express Server & React Frontend

In Terminal 1 (Server):
```bash
cd server
npm start
```
*Server will run on `http://localhost:5000` (Connecting to MongoDB or fallback in-memory store).*

In Terminal 2 (Client):
```bash
cd client
npm run dev
```
*Frontend will open on `http://localhost:3000`.*

---

## How to Play

1. Allow webcam permissions when prompted.
2. **AIM**: Point your index finger at the camera to move the crosshair.
3. **SHOOT**: Wink or close one eye briefly to fire a laser shot.
4. **GOAL**: Eliminate all **10 enemies** to clear the wave and post your score to the global MERN leaderboard!
5. *(Fallback: You can also use Mouse to aim and Click / Spacebar to shoot if camera is unavailable).*
