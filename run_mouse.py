"""
Real Computer Mouse - Standalone Gesture Engine Launcher
Control your entire Windows PC with hand gestures using your webcam!
Works across desktop, games, file explorer, web browsers, and all applications.
"""

import sys
import time
import os

# Ensure UTF-8 output encoding on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Add current directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from native_mouse_worker import NativeMouseWorker

def main():
    print("=" * 72)
    print("  REAL COMPUTER MOUSE - SYSTEM-WIDE GESTURE ENGINE")
    print("=" * 72)
    print("FULL OS CONTROL: Move cursor, click, drag, scroll, and right-click!")
    print("Works on desktop, taskbar, games, browsers, and all Windows apps.")
    print("-" * 72)
    print("HAND GESTURE REFERENCE:")
    print("   [Index Finger Point]        -> Move Real OS Cursor")
    print("   [Pinch Tap (Thumb + Index)] -> Real Left Click")
    print("   [Quick Double Pinch]        -> Real Double Click (Open files/apps)")
    print("   [Hold Pinch (>0.28s)]       -> Real Drag & Drop (Move windows/icons)")
    print("   [Peace Sign (2 Fingers V)]  -> Real Right Click (Context Menu)")
    print("   [2 Fingers Together Up/Dn]  -> Real Mouse Wheel Scroll")
    print("   [Make a Fist / Press SPACE] -> Pause / Resume Mouse Control")
    print("-" * 72)
    print("CAMERA HUD PREVIEW WINDOW KEYS:")
    print("   [SPACE] or [P] : Pause / Resume Mouse Control")
    print("   [Q] or [ESC]   : Quit Real Computer Mouse")
    print("-" * 72)
    print("Initializing webcam and MediaPipe hand landmarker...")

    worker = NativeMouseWorker(show_window=True)
    worker.start()

    print("REAL COMPUTER MOUSE IS ACTIVE!")
    print("A camera preview window is running with live HUD feedback.")
    print("Press Ctrl+C in this terminal or Q in camera window to exit.")
    print("=" * 72)

    try:
        while worker.is_running:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping mouse worker...")
    finally:
        worker.stop()
        print("Real Computer Mouse stopped cleanly.")

if __name__ == "__main__":
    main()
