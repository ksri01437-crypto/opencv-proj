import time
import math
import threading
import logging
import base64
import os
import sys
import cv2
import numpy as np
import pyautogui
import mediapipe as mp
import ctypes

try:
    import config
except ImportError:
    config = None

logger = logging.getLogger("NativeMouseWorker")

# Ensure stdout UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Disable PyAutoGUI failsafe and pause for ultra-fast cursor control
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
        logger.warning(f"Could not initialize Win32 ctypes user32: {e}")
        user32 = None


class NativeMouseWorker:
    def __init__(self, model_path="hand_landmarker.task", show_window=True):
        if not os.path.isabs(model_path):
            base_dir = os.path.dirname(os.path.abspath(__file__))
            candidate = os.path.join(base_dir, model_path)
            if os.path.exists(candidate):
                model_path = candidate
        self.model_path = model_path
        self.show_window = show_window

        self.is_running = False
        self.mouse_enabled = True
        self.thread = None
        self.cap = None
        self.landmarker = None

        # Screen Dimensions (Physical Pixel Resolution)
        if user32:
            self.screen_w = user32.GetSystemMetrics(0)
            self.screen_h = user32.GetSystemMetrics(1)
        else:
            try:
                self.screen_w, self.screen_h = pyautogui.size()
            except Exception:
                self.screen_w, self.screen_h = 1920, 1080

        # Cursor State & Velocity-Adaptive Smoothing
        self.cursor_x = float(self.screen_w / 2.0)
        self.cursor_y = float(self.screen_h / 2.0)
        self.last_target_x = self.cursor_x
        self.last_target_y = self.cursor_y
        self.last_move_time = time.time()

        self.base_smoothing = getattr(config, 'MOUSE_SMOOTHING_FACTOR', 0.25) if config else 0.25
        self.margin_x = 0.12
        self.margin_y = 0.14

        # Pinch & Drag State
        self.is_pinching = False
        self.is_dragging = False
        self.pinch_start_time = 0.0
        self.last_click_time = 0.0
        self.last_right_click_time = 0.0

        # Scroll State
        self.prev_scroll_y = None
        self.last_scroll_time = 0.0

        # Fist Toggle State
        self.last_fist_toggle_time = 0.0

        # Status & Telemetry
        self.last_action = "IDLE"
        self.current_gesture = "NONE"
        self.fps = 0.0
        self.latest_telemetry = {}
        self.on_telemetry = None
        self.frame_b64 = None

    def start(self, on_telemetry=None):
        if self.is_running:
            logger.info("NativeMouseWorker already running.")
            if on_telemetry:
                self.on_telemetry = on_telemetry
            return True

        self.on_telemetry = on_telemetry
        self.is_running = True
        self.mouse_enabled = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        logger.info("NativeMouseWorker thread started successfully.")
        return True

    def stop(self):
        if not self.is_running:
            return False

        logger.info("Stopping NativeMouseWorker...")
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.5)
        self.thread = None

        if self.is_dragging:
            self._win32_mouse_up()
            self.is_dragging = False

        if self.show_window:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass

        logger.info("NativeMouseWorker stopped cleanly.")
        return True

    def toggle_pause(self):
        self.mouse_enabled = not self.mouse_enabled
        if not self.mouse_enabled and self.is_dragging:
            self._win32_mouse_up()
            self.is_dragging = False
        self.last_action = "UNPAUSED" if self.mouse_enabled else "PAUSED"
        return self.mouse_enabled

    def get_status(self):
        return {
            "running": self.is_running,
            "mouse_enabled": self.mouse_enabled,
            "fps": round(self.fps, 1),
            "last_action": self.last_action,
            "gesture": self.current_gesture,
            "cursor": {"x": int(self.cursor_x), "y": int(self.cursor_y)},
            "is_dragging": self.is_dragging
        }

    # WIN32 FAST INPUT SIMULATION
    def _move_cursor(self, target_x, target_y, now):
        dt = max(0.001, now - self.last_move_time)
        self.last_move_time = now

        dx = target_x - self.last_target_x
        dy = target_y - self.last_target_y
        speed = math.hypot(dx, dy) / dt

        self.last_target_x = target_x
        self.last_target_y = target_y

        # Adapt smoothing: Fast movement -> instant response; Slow movement -> steady precision
        adaptive_alpha = min(0.92, self.base_smoothing + (speed / 3000.0) * 0.65)

        self.cursor_x = (1.0 - adaptive_alpha) * self.cursor_x + adaptive_alpha * target_x
        self.cursor_y = (1.0 - adaptive_alpha) * self.cursor_y + adaptive_alpha * target_y

        ix = int(max(2, min(self.screen_w - 2, self.cursor_x)))
        iy = int(max(2, min(self.screen_h - 2, self.cursor_y)))

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

    def _init_landmarker(self):
        try:
            BaseOptions = mp.tasks.BaseOptions
            HandLandmarker = mp.tasks.vision.HandLandmarker
            HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
            VisionRunningMode = mp.tasks.vision.RunningMode

            options = HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=self.model_path),
                running_mode=VisionRunningMode.IMAGE,
                num_hands=1
            )
            return HandLandmarker.create_from_options(options)
        except Exception as e:
            logger.error(f"Error initializing HandLandmarker from {self.model_path}: {e}")
            return None

    def _open_camera(self):
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap or not cap.isOpened():
            cap = cv2.VideoCapture(0)
        if not cap or not cap.isOpened():
            cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

        if cap and cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return cap
        return None

    def _run_loop(self):
        logger.info("Initializing MediaPipe Hand Landmarker...")
        self.landmarker = self._init_landmarker()
        if not self.landmarker:
            logger.error("Failed to initialize MediaPipe Landmarker.")
            self.is_running = False
            return

        logger.info("Opening webcam device...")
        self.cap = self._open_camera()
        if not self.cap:
            logger.error("Could not open webcam device.")
            self.is_running = False
            if self.landmarker:
                self.landmarker.close()
            return

        fps_timer = time.time()
        frame_count = 0
        window_title = "Real Computer Mouse - Gesture Engine (HUD)"
        window_created = False

        try:
            while self.is_running:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    time.sleep(0.01)
                    continue

                now = time.time()
                frame_count += 1
                if now - fps_timer >= 1.0:
                    self.fps = frame_count / (now - fps_timer)
                    frame_count = 0
                    fps_timer = now

                small_frame = cv2.resize(frame, (640, 480))
                rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

                detection_result = self.landmarker.detect(mp_img)
                landmarks = self._process_detection(detection_result, now)

                display_frame = cv2.flip(small_frame, 1)
                fh, fw = display_frame.shape[:2]

                if landmarks:
                    self._draw_hud_skeleton(display_frame, landmarks, fw, fh)

                self._draw_hud_overlay(display_frame, fw, fh)

                if self.show_window:
                    if not window_created:
                        cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
                        cv2.resizeWindow(window_title, 720, 540)
                        window_created = True

                    cv2.imshow(window_title, display_frame)

                    key = cv2.waitKey(1) & 0xFF
                    if key in (27, ord('q'), ord('Q')):
                        logger.info("Quit key pressed.")
                        self.is_running = False
                        break
                    elif key in (32, ord('p'), ord('P')):
                        self.toggle_pause()

                if self.on_telemetry:
                    _, buffer = cv2.imencode('.jpg', display_frame, [cv2.IMWRITE_JPEG_QUALITY, 55])
                    self.frame_b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
                    telemetry = self.get_status()
                    telemetry["frame"] = self.frame_b64
                    try:
                        self.on_telemetry(telemetry)
                    except Exception:
                        pass

                time.sleep(0.002)

        except Exception as e:
            logger.error(f"Error in NativeMouseWorker run loop: {e}", exc_info=True)
        finally:
            if self.is_dragging:
                self._win32_mouse_up()
                self.is_dragging = False

            if self.cap:
                self.cap.release()
                self.cap = None

            if self.landmarker:
                try:
                    self.landmarker.close()
                except Exception:
                    pass
                self.landmarker = None

            if self.show_window and window_created:
                try:
                    cv2.destroyAllWindows()
                except Exception:
                    pass

            self.is_running = False
            logger.info("NativeMouseWorker resources released cleanly.")

    def _process_detection(self, result, now):
        if not result or not result.hand_landmarks or len(result.hand_landmarks) == 0:
            self.current_gesture = "NONE"
            self.prev_scroll_y = None
            if self.is_dragging:
                self._win32_mouse_up()
                self.is_dragging = False
                self.last_action = "DRAG RELEASED"
            return None

        landmarks = result.hand_landmarks[0]

        wrist = landmarks[0]
        thumb_tip = landmarks[4]
        index_mcp = landmarks[5]
        index_pip = landmarks[6]
        index_tip = landmarks[8]
        middle_mcp = landmarks[9]
        middle_pip = landmarks[10]
        middle_tip = landmarks[12]
        ring_mcp = landmarks[13]
        ring_pip = landmarks[14]
        ring_tip = landmarks[16]
        pinky_mcp = landmarks[17]
        pinky_pip = landmarks[18]
        pinky_tip = landmarks[20]

        def dist(p1, p2):
            return math.hypot(p1.x - p2.x, p1.y - p2.y)

        # Hand scale for depth invariance
        hand_scale = max(0.04, dist(wrist, index_mcp))

        # Finger extensions
        is_index_ext = dist(index_tip, wrist) > dist(index_pip, wrist) * 1.10
        is_middle_ext = dist(middle_tip, wrist) > dist(middle_pip, wrist) * 1.10
        is_ring_ext = dist(ring_tip, wrist) > dist(ring_pip, wrist) * 1.10
        is_pinky_ext = dist(pinky_tip, wrist) > dist(pinky_pip, wrist) * 1.10

        # 1. Fist Detection ✊ (Pause/Resume control)
        tips = [index_tip, middle_tip, ring_tip, pinky_tip]
        mcps = [index_mcp, middle_mcp, ring_mcp, pinky_mcp]
        is_fist = True
        for t, m in zip(tips, mcps):
            if dist(t, wrist) > dist(m, wrist) * 1.20:
                is_fist = False
                break

        if is_fist:
            self.current_gesture = "FIST"
            self.prev_scroll_y = None
            if now - self.last_fist_toggle_time > 1.2:
                self.toggle_pause()
                self.last_fist_toggle_time = now
            return landmarks

        # If user paused control, skip cursor movement
        if not self.mouse_enabled:
            self.current_gesture = "PAUSED"
            self.prev_scroll_y = None
            return landmarks

        # 2. ALWAYS UPDATE CURSOR POSITION ON EVERY DETECTED FRAME!
        # Tracking point: Pinch midpoint during drag/pinch, Index tip during pointing
        rel_pinch_dist = dist(thumb_tip, index_tip) / hand_scale

        if rel_pinch_dist < 0.35 or self.is_dragging:
            raw_x = 1.0 - (thumb_tip.x + index_tip.x) / 2.0
            raw_y = (thumb_tip.y + index_tip.y) / 2.0
        else:
            raw_x = 1.0 - index_tip.x
            raw_y = index_tip.y

        # Active margin box normalization
        norm_x = (raw_x - self.margin_x) / (1.0 - 2.0 * self.margin_x)
        norm_y = (raw_y - self.margin_y) / (1.0 - 2.0 * self.margin_y)
        norm_x = max(0.0, min(1.0, norm_x))
        norm_y = max(0.0, min(1.0, norm_y))

        target_x = norm_x * self.screen_w
        target_y = norm_y * self.screen_h

        # Drive real Windows OS cursor!
        self._move_cursor(target_x, target_y, now)

        # 3. Right Click ✌️ (Peace sign: Index & Middle extended, Ring & Pinky curled, gap > 0.40)
        is_peace_sign = is_index_ext and is_middle_ext and not is_ring_ext and not is_pinky_ext and (dist(index_tip, middle_tip) / hand_scale > 0.42)

        if is_peace_sign:
            self.current_gesture = "PEACE (RIGHT CLICK)"
            if now - self.last_right_click_time > 0.50:
                self._win32_right_click()
                self.last_right_click_time = now
                self.last_action = "RIGHT CLICK"
            return landmarks

        # 4. Scroll Wheel 📜 (Index & Middle extended together close, Ring & Pinky curled)
        is_scroll_pose = is_index_ext and is_middle_ext and not is_ring_ext and not is_pinky_ext and (dist(index_tip, middle_tip) / hand_scale <= 0.38)

        if is_scroll_pose:
            self.current_gesture = "SCROLL"
            curr_scroll_y = (index_tip.y + middle_tip.y) / 2.0

            if self.prev_scroll_y is not None:
                dy = curr_scroll_y - self.prev_scroll_y
                if abs(dy) > 0.010 and now - self.last_scroll_time > 0.05:
                    if dy < -0.010:  # Moving hand UP -> Scroll UP
                        amount = int(min(360, max(120, abs(dy) * 6000)))
                        self._win32_scroll(amount)
                        self.last_action = "SCROLL UP"
                        self.last_scroll_time = now
                    elif dy > 0.010: # Moving hand DOWN -> Scroll DOWN
                        amount = int(min(360, max(120, abs(dy) * 6000)))
                        self._win32_scroll(-amount)
                        self.last_action = "SCROLL DOWN"
                        self.last_scroll_time = now

            self.prev_scroll_y = curr_scroll_y
            return landmarks
        else:
            self.prev_scroll_y = None

        # 5. Pinch Click, Double Click & Drag & Drop Execution
        PINCH_ON = 0.32
        PINCH_OFF = 0.44

        if not self.is_pinching and rel_pinch_dist < PINCH_ON:
            self.is_pinching = True
            self.pinch_start_time = now
        elif self.is_pinching and rel_pinch_dist > PINCH_OFF:
            self.is_pinching = False

        if self.is_pinching:
            self.current_gesture = "PINCH"
            pinch_dur = now - self.pinch_start_time

            # Hold pinch > 0.28s -> Drag Start
            if pinch_dur > 0.28 and not self.is_dragging:
                self.is_dragging = True
                self._win32_mouse_down()
                self.last_action = "DRAG START"

        elif not self.is_pinching:
            if self.is_dragging:
                self.is_dragging = False
                self._win32_mouse_up()
                self.last_action = "DRAG DROP"
            elif self.pinch_start_time > 0.0:
                pinch_dur = now - self.pinch_start_time
                self.pinch_start_time = 0.0

                if pinch_dur <= 0.28:
                    if now - self.last_click_time < 0.38:
                        self._win32_double_click()
                        self.last_click_time = 0.0
                        self.last_action = "DOUBLE CLICK"
                    else:
                        self._win32_left_click()
                        self.last_click_time = now
                        self.last_action = "LEFT CLICK"

            if is_index_ext:
                self.current_gesture = "POINTING"
                if not self.is_dragging and self.last_action in ("LEFT CLICK", "DOUBLE CLICK", "DRAG DROP", "RIGHT CLICK"):
                    if now - max(self.last_click_time, self.last_right_click_time) > 0.4:
                        self.last_action = "MOVING"
                elif not self.is_dragging:
                    self.last_action = "MOVING"
            else:
                self.current_gesture = "OPEN PALM" if (is_middle_ext and is_ring_ext and is_pinky_ext) else "NEUTRAL"

        return landmarks

    def _draw_hud_skeleton(self, frame, landmarks, fw, fh):
        connections = [
            (0, 1), (1, 2), (2, 3), (3, 4),
            (0, 5), (5, 6), (6, 7), (7, 8),
            (5, 9), (9, 10), (10, 11), (11, 12),
            (9, 13), (13, 14), (14, 15), (15, 16),
            (13, 17), (17, 18), (18, 19), (19, 20),
            (0, 17)
        ]

        points = []
        for lm in landmarks:
            cx = int((1.0 - lm.x) * fw)
            cy = int(lm.y * fh)
            points.append((cx, cy))

        for p1_idx, p2_idx in connections:
            cv2.line(frame, points[p1_idx], points[p2_idx], (0, 220, 255), 2, cv2.LINE_AA)

        cv2.circle(frame, points[8], 8, (0, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(frame, points[8], 14, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.circle(frame, points[4], 7, (255, 0, 255), -1, cv2.LINE_AA)
        cv2.circle(frame, points[12], 6, (255, 255, 0), -1, cv2.LINE_AA)

        if self.is_pinching or self.is_dragging:
            cv2.line(frame, points[4], points[8], (0, 255, 0), 4, cv2.LINE_AA)

    def _draw_hud_overlay(self, frame, fw, fh):
        mx1 = int(self.margin_x * fw)
        my1 = int(self.margin_y * fh)
        mx2 = int((1.0 - self.margin_x) * fw)
        my2 = int((1.0 - self.margin_y) * fh)
        cv2.rectangle(frame, (mx1, my1), (mx2, my2), (80, 80, 80), 1, cv2.LINE_AA)

        top_bar_color = (18, 22, 32)
        cv2.rectangle(frame, (0, 0), (fw, 36), top_bar_color, -1)

        status_text = "MOUSE CONTROL: ACTIVE" if self.mouse_enabled else "MOUSE CONTROL: PAUSED (FIST / SPACE)"
        status_color = (0, 255, 120) if self.mouse_enabled else (0, 140, 255)
        cv2.putText(frame, status_text, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 2, cv2.LINE_AA)

        fps_str = f"{round(self.fps, 1)} FPS"
        cv2.putText(frame, fps_str, (fw - 110, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 230, 255), 2, cv2.LINE_AA)

        cv2.rectangle(frame, (0, fh - 36), (fw, fh), top_bar_color, -1)

        action_str = f"ACTION: {self.last_action}"
        gesture_str = f"GESTURE: {self.current_gesture}"
        cv2.putText(frame, action_str, (12, fh - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, gesture_str, (fw // 2 - 40, fh - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (200, 230, 100), 1, cv2.LINE_AA)

        cursor_str = f"X: {int(self.cursor_x)} Y: {int(self.cursor_y)}"
        cv2.putText(frame, cursor_str, (fw - 160, fh - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
