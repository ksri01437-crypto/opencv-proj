# ✋ HAND + EYE GESTURE PLATFORM
## Game Mode & Real Laptop Computer Mouse Control

A full-stack computer vision web platform powered by **Python, OpenCV, MediaPipe, FastAPI, WebSockets, HTML5 Canvas, and PyAutoGUI**.

The platform features **TWO SEPARATE, FULLY INDEPENDENT MODES**:
1. **🎮 GESTURE FRUIT GAME (`/game`)**: Pure browser-based fruit slicing game. 100% isolated inside browser canvas (Zero PyAutoGUI or OS mouse interaction). Features slow floaty fruit physics, progressive difficulty levels, and floating camera preview in the **BOTTOM-RIGHT CORNER**.
2. **🖱️ REAL COMPUTER MOUSE CONTROL (`/mouse`)**: Direct laptop OS cursor control using PyAutoGUI. Move real OS mouse with index finger, execute real OS left clicks (left eye wink), right clicks (right eye wink), drag & drop (pinch), and scroll.

---

## 🚀 Features

- **Landing Page (`/`)**: Modern UI to choose between Game Mode and Mouse Control Mode.
- **MediaPipe Hand Tracking**: Index fingertip tracking with exponential moving average coordinate smoothing.
- **Swipe Velocity Slicing**: 200ms position history buffer detecting swipe direction, speed, and path intersection.
- **Eye Aspect Ratio (EAR) Tracker**: Calculates eye closure independently for left and right eyes.
- **Blink vs. Intentional Gesture Filtering**: Short blinks (<180ms) are ignored; intentional winks (≥280ms) trigger clicks; both eyes closed (≥450ms) triggers pause or toggle.
- **Delta-Time Physics**: Smooth fruit motion (`position += velocity * dt`) taking 2.0 to 3.5 seconds to cross the screen.
- **Web Audio API Synthesizer**: Procedural sound effects for swipes, juice splashes, bomb explosions, combo fanfares, and button clicks.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, FastAPI, OpenCV, MediaPipe, PyAutoGUI, NumPy, WebSockets, Uvicorn
- **Frontend**: HTML5 Canvas, CSS3 Glassmorphism, JavaScript ES6+, Web Audio API

---

## 🏁 Quick Start Guide

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the FastAPI Application Server

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### 3. Open in Browser

Open your browser and navigate to:
```text
http://localhost:8000
```

---

## 🎮 Mode 1 — Gesture Fruit Game (`/game`)

- **Aim**: Point index finger at camera to move glowing cursor.
- **Slice**: Fast hand swipe across fruits.
- **Left Eye Wink (≥280ms)**: Left Click / Select buttons.
- **Right Eye Wink (≥280ms)**: Special Action.
- **Both Eyes Closed (≥450ms) or Fist (✊)**: Pause Game.
- **Camera Preview**: Positioned in **BOTTOM-RIGHT CORNER**.

---

## 🖱️ Mode 2 — Real Computer Mouse Control (`/mouse`)

- **Move OS Cursor**: Point index finger at camera to move laptop OS mouse.
- **Real OS Left Click**: Close left eye (wink ≥280ms).
- **Real OS Right Click**: Close right eye (wink ≥280ms).
- **Pinch Finger**: Hold left mouse down for Drag & Drop.
- **Both Eyes Closed**: Toggle Mouse Control ON/OFF.

---

## ⚙️ Configuration (`config.py`)

All gesture thresholds and fruit velocity constants can be customized in `config.py`:
- `MIN_SWIPE_DISTANCE = 0.07`
- `MIN_SWIPE_SPEED = 0.95`
- `EAR_THRESHOLD = 0.20`
- `WINK_TRIGGER_MS = 280`
- `MOUSE_SMOOTHING_FACTOR = 0.25`
- `LEVEL_1_SPEED_MULT = 0.50`
