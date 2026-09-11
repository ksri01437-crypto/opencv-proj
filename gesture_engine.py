import time
import math
import numpy as np
import cv2
import os
import sys
import pyautogui
import ctypes

try:
    import config
except ImportError:
    config = None

# Ensure stdout UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Disable PyAutoGUI failsafe and pause for fast, unhindered cursor control
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.001

# Win32 API constants & setup for high-DPI zero-latency OS mouse control
user32 = None
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800

if sys.platform == "win32":
    try:
        user32 = ctypes.windll.user32
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass
    except Exception as e:
        user32 = None


class GestureEngine:
    def __init__(self, mode="game"):
        self.mode = mode  # "game" or "mouse"

        # Screen Dimensions (Physical Pixel Resolution via DPI Awareness)
        if user32:
            self.screen_w = user32.GetSystemMetrics(0)
            self.screen_h = user32.GetSystemMetrics(1)
        else:
            try:
                self.screen_w, self.screen_h = pyautogui.size()
            except Exception:
                self.screen_w, self.screen_h = 1920, 1080

        # Current Smoothed OS Cursor Position & Velocity Smoothing
        self.os_cursor_x = float(self.screen_w / 2.0)
        self.os_cursor_y = float(self.screen_h / 2.0)
        self.last_target_x = self.os_cursor_x
        self.last_target_y = self.os_cursor_y
        self.last_move_time = time.time()
        
        self.mouse_enabled = True

        # Smoothing & Active Margins
        self.base_smoothing = getattr(config, 'MOUSE_SMOOTHING_FACTOR', 0.25) if config else 0.25
        self.margin_x = 0.12
        self.margin_y = 0.14

        # Pinch & Drag State
        self.is_pinching = False
        self.is_dragging = False
        self.pinch_start_time = 0.0
        self.last_click_time = 0.0
        self.last_right_click_time = 0.0
        self.last_scroll_time = 0.0

        self.hand_history = []
        self.swipe_cooldown = 0.0
        self.last_action = None

    def _move_cursor(self, target_x, target_y, now=None):
        """0-latency Win32 cursor positioning with velocity-adaptive dynamic smoothing"""
        if now is None:
            now = time.time()

        dt = max(0.001, now - self.last_move_time)
        self.last_move_time = now

        dx = target_x - self.last_target_x
        dy = target_y - self.last_target_y
        speed = math.hypot(dx, dy) / dt

        self.last_target_x = target_x
        self.last_target_y = target_y

        adaptive_alpha = min(0.92, self.base_smoothing + (speed / 3000.0) * 0.65)

        self.os_cursor_x = (1.0 - adaptive_alpha) * self.os_cursor_x + adaptive_alpha * target_x
        self.os_cursor_y = (1.0 - adaptive_alpha) * self.os_cursor_y + adaptive_alpha * target_y

        ix = int(max(2, min(self.screen_w - 2, self.os_cursor_x)))
        iy = int(max(2, min(self.screen_h - 2, self.os_cursor_y)))

        if user32:
            user32.SetCursorPos(ix, iy)
        else:
            pyautogui.moveTo(ix, iy)

    def _win32_left_click(self):
        if user32:
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            time.sleep(0.015)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        else:
            pyautogui.click(button='left')

    def _win32_double_click(self):
        if user32:
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            time.sleep(0.04)
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        else:
            pyautogui.doubleClick(button='left')

    def _win32_right_click(self):
        if user32:
            user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            time.sleep(0.015)
            user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
        else:
            pyautogui.click(button='right')

    def _win32_mouse_down(self):
        if user32:
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        else:
            pyautogui.mouseDown(button='left')

    def _win32_mouse_up(self):
        if user32:
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        else:
            pyautogui.mouseUp(button='left')

    def _win32_scroll(self, amount):
        if user32:
            user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(amount), 0)
        else:
            pyautogui.scroll(int(amount))

    def process_frame(self, frame, mode=None):
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
        return frame, gesture_data

    def execute_mouse_action(self, action_type, pointer_data=None, is_pinch=False, gesture=None, extra=None):
        """
        Executes Real OS Mouse actions across Windows (Desktop, Taskbar, Apps)
        """
        if self.mode != "mouse":
            return

        now = time.time()

        # 1. Toggle Mouse Control (Fist ✊)
        if action_type in ("toggle_control", "toggle_mouse", "toggle_active"):
            self.mouse_enabled = not self.mouse_enabled
            if not self.mouse_enabled and self.is_dragging:
                self._win32_mouse_up()
                self.is_dragging = False
            return

        if not self.mouse_enabled or gesture in ("fist", "paused"):
            return

        try:
            # 2. Cursor Movement (Index Finger / Pinch tracking with Active Margins & Win32 SetCursorPos)
            if pointer_data:
                raw_x = pointer_data.get("x", 0.5)
                raw_y = pointer_data.get("y", 0.5)

                norm_x = (raw_x - self.margin_x) / (1.0 - 2.0 * self.margin_x)
                norm_y = (raw_y - self.margin_y) / (1.0 - 2.0 * self.margin_y)
                norm_x = max(0.0, min(1.0, norm_x))
                norm_y = max(0.0, min(1.0, norm_y))

                target_x = norm_x * self.screen_w
                target_y = norm_y * self.screen_h

                self._move_cursor(target_x, target_y, now)

            # 3. Pinch Drag & Drop Execution
            if is_pinch or gesture == "pinch":
                if not self.is_pinching:
                    self.is_pinching = True
                    self.pinch_start_time = now

                pinch_dur = now - self.pinch_start_time
                if pinch_dur > 0.28 and not self.is_dragging:
                    self.is_dragging = True
                    self._win32_mouse_down()
            elif not is_pinch and self.is_pinching:
                self.is_pinching = False
                if self.is_dragging:
                    self.is_dragging = False
                    self._win32_mouse_up()

            # 4. Left Click & Double Click Execution
            if action_type in ("left_click", "pinch_click"):
                if not self.is_dragging:
                    if now - self.last_click_time < 0.38:
                        self._win32_double_click()
                        self.last_click_time = 0.0
                    else:
                        self._win32_left_click()
                        self.last_click_time = now

            # 5. Right Click Execution (Peace Sign ✌️ or Middle Pinch)
            elif action_type in ("right_click", "peace_click") or gesture == "peace":
                if now - self.last_right_click_time > 0.50:
                    self._win32_right_click()
                    self.last_right_click_time = now

            # 6. Scroll Wheel Execution (Two fingers together Up/Down)
            elif action_type == "scroll_up" or (gesture == "scroll" and extra and extra.get("dir") == "up"):
                if now - self.last_scroll_time > 0.05:
                    scroll_amt = int(extra.get("amount", 240)) if extra and "amount" in extra else 240
                    self._win32_scroll(scroll_amt)
                    self.last_scroll_time = now
            elif action_type == "scroll_down" or (gesture == "scroll" and extra and extra.get("dir") == "down"):
                if now - self.last_scroll_time > 0.05:
                    scroll_amt = int(extra.get("amount", 240)) if extra and "amount" in extra else 240
                    self._win32_scroll(-scroll_amt)
                    self.last_scroll_time = now

        except Exception as e:
            print(f"GestureEngine execution error: {e}")
