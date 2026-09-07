import asyncio
import base64
import json
import logging
import cv2
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import config
from gesture_engine import GestureEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GesturePlatform")

app = FastAPI(title="Hand + Eye Gesture Platform (Game + Mouse)")

# Static Directory Setup
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Connection Managers for Game and Mouse sockets
class ConnectionManager:
    def __init__(self, mode_name):
        self.mode_name = mode_name
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[{self.mode_name}] Client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[{self.mode_name}] Client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                self.disconnect(connection)

game_manager = ConnectionManager("GAME")
mouse_manager = ConnectionManager("MOUSE")

game_gesture_engine = GestureEngine(mode="game")
mouse_gesture_engine = GestureEngine(mode="mouse")

camera_running = False

async def webcam_worker():
    global camera_running
    camera_running = True
    logger.info("Initializing OpenCV VideoCapture(0)...")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        cap = cv2.VideoCapture(1)

    if not cap.isOpened():
        logger.warning("Could not open OpenCV VideoCapture. Client fallback mode available.")
        camera_running = False
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    try:
        while camera_running:
            ret, frame = cap.read()
            if not ret or frame is None:
                await asyncio.sleep(0.03)
                continue

            # Send to Game Clients if active
            if len(game_manager.active_connections) > 0:
                ann_frame_game, g_data_game = game_gesture_engine.process_frame(frame.copy(), mode="game")
                _, buffer = cv2.imencode('.jpg', ann_frame_game, [cv2.IMWRITE_JPEG_QUALITY, 65])
                g_data_game["frame"] = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                await game_manager.broadcast(g_data_game)

            # Send to Mouse Clients if active
            if len(mouse_manager.active_connections) > 0:
                ann_frame_mouse, g_data_mouse = mouse_gesture_engine.process_frame(frame.copy(), mode="mouse")
                _, buffer = cv2.imencode('.jpg', ann_frame_mouse, [cv2.IMWRITE_JPEG_QUALITY, 65])
                g_data_mouse["frame"] = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
                await mouse_manager.broadcast(g_data_mouse)

            await asyncio.sleep(0.02)
    except Exception as e:
        logger.error(f"Error in webcam worker loop: {e}")
    finally:
        cap.release()
        camera_running = False

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(webcam_worker())

# ROUTING
@app.get("/")
async def get_home():
    return FileResponse(os.path.join(static_dir, "home.html"))

@app.get("/game")
async def get_game():
    return FileResponse(os.path.join(static_dir, "game.html"))

@app.get("/mouse")
async def get_mouse():
    return FileResponse(os.path.join(static_dir, "mouse.html"))

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "camera_running": camera_running,
        "active_game_clients": len(game_manager.active_connections),
        "active_mouse_clients": len(mouse_manager.active_connections)
    }

# WEBSOCKET ENDPOINTS
@app.websocket("/ws/game")
async def websocket_game(websocket: WebSocket):
    await game_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        game_manager.disconnect(websocket)

@app.websocket("/ws/mouse")
async def websocket_mouse(websocket: WebSocket):
    await mouse_manager.connect(websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                # Receive client gesture data from browser MediaPipe for PyAutoGUI execution
                action_type = msg.get("action")
                pointer_data = msg.get("pointer")
                is_pinch = msg.get("gesture") == "pinch"

                mouse_gesture_engine.execute_mouse_action(action_type, pointer_data, is_pinch)
            except Exception:
                pass
    except WebSocketDisconnect:
        mouse_manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
