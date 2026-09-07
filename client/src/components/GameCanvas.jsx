import React, { useEffect, useRef, useState } from 'react';
import { soundSynth } from '../utils/audioSynth';
import confetti from 'canvas-confetti';

export default function GameCanvas({
  aimPos,
  shootTriggered,
  gameState,
  onGameComplete,
  onGameOverBomb,
  onScoreUpdate
}) {
  const canvasRef = useRef(null);
  const [banner, setBanner] = useState(null);

  const itemsRef = useRef([]); // Flying fruits and bombs
  const slicedHalvesRef = useRef([]);
  const juiceParticlesRef = useRef([]);
  const sliceTrailsRef = useRef([]);
  const scorePopupsRef = useRef([]);
  const screenShakeRef = useRef(0);
  const prevAimPosRef = useRef({ x: 0.5, y: 0.5 });
  const lastSpawnTimeRef = useRef(0);

  const statsRef = useRef({
    score: 0,
    enemiesShot: 0,
    totalEnemies: 10,
    shotsFired: 0,
    accuracy: 0,
    startTime: 0
  });

  const lastShootStateRef = useRef(false);

  // Available Fruit Definitions
  const fruitDefs = [
    { type: 'fruit', name: 'Watermelon', emoji: '🍉', color: '#00FF00', juiceColor: '#DC2626', radius: 46, points: 100 },
    { type: 'fruit', name: 'Red Apple', emoji: '🍎', color: '#00FF00', juiceColor: '#B91C1C', radius: 38, points: 120 },
    { type: 'fruit', name: 'Banana', emoji: '🍌', color: '#00FF00', juiceColor: '#EAB308', radius: 40, points: 140 },
    { type: 'fruit', name: 'Sweet Orange', emoji: '🍊', color: '#00FF00', juiceColor: '#EA580C', radius: 38, points: 130 },
    { type: 'fruit', name: 'Pineapple', emoji: '🍍', color: '#00FF00', juiceColor: '#D97706', radius: 44, points: 180 },
    { type: 'fruit', name: 'Strawberry', emoji: '🍓', color: '#00FF00', juiceColor: '#E11D48', radius: 34, points: 150 },
    { type: 'fruit', name: 'Fresh Kiwi', emoji: '🥝', color: '#00FF00', juiceColor: '#65A30D', radius: 36, points: 160 },
    { type: 'fruit', name: 'Coconut', emoji: '🥥', color: '#00FF00', juiceColor: '#FEF08A', radius: 42, points: 200 },
    { type: 'fruit', name: 'Juicy Grapes', emoji: '🍇', color: '#00FF00', juiceColor: '#7E22CE', radius: 38, points: 170 },
    { type: 'fruit', name: 'Peach', emoji: '🍑', color: '#00FF00', juiceColor: '#DB2777', radius: 37, points: 190 }
  ];

  // Spawn Fruit / Bomb Wave launching upward from bottom
  const spawnWave = (width, height) => {
    const waveCount = 2 + Math.floor(Math.random() * 2); // 2-3 items
    for (let i = 0; i < waveCount; i++) {
      // 22% chance to spawn a Bomb 💣
      const isBomb = Math.random() < 0.22;
      let itemData;

      if (isBomb) {
        itemData = {
          type: 'bomb',
          name: 'DANGER BOMB',
          emoji: '💣',
          color: '#FF0055',
          radius: 44,
          points: 0
        };
      } else {
        const randFruit = fruitDefs[Math.floor(Math.random() * fruitDefs.length)];
        itemData = { ...randFruit };
      }

      const spawnX = 140 + Math.random() * (width - 280);
      const spawnY = height + 40; // Below canvas
      const vx = (Math.random() - 0.5) * 5.5;
      const vy = -(13.5 + Math.random() * 4.5); // Arc velocity

      itemsRef.current.push({
        id: Date.now() + Math.random(),
        ...itemData,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.12,
        alive: true
      });
    }
  };

  // Reset Game State for New Match
  const resetGame = (width, height) => {
    itemsRef.current = [];
    slicedHalvesRef.current = [];
    juiceParticlesRef.current = [];
    sliceTrailsRef.current = [];
    scorePopupsRef.current = [];
    screenShakeRef.current = 0;

    statsRef.current = {
      score: 0,
      enemiesShot: 0,
      totalEnemies: 10,
      shotsFired: 0,
      accuracy: 0,
      startTime: Date.now()
    };

    onScoreUpdate(statsRef.current);
    spawnWave(width, height);
  };

  // Check Line Segment Collision (Hand Blade Swipe) to Item Center
  const checkLineSlice = (x1, y1, x2, y2, cx, cy, r) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) <= r;

    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(cx - projX, cy - projY) <= r;
  };

  // Process OpenCV Hand Gesture Slice
  const processSliceAction = (x1, y1, x2, y2, isBlast = false) => {
    if (gameState !== 'PLAYING') return;

    sliceTrailsRef.current.push({
      x: x2,
      y: y2,
      alpha: 1.0
    });

    itemsRef.current.forEach((item) => {
      if (item.alive) {
        const isHit = checkLineSlice(x1, y1, x2, y2, item.x, item.y, item.radius + 18);
        if (isHit) {
          item.alive = false;

          // IF BOMB HIT -> GAME OVER OUT! 💣💥
          if (item.type === 'bomb') {
            soundSynth.playExplosion();
            screenShakeRef.current = 30; // Huge explosion shake

            // Massive Bomb Blast Particles
            for (let p = 0; p < 60; p++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 12 + 3;
              juiceParticlesRef.current.push({
                x: item.x,
                y: item.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.5 ? '#FF0055' : '#FFB800',
                radius: Math.random() * 8 + 4,
                alpha: 1.0,
                decay: 0.02
              });
            }

            setBanner('💣 BOMB DETONATED! GAME OVER!');
            onGameOverBomb({
              ...statsRef.current,
              durationSeconds: Math.round((Date.now() - statsRef.current.startTime) / 1000)
            });
            return;
          }

          // IF FRUIT SLICED 🍉
          soundSynth.playLaser();
          statsRef.current.enemiesShot += 1;
          statsRef.current.score += item.points;

          setBanner(` 🍉 OPENCV CUT: ${item.name.toUpperCase()} (+${item.points} PTS)`);
          setTimeout(() => setBanner(null), 1200);

          // Spawn 2 Sliced Halves flying apart
          slicedHalvesRef.current.push(
            {
              emoji: item.emoji,
              x: item.x - 12,
              y: item.y,
              vx: -5 + (Math.random() - 0.5) * 2,
              vy: -6,
              rotation: item.rotation,
              vRot: -0.2,
              alpha: 1.0
            },
            {
              emoji: item.emoji,
              x: item.x + 12,
              y: item.y,
              vx: 5 + (Math.random() - 0.5) * 2,
              vy: -6,
              rotation: item.rotation,
              vRot: 0.2,
              alpha: 1.0
            }
          );

          // Juice Splash Particles
          for (let p = 0; p < 25; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 2;
            juiceParticlesRef.current.push({
              x: item.x,
              y: item.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: item.juiceColor,
              radius: Math.random() * 6 + 3,
              alpha: 1.0,
              decay: 0.025
            });
          }

          // Score Floating Text
          scorePopupsRef.current.push({
            text: `+${item.points}`,
            x: item.x,
            y: item.y,
            alpha: 1.0,
            color: '#00FF00'
          });

          // Update Stats
          const acc = Math.round((statsRef.current.enemiesShot / Math.max(1, statsRef.current.shotsFired + 1)) * 100);
          statsRef.current.accuracy = Math.min(100, acc);
          onScoreUpdate({ ...statsRef.current });

          // Check Win Condition (10 Fruits Sliced)
          if (statsRef.current.enemiesShot >= 10) {
            soundSynth.playVictory();
            confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
            const durationSeconds = Math.round((Date.now() - statsRef.current.startTime) / 1000);
            onGameComplete({
              ...statsRef.current,
              durationSeconds
            });
          }
        }
      }
    });
  };

  // Init Match when gameState changes to PLAYING
  useEffect(() => {
    if (gameState === 'PLAYING') {
      const canvas = canvasRef.current;
      if (canvas) {
        resetGame(canvas.width, canvas.height);
      }
    }
  }, [gameState]);

  // Handle Eye Shoot Trigger
  useEffect(() => {
    if (gameState === 'PLAYING' && shootTriggered && !lastShootStateRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const cx = aimPos.x * canvas.width;
        const cy = aimPos.y * canvas.height;
        statsRef.current.shotsFired += 1;
        processSliceAction(cx - 35, cy - 35, cx + 35, cy + 35, true);
      }
    }
    lastShootStateRef.current = shootTriggered;
  }, [shootTriggered, aimPos, gameState]);

  // Keyboard Spacebar listener to trigger Eye Shot fallback
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === 'PLAYING') {
          e.preventDefault();
          const canvas = canvasRef.current;
          if (canvas) {
            const cx = aimPos.x * canvas.width;
            const cy = aimPos.y * canvas.height;
            processSliceAction(cx - 35, cy - 35, cx + 35, cy + 35, true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, aimPos]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      ctx.save();

      // Screen Shake Shift
      let shakeX = 0;
      let shakeY = 0;
      if (screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        screenShakeRef.current *= 0.85;
        if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
      }

      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

      // OpenCV Vision Lab Dark Background
      ctx.fillStyle = '#020d18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // OpenCV Calibration Grid Lines
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.08)';
      ctx.lineWidth = 1;
      const step = 50;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // OpenCV Header Telemetry Overlay
      ctx.fillStyle = '#00FF00';
      ctx.font = '900 10px Orbitron, monospace';
      ctx.fillText('[OPENCV ENGINE v4.10.0 | MODE: WEBCAM HAND SKELETON GESTURE | FPS: 60]', 16, 24);

      // Continuous Wave Spawner
      const now = Date.now();
      if (gameState === 'PLAYING' && now - lastSpawnTimeRef.current > 2200) {
        lastSpawnTimeRef.current = now;
        spawnWave(canvas.width, canvas.height);
      }

      // Determine active Hand Pointer coordinates (STRICTLY FROM WEBCAM HAND TRACKER)
      const cx = aimPos.x * canvas.width;
      const cy = aimPos.y * canvas.height;

      const prevCx = prevAimPosRef.current.x * canvas.width;
      const prevCy = prevAimPosRef.current.y * canvas.height;

      // 1. Process Hand Movement Slicing Line Collision
      if (gameState === 'PLAYING') {
        const swipeDist = Math.hypot(cx - prevCx, cy - prevCy);
        if (swipeDist > 4) {
          processSliceAction(prevCx, prevCy, cx, cy, false);
        }
      }
      prevAimPosRef.current = { x: aimPos.x, y: aimPos.y };

      // 2. Render & Physics Update for Flying Fruits / Bombs with OpenCV Green Bounding Boxes
      itemsRef.current.forEach((item, idx) => {
        if (item.alive) {
          // Arc Physics Movement (vy + gravity)
          item.x += item.vx;
          item.y += item.vy;
          item.vy += 0.32; // Gravity pulling item back down
          item.rotation += item.vRot;

          ctx.save();

          const bx = item.x - item.radius - 8;
          const by = item.y - item.radius - 8;
          const bw = item.radius * 2 + 16;
          const bh = item.radius * 2 + 16;

          if (item.type === 'bomb') {
            // Draw Red Bounding Box for Danger Bomb
            ctx.strokeStyle = '#FF0055';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);

            // Corner Ticks (cv2 style)
            const tick = 10;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(bx, by + tick); ctx.lineTo(bx, by); ctx.lineTo(bx + tick, by);
            ctx.moveTo(bx + bw - tick, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + tick);
            ctx.moveTo(bx, by + bh - tick); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + tick, by + bh);
            ctx.moveTo(bx + bw - tick, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - tick);
            ctx.stroke();

            // Fruit Center Emoji
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation);
            ctx.font = `${item.radius * 1.2}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.emoji, 0, 0);
            ctx.restore();

            // OpenCV Tag Header
            ctx.fillStyle = '#FF0055';
            ctx.font = '900 9px Orbitron, monospace';
            ctx.fillText(`[CV WARN: BOMB 💣 | POS: (${Math.round(item.x)}, ${Math.round(item.y)})]`, bx, by - 6);
          } else {
            // Draw OpenCV Green Bounding Box (cv2.rectangle style)
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);

            // Corner Ticks
            const tick = 10;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(bx, by + tick); ctx.lineTo(bx, by); ctx.lineTo(bx + tick, by);
            ctx.moveTo(bx + bw - tick, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + tick);
            ctx.moveTo(bx, by + bh - tick); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + tick, by + bh);
            ctx.moveTo(bx + bw - tick, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - tick);
            ctx.stroke();

            // Fruit Emoji Center
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation);
            ctx.font = `${item.radius * 1.2}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.emoji, 0, 0);
            ctx.restore();

            // OpenCV Data Header Tag above Fruit
            ctx.fillStyle = '#00FF00';
            ctx.font = '900 9px Orbitron, monospace';
            ctx.fillText(`[CV DETECT: ${item.name.toUpperCase()} | CONF: 98.4%]`, bx, by - 6);
          }

          ctx.restore();

          // Remove item if fallen way past bottom
          if (item.y > canvas.height + 80) {
            itemsRef.current.splice(idx, 1);
          }
        }
      });

      // 3. Render Sliced Halves Gravity Physics
      slicedHalvesRef.current.forEach((half, idx) => {
        half.x += half.vx;
        half.y += half.vy;
        half.vy += 0.38; // Gravity
        half.rotation += half.vRot;
        half.alpha -= 0.015;

        ctx.save();
        ctx.translate(half.x, half.y);
        ctx.rotate(half.rotation);
        ctx.globalAlpha = Math.max(0, half.alpha);
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(half.emoji, 0, 0);
        ctx.restore();

        if (half.alpha <= 0 || half.y > canvas.height + 60) {
          slicedHalvesRef.current.splice(idx, 1);
        }
      });

      // 4. Render Juice Particles
      juiceParticlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= p.decay;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.alpha <= 0) juiceParticlesRef.current.splice(idx, 1);
      });

      // 5. Render Glowing OpenCV Blade Slash Trails
      sliceTrailsRef.current.forEach((trail, idx) => {
        ctx.save();
        ctx.strokeStyle = `rgba(0, 255, 0, ${trail.alpha})`;
        ctx.lineWidth = 10 * trail.alpha;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FF00';
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, 25 * (1 - trail.alpha + 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        trail.alpha -= 0.12;
        if (trail.alpha <= 0) sliceTrailsRef.current.splice(idx, 1);
      });

      // 6. Render Floating Score Popups
      scorePopupsRef.current.forEach((popup, idx) => {
        popup.y -= 1.8;
        popup.alpha -= 0.02;

        ctx.save();
        ctx.fillStyle = popup.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = popup.color;
        ctx.globalAlpha = Math.max(0, popup.alpha);
        ctx.font = '900 20px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();

        if (popup.alpha <= 0) scorePopupsRef.current.splice(idx, 1);
      });

      // 7. Draw OpenCV Player Hand Pointer Reticle (STRICTLY DRIVEN BY WEBCAM HAND TRACKER)
      ctx.save();
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00FF00';

      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00FF00';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();

      // Corner Reticle Ticks (cv2 style)
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 15, cy);
      ctx.moveTo(cx + 15, cy); ctx.lineTo(cx + 34, cy);
      ctx.moveTo(cx, cy - 34); ctx.lineTo(cx, cy - 15);
      ctx.moveTo(cx, cy + 15); ctx.lineTo(cx, cy + 34);
      ctx.stroke();

      ctx.fillStyle = '#00FF00';
      ctx.font = '900 10px Orbitron, monospace';
      ctx.fillText(`[OPENCV HAND TRACK: INDEX TIP (${Math.round(cx)}, ${Math.round(cy)})]`, cx + 28, cy + 4);

      ctx.restore();
      ctx.restore(); // Restore shake

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [aimPos, gameState]);

  return (
    <div className="game-canvas-wrapper relative w-full h-full">
      {banner && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-slate-950 font-orbitron font-extrabold px-6 py-2 rounded-full shadow-2xl z-30 text-xs border-2 border-white animate-pulse">
          {banner}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={1024}
        height={640}
        className="w-full h-full bg-slate-950 rounded-xl cursor-none shadow-2xl border-2 border-emerald-500/40"
      />
    </div>
  );
}
