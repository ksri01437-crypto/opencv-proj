import React, { useEffect, useRef, useState } from 'react';
import { Camera, Eye, Hand, VideoOff, RefreshCw, Zap, Move } from 'lucide-react';

export default function VisionRecognizer({
  onAimUpdate,
  onShootTrigger,
  isGameActive,
  sensitivity = 0.28,
  isFloatingPIP = true
}) {
  const videoRef = useRef(null);
  const pipCanvasRef = useRef(null);
  const [pipPosition, setPipPosition] = useState('top-right'); // 'top-right', 'bottom-right', 'top-left'
  const [trackingStatus, setTrackingStatus] = useState({
    cameraReady: false,
    handDetected: false,
    leftEyeEAR: 0.30,
    rightEyeEAR: 0.30,
    winkDetected: false,
    error: null
  });

  const handsRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const lastShotTimeRef = useRef(0);
  const targetPosRef = useRef({ x: 0.5, y: 0.5 });
  const currentPosRef = useRef({ x: 0.5, y: 0.5 });

  // Calculate Distance between 2D points
  const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Calculate Eye Aspect Ratio (EAR)
  const calculateEAR = (landmarks, p1Idx, p2Idx, p3Idx, p4Idx, p5Idx, p6Idx) => {
    const p1 = landmarks[p1Idx];
    const p2 = landmarks[p2Idx];
    const p3 = landmarks[p3Idx];
    const p4 = landmarks[p4Idx];
    const p5 = landmarks[p5Idx];
    const p6 = landmarks[p6Idx];

    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;

    const vertical1 = dist(p2, p5);
    const vertical2 = dist(p3, p6);
    const horizontal = dist(p1, p4);

    return (vertical1 + vertical2) / (2.0 * horizontal);
  };

  // Smooth pointer lerp update for Hand Pointing Aim
  useEffect(() => {
    let animationFrameId;

    const updateAimLoop = () => {
      currentPosRef.current.x += (targetPosRef.current.x - currentPosRef.current.x) * 0.35;
      currentPosRef.current.y += (targetPosRef.current.y - currentPosRef.current.y) * 0.35;

      onAimUpdate(currentPosRef.current.x, currentPosRef.current.y);
      animationFrameId = requestAnimationFrame(updateAimLoop);
    };

    animationFrameId = requestAnimationFrame(updateAimLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [onAimUpdate]);

  useEffect(() => {
    let isSubscribed = true;

    async function initVision() {
      if (!window.Hands || !window.FaceMesh) {
        setTrackingStatus((prev) => ({ ...prev, error: 'Loading MediaPipe / OpenCV scripts...' }));
        return;
      }

      try {
        // Initialize MediaPipe / OpenCV Hands Engine
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35
        });

        // Hand Skeleton Connections for cv2.drawLandmarks rendering
        const handConnections = [
          [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
          [0, 5], [5, 6], [6, 7], [7, 8], // Index
          [5, 9], [9, 10], [10, 11], [11, 12], // Middle
          [9, 13], [13, 14], [14, 15], [15, 16], // Ring
          [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
        ];

        hands.onResults((results) => {
          if (!isSubscribed) return;
          const pipCanvas = pipCanvasRef.current;
          const ctx = pipCanvas ? pipCanvas.getContext('2d') : null;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const indexTip = landmarks[8];

            if (indexTip) {
              const normalizedX = 1 - indexTip.x; // Invert for mirrored video
              const normalizedY = indexTip.y;
              targetPosRef.current = { x: normalizedX, y: normalizedY };

              setTrackingStatus((prev) => ({
                ...prev,
                handDetected: true
              }));

              // Draw Full OpenCV Skeleton on PIP canvas
              if (ctx && pipCanvas) {
                ctx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);

                // Draw Skeleton Connections (Green cv2 style)
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2;
                handConnections.forEach(([i, j]) => {
                  const p1 = landmarks[i];
                  const p2 = landmarks[j];
                  if (p1 && p2) {
                    ctx.beginPath();
                    ctx.moveTo((1 - p1.x) * pipCanvas.width, p1.y * pipCanvas.height);
                    ctx.lineTo((1 - p2.x) * pipCanvas.width, p2.y * pipCanvas.height);
                    ctx.stroke();
                  }
                });

                // Draw Landmark Joint Nodes
                landmarks.forEach((lm, idx) => {
                  const lx = (1 - lm.x) * pipCanvas.width;
                  const ly = lm.y * pipCanvas.height;
                  ctx.fillStyle = idx === 8 ? '#00F0FF' : '#00FF00';
                  ctx.beginPath();
                  ctx.arc(lx, ly, idx === 8 ? 6 : 3, 0, Math.PI * 2);
                  ctx.fill();
                });
              }
            }
          } else {
            setTrackingStatus((prev) => ({ ...prev, handDetected: false }));
            if (ctx && pipCanvas) ctx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
          }
        });

        handsRef.current = hands;

        // Initialize MediaPipe / OpenCV FaceMesh for Eye Gestures
        const faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35
        });

        faceMesh.onResults((results) => {
          if (!isSubscribed) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Left Eye: 33, 160, 158, 133, 153, 144
            const leftEAR = calculateEAR(landmarks, 33, 160, 158, 133, 153, 144);
            // Right Eye: 362, 385, 387, 263, 373, 380
            const rightEAR = calculateEAR(landmarks, 362, 385, 387, 263, 373, 380);

            // Trigger shoot when either eye drops below sensitivity threshold
            const isEyeWinked = leftEAR < sensitivity || rightEAR < sensitivity;
            const now = Date.now();

            if (isEyeWinked && now - lastShotTimeRef.current > 280) {
              lastShotTimeRef.current = now;
              onShootTrigger();
              setTrackingStatus((prev) => ({ ...prev, winkDetected: true }));
              setTimeout(() => {
                if (isSubscribed) setTrackingStatus((prev) => ({ ...prev, winkDetected: false }));
              }, 220);
            }

            setTrackingStatus((prev) => ({
              ...prev,
              leftEyeEAR: leftEAR.toFixed(2),
              rightEyeEAR: rightEAR.toFixed(2)
            }));
          }
        });

        faceMeshRef.current = faceMesh;

        // Start Camera Stream
        if (videoRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({ image: videoRef.current });
                await faceMesh.send({ image: videoRef.current });
              }
            },
            width: 320,
            height: 240
          });

          await camera.start();
          cameraRef.current = camera;
          setTrackingStatus((prev) => ({ ...prev, cameraReady: true, error: null }));
        }
      } catch (err) {
        console.error('Camera/Vision Error:', err);
        setTrackingStatus((prev) => ({
          ...prev,
          error: 'Webcam offline/blocked.'
        }));
      }
    }

    initVision();

    return () => {
      isSubscribed = false;
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
      if (faceMeshRef.current) faceMeshRef.current.close();
    };
  }, [sensitivity, onShootTrigger]);

  const togglePos = () => {
    if (pipPosition === 'top-right') setPipPosition('bottom-right');
    else if (pipPosition === 'bottom-right') setPipPosition('top-left');
    else setPipPosition('top-right');
  };

  const getPositionClass = () => {
    if (!isFloatingPIP) return 'vision-container';
    if (pipPosition === 'bottom-right') return 'floating-pip-container absolute bottom-4 right-4 z-40 w-44 md:w-52 shadow-2xl rounded-xl overflow-hidden border-2 border-emerald-500/70 bg-slate-950/95 backdrop-blur';
    if (pipPosition === 'top-left') return 'floating-pip-container absolute top-4 left-4 z-40 w-44 md:w-52 shadow-2xl rounded-xl overflow-hidden border-2 border-emerald-500/70 bg-slate-950/95 backdrop-blur';
    return 'floating-pip-container absolute top-4 right-4 z-40 w-44 md:w-52 shadow-2xl rounded-xl overflow-hidden border-2 border-emerald-500/70 bg-slate-950/95 backdrop-blur';
  };

  return (
    <div className={getPositionClass()}>
      {/* Video Feed Preview PIP */}
      <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" playsInline muted></video>
        <canvas ref={pipCanvasRef} width={320} height={240} className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100" />

        {!trackingStatus.cameraReady && !trackingStatus.error && (
          <div className="video-overlay-msg">
            <RefreshCw className="animate-spin text-emerald-400 mb-1" size={18} />
            <span className="font-orbitron text-[10px]">STARTING OPENCV...</span>
          </div>
        )}

        {trackingStatus.error && (
          <div className="video-overlay-msg error text-[10px]">
            <VideoOff className="text-red-400 mb-1" size={16} />
            <span>{trackingStatus.error}</span>
          </div>
        )}

        <div className="pip-header bg-slate-950/90 backdrop-blur px-2 py-0.5 rounded text-[10px] text-emerald-400 font-orbitron flex items-center justify-between border border-emerald-500/40 w-full">
          <div className="flex items-center gap-1">
            <Camera size={10} className="text-emerald-400" />
            <span>OPENCV PIP</span>
          </div>

          <button
            onClick={togglePos}
            className="text-[9px] text-cyan-300 hover:text-white flex items-center gap-0.5 bg-slate-800 px-1 py-0.5 rounded transition"
            title="Toggle PIP position on Canvas"
          >
            <Move size={8} />
            <span>POS</span>
          </button>
        </div>
      </div>

      {/* Live Vision Status Dashboard */}
      <div className="p-1.5 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono">
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${trackingStatus.handDetected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-900 text-slate-500'}`}>
          <Hand size={12} />
          <span>{trackingStatus.handDetected ? 'HAND LOCK' : 'NO HAND'}</span>
        </div>

        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${trackingStatus.winkDetected ? 'bg-pink-500/30 text-pink-400 border border-pink-500/50 animate-pulse' : 'bg-slate-900 text-slate-400'}`}>
          <Eye size={12} />
          <span>{trackingStatus.winkDetected ? '💥 WINK!' : `EAR ${trackingStatus.leftEyeEAR}`}</span>
        </div>
      </div>
    </div>
  );
}
