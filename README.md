# ✋ 100% HAND GESTURE PLATFORM
## Game Mode & Real Laptop Computer Mouse Control

A full-stack computer vision web platform powered by **Python, OpenCV, MediaPipe Hands, FastAPI, WebSockets, HTML5 Canvas, and PyAutoGUI**.

The platform is **100% hand-gesture controlled** (no eye winks or facial tracking required):
1. **🎮 GESTURE FRUIT GAME (`/game`)**: Pure browser-based fruit slicing game. 100% isolated inside browser canvas. Aim with index finger, slice with hand movements, click UI buttons with pinches, and pause with a fist.
2. **🏎️ F1 GESTURE RACING (`/cargame`)**: High-speed 3-lane Formula 1 racing game. Steer car left/right or center using hand position. Avoid enemy cars, accelerate up to 360 KM/H with dynamic engine audio and crash physics!
3. **🌸 FLOWER MAGIC CANVAS (`/draw`)**: Black screen gesture drawing canvas! Draw anything (e.g. "hii", shapes, art) with your index finger using blooming flowers & leafy vines. Pick from 10 flower styles (Sakura, Rose, Sunflower, Rainbow), adjust brush size, save PNG artwork, or clear canvas with a fist!
4. **🖱️ REAL COMPUTER MOUSE CONTROL (`/mouse`)**: Direct laptop OS cursor control using PyAutoGUI. Move real OS mouse with index finger, left click / drag with pinch, right click with peace sign (2 fingers), and toggle mouse control with a fist.

---

## 🚀 Hand Gesture Mapping

| Action | Hand Gesture | Mode |
|---|---|---|
| **Draw Flowers / Aim** | ☝ Point Index Finger | Flower Canvas, Fruit Game & Real Mouse |
| **Steer Left** | ⬅️ Hand to the Left | F1 Racing |
| **Center Lane** | ⬆️ Hand in Center | F1 Racing |
| **Steer Right** | ➡️ Hand to the Right | F1 Racing |
| **Slice Fruits** | ✋ Fast Hand Swipe | Fruit Game |
| **Select Flower / Left Click** | 👌 Pinch (Thumb + Index Tip) | Flower Canvas, Fruit Game & Real Mouse |
| **Drag & Drop** | 👌 Hold Pinch | Real Mouse |
| **Right Click** | ✌️ Peace Sign (2 Fingers Extended) | Real Mouse |
| **Clear Canvas / Pause / Toggle** | ✊ Make a Fist | Flower Canvas, Fruit Game & Real Mouse |
| **Neutral Navigation** | 🖐️ Open Palm | All Modes |



---

## 🛠️ Tech Stack

- **Backend**: Python 3, FastAPI, OpenCV, MediaPipe, PyAutoGUI, NumPy, WebSockets, Uvicorn
- **Frontend**: HTML5 Canvas, CSS3 Glassmorphism, JavaScript ES6+, MediaPipe Hands, Web Audio API

---

## 🏁 Quick Start Guide

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the FastAPI Application Server

```bash
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Open in Browser

Open your browser and navigate to:
```text
http://localhost:8000
```
- **🎮 Fruit Game**: `http://localhost:8000/game`
- **🖱️ Real Mouse**: `http://localhost:8000/mouse`

---

## ⚙️ Configuration (`config.py`)

All hand gesture thresholds and fruit velocity constants can be customized in `config.py`:
- `MIN_SWIPE_DISTANCE = 0.07`
- `MIN_SWIPE_SPEED = 0.95`
- `PINCH_DISTANCE_THRESHOLD = 0.055`
- `PEACE_DISTANCE_THRESHOLD = 0.065`
- `MOUSE_SMOOTHING_FACTOR = 0.25`
- `LEVEL_1_SPEED_MULT = 0.50`
