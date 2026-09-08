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

        # Pointer & History
        self.smoothed_pointer = None
        self.smoothing_factor = config.MOUSE_SMOOTHING_FACTOR

        self.hand_history = []
        self.swipe_cooldown = 0.0

        self.last_action = None
        self.action_cooldown_until = 0.0

    def process_frame(self, frame, mode=None):
        """
        Processes an BGR OpenCV camera frame (if backend capture is used).
        """
        if mode:
            self.mode = mode

        gesture_data = {
            "mode": self.mode,
            "pointer": None,
            "os_pointer": None,
            "gesture": "none",
            "direction": None,
            "swipe_line": None,
            "action": None,
            "mouse_enabled": self.mouse_enabled
        }

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
            # If toggle action is triggered, still allow re-enabling mouse
            if action_type == "toggle_control" or action_type == "toggle_mouse":
                self.mouse_enabled = not self.mouse_enabled
            return

        try:
            # 1. Cursor Movement (Index Finger Tracking)
            if pointer_data:
                target_x = max(config.MOUSE_MARGIN, min(self.screen_w - config.MOUSE_MARGIN, pointer_data["x"] * self.screen_w))
                target_y = max(config.MOUSE_MARGIN, min(self.screen_h - config.MOUSE_MARGIN, pointer_data["y"] * self.screen_h))

                self.os_cursor_x = (1 - self.smoothing_factor) * self.os_cursor_x + self.smoothing_factor * target_x
                self.os_cursor_y = (1 - self.smoothing_factor) * self.os_cursor_y + self.smoothing_factor * target_y

                pyautogui.moveTo(int(self.os_cursor_x), int(self.os_cursor_y))

            # 2. Pinch Dragging (Thumb + Index Touch & Hold)
            if is_pinch and not self.is_pinching:
                self.is_pinching = True
                pyautogui.mouseDown()
            elif not is_pinch and self.is_pinching:
                self.is_pinching = False
                pyautogui.mouseUp()

            # 3. Hand Gesture Actions
            if action_type == "left_click" or action_type == "pinch_click":
                pyautogui.click(button='left')
            elif action_type == "right_click" or action_type == "peace_click":
                pyautogui.click(button='right')
            elif action_type == "toggle_control" or action_type == "toggle_mouse":
                # Toggle mouse control on/off via Fist gesture
                self.mouse_enabled = not self.mouse_enabled

        except Exception as e:
            print(f"PyAutoGUI error: {e}")

