import time
import math
import numpy as np
import cv2
import os
import pyautogui
import config

# Disable PyAutoGUI failsafe to prevent unexpected crashes at screen corners
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.001

class GestureEngine:
    def __init__(self, mode="game"):
        self.mode = mode  # "game" or "mouse"

        # PyAutoGUI Screen Dimensions
        try:
            self.screen_w, self.screen_h = pyautogui.size()
        except Exception:
            self.screen_w, self.screen_h = 1920, 1080

        # Current Smoothed OS Cursor Position
        self.os_cursor_x = self.screen_w / 2
        self.os_cursor_y = self.screen_h / 2
        self.mouse_enabled = True

        # Pinch Drag State
        self.is_pinching = False

        # OpenCV Face Cascade (optional fallback)
        cascade_path = getattr(cv2.data, 'haarcascades', '') + 'haarcascade_frontalface_default.xml'
        if os.path.exists(cascade_path):
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
        else:
            self.face_cascade = None

        # Pointer & History
        self.smoothed_pointer = None
        self.smoothing_factor = config.MOUSE_SMOOTHING_FACTOR

        self.hand_history = []
        self.swipe_cooldown = 0.0

        self.last_action = None
        self.action_cooldown_until = 0.0

    def process_frame(self, frame, mode=None):
        """
        Processes an BGR OpenCV camera frame.
        """
        if mode:
            self.mode = mode

        h, w, c = frame.shape
        current_time = time.time()

        gesture_data = {
            "mode": self.mode,
            "pointer": None,
            "os_pointer": None,
            "gesture": "none",
            "direction": None,
            "swipe_line": None,
            "left_eye": "open",
            "right_eye": "open",
            "left_ear": 0.30,
            "right_ear": 0.30,
            "action": None,
            "mouse_enabled": self.mouse_enabled
        }

        # Face Detection Overlay on Preview Frame
        if self.face_cascade and not self.face_cascade.empty():
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
                for (fx, fy, fw, fh) in faces:
                    cv2.rectangle(frame, (fx, fy), (fx+fw, fy+fh), (0, 255, 200), 2)
                    eye_y = int(fy + fh * 0.35)
                    cv2.circle(frame, (int(fx + fw * 0.3), eye_y), 8, (0, 255, 0), 2)
                    cv2.circle(frame, (int(fx + fw * 0.7), eye_y), 8, (0, 255, 0), 2)
            except Exception:
                pass

        # Draw HUD Indicator
        mode_text = "MODE: GAME (NO OS MOUSE)" if self.mode == "game" else "MODE: REAL OS MOUSE"
        cv2.putText(frame, "LIVE", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, mode_text, (15, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        cv2.circle(frame, (8, 20), 5, (0, 255, 0), -1)

        return frame, gesture_data

    def execute_mouse_action(self, action_type, pointer_data=None, is_pinch=False):
        """
        Executes Real PyAutoGUI OS Mouse actions ONLY when mode == 'mouse'
        """
        if self.mode != "mouse" or not self.mouse_enabled:
            return

        try:
            # 1. Cursor Movement
            if pointer_data:
                target_x = max(config.MOUSE_MARGIN, min(self.screen_w - config.MOUSE_MARGIN, pointer_data["x"] * self.screen_w))
                target_y = max(config.MOUSE_MARGIN, min(self.screen_h - config.MOUSE_MARGIN, pointer_data["y"] * self.screen_h))

                self.os_cursor_x = (1 - self.smoothing_factor) * self.os_cursor_x + self.smoothing_factor * target_x
                self.os_cursor_y = (1 - self.smoothing_factor) * self.os_cursor_y + self.smoothing_factor * target_y

                pyautogui.moveTo(int(self.os_cursor_x), int(self.os_cursor_y))

            # 2. Pinch Dragging
            if is_pinch and not self.is_pinching:
                self.is_pinching = True
                pyautogui.mouseDown()
            elif not is_pinch and self.is_pinching:
                self.is_pinching = False
                pyautogui.mouseUp()

            # 3. Eye Wink Click Actions
            if action_type == "left_click":
                pyautogui.click(button='left')
            elif action_type == "right_click":
                pyautogui.click(button='right')
            elif action_type == "both_eyes_closed":
                # Toggle mouse control on/off
                self.mouse_enabled = not self.mouse_enabled

        except Exception as e:
            print(f"PyAutoGUI error: {e}")
