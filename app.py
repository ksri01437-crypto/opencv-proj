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

# Camera capture on backend is optional / on-demand so it doesn't lock the Windows webcam device
camera_running = False
cap = None

async def webcam_worker():
    """
    Optional backend camera worker. Only runs if client explicitly connects in backend-capture mode,
    leaving the camera device free for the browser client MediaPipe.
    """
    global camera_running, cap
    logger.info("Backend camera worker standby. Camera released for browser client.")

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI Server started. Browser-based MediaPipe is active.")


# ROUTING
@app.get("/")
async def get_home():
    return FileResponse(os.path.join(static_dir, "home.html"))

@app.get("/game")
async def get_game():
    return FileResponse(os.path.join(static_dir, "game.html"))

@app.get("/cargame")
@app.get("/car")
async def get_cargame():
    return FileResponse(os.path.join(static_dir, "cargame.html"))

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
