# Central Configuration for Hand Gesture Platform (Game + Mouse Control)

# --- SWIPE & HAND GESTURE THRESHOLDS ---
MIN_SWIPE_DISTANCE = 0.07   # Minimum swipe distance in normalized screen units (~70-100px)
MIN_SWIPE_SPEED = 0.95      # Minimum swipe speed (distance / second)
SWIPE_HISTORY_FRAMES = 12   # History buffer size for velocity tracking

PINCH_DISTANCE_THRESHOLD = 0.055  # Distance between thumb and index tip for pinch
PEACE_DISTANCE_THRESHOLD = 0.065  # Two fingers extended together for right-click

# --- REAL MOUSE CONTROL CONFIGURATION ---
MOUSE_SMOOTHING_FACTOR = 0.25 # Lower = smoother cursor, higher = faster cursor
MOUSE_MARGIN = 15             # Safe margin from screen edges to prevent PyAutoGUI failsafe

# --- GAME DIFFICULTY & SPEED CONTROL ---
# Speed multipliers: Controls upward initial launch velocity vy
# Lower values mean floaty, slow fruits taking 2.0 to 3.5 seconds to cross the screen!
LEVEL_1_SPEED_MULT = 0.50   # Slow floaty fruits for Level 1
LEVEL_2_SPEED_MULT = 0.75   # Moderate fruits for Level 2
LEVEL_3_SPEED_MULT = 1.05   # Faster fruits for Level 3+

LEVEL_1_GRAVITY = 0.18      # Floatier low gravity
LEVEL_2_GRAVITY = 0.24
LEVEL_3_GRAVITY = 0.32

