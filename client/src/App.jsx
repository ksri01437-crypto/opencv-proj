import React, { useState, useCallback } from 'react';
import VisionRecognizer from './components/VisionRecognizer';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import Leaderboard from './components/Leaderboard';
import { Play, RotateCcw, Hand, Eye, ShieldAlert, Sparkles, CheckCircle2, Bomb, Flame } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAME_OVER, GAME_OVER_BOMB
  const [aimPos, setAimPos] = useState({ x: 0.5, y: 0.5 });
  const [shootTriggered, setShootTriggered] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.28);
  const [username, setUsername] = useState('FruitNinja');

  const [currentStats, setCurrentStats] = useState({
    score: 0,
    enemiesShot: 0,
    totalEnemies: 10,
    shotsFired: 0,
    accuracy: 0
  });

  const [lastGameResult, setLastGameResult] = useState(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmittedCount, setScoreSubmittedCount] = useState(0);

  // Aim update from MediaPipe Hand recognizer
  const handleAimUpdate = useCallback((x, y) => {
    setAimPos({ x, y });
  }, []);

  // Shoot trigger from MediaPipe Face Mesh Wink detector
  const handleShootTrigger = useCallback(() => {
    setShootTriggered(true);
    setTimeout(() => setShootTriggered(false), 150);
  }, []);

  // Start game loop
  const handleStartGame = () => {
    setGameState('PLAYING');
    setLastGameResult(null);
  };

  // Game complete event (all 10 fruits sliced)
  const handleGameComplete = async (finalStats) => {
    setGameState('GAME_OVER');
    setLastGameResult(finalStats);

    setSubmittingScore(true);
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || 'FruitNinja',
          score: finalStats.score,
          enemiesShot: finalStats.enemiesShot,
          totalEnemies: 10,
          accuracy: finalStats.accuracy,
          durationSeconds: finalStats.durationSeconds
        })
      });
      setScoreSubmittedCount((prev) => prev + 1);
    } catch (err) {
      console.error('Error submitting score to server:', err);
    } finally {
      setSubmittingScore(false);
    }
  };

  // Game Over event when player slices a Bomb 💣
  const handleGameOverBomb = (finalStats) => {
    setGameState('GAME_OVER_BOMB');
    setLastGameResult(finalStats);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Sci-Fi Arcade HUD */}
      <HUD
        stats={currentStats}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        username={username}
        onUsernameChange={setUsername}
      />

      {/* Main Play Area */}
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Game Canvas Container */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[520px]">
          {/* Main 2D Game Canvas */}
          <GameCanvas
            aimPos={aimPos}
            shootTriggered={shootTriggered}
            gameState={gameState}
            onGameComplete={handleGameComplete}
            onGameOverBomb={handleGameOverBomb}
            onScoreUpdate={setCurrentStats}
          />

          {/* Interactive Start Menu Overlay */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-8 text-center z-20 border-2 border-amber-500/40 shadow-2xl">
              <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl mb-4">
                <span className="text-5xl animate-bounce inline-block">🍉</span>
              </div>

              <h2 className="text-3xl md:text-4xl font-extrabold font-orbitron bg-gradient-to-r from-yellow-400 via-amber-400 to-red-500 bg-clip-text text-transparent mb-2">
                OPENCV FRUIT NINJA
              </h2>
              <p className="text-slate-300 max-w-lg text-sm mb-6">
                Slice flipping fruits using your <strong className="text-cyan-400 font-bold">Hand Blade Gesture</strong>. Avoid the <strong className="text-red-500 font-bold">DANGER BOMBS 💣</strong>! Cut 10 fruits to win!
              </p>

              {/* 3 Step Controls Legend */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-full max-w-2xl text-xs font-mono">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center shadow-lg">
                  <Hand className="text-cyan-400 mb-2" size={28} />
                  <span className="font-bold text-cyan-300 text-sm">1. HAND SLICER</span>
                  <span className="text-slate-400 text-[11px] mt-1">Point index finger to slice flying fruits</span>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center shadow-lg">
                  <Eye className="text-pink-400 mb-2" size={28} />
                  <span className="font-bold text-pink-300 text-sm">2. EYE WINK BLAST</span>
                  <span className="text-slate-400 text-[11px] mt-1">Wink eye to release shockwave slice</span>
                </div>
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center shadow-lg">
                  <Bomb className="text-red-500 mb-2" size={28} />
                  <span className="font-bold text-red-400 text-sm">3. AVOID BOMBS</span>
                  <span className="text-slate-400 text-[11px] mt-1">Don't touch bombs or it's game over!</span>
                </div>
              </div>

              <button
                onClick={handleStartGame}
                className="px-10 py-4 bg-gradient-to-r from-yellow-500 via-amber-600 to-red-600 hover:from-yellow-400 hover:to-red-500 font-orbitron font-extrabold text-slate-950 rounded-xl shadow-xl shadow-yellow-500/30 flex items-center gap-3 transition transform hover:scale-105 active:scale-95 text-lg"
              >
                <Play fill="currentColor" size={22} />
                START FRUIT MATCH (10 FRUITS)
              </button>
            </div>
          )}

          {/* Victory Modal Overlay */}
          {gameState === 'GAME_OVER' && lastGameResult && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-8 text-center z-20 border-2 border-yellow-500/50 shadow-2xl">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/40 rounded-full mb-3">
                <CheckCircle2 className="text-yellow-400" size={52} />
              </div>

              <h2 className="text-3xl font-extrabold font-orbitron text-yellow-400 mb-1">
                ALL 10 FRUITS SLICED! 🍉
              </h2>
              <p className="text-slate-400 text-xs mb-6 font-mono">NINJA MATCH COMPLETE • SCORE SAVED TO LEADERBOARD</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 w-full max-w-lg font-mono">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">FRUITS CUT</div>
                  <div className="text-xl font-bold text-yellow-400 font-orbitron">{lastGameResult.enemiesShot}/10</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">TOTAL SCORE</div>
                  <div className="text-xl font-bold text-amber-300 font-orbitron">{lastGameResult.score}</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">ACCURACY</div>
                  <div className="text-xl font-bold text-emerald-400 font-orbitron">{lastGameResult.accuracy}%</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">TIME TAKEN</div>
                  <div className="text-xl font-bold text-purple-400 font-orbitron">{lastGameResult.durationSeconds}s</div>
                </div>
              </div>

              <button
                onClick={handleStartGame}
                className="px-8 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 font-orbitron font-bold text-slate-950 rounded-xl shadow-lg flex items-center gap-2 transition transform hover:scale-105"
              >
                <RotateCcw size={20} />
                PLAY AGAIN
              </button>
            </div>
          )}

          {/* BOMB DETONATED GAME OVER MODAL */}
          {gameState === 'GAME_OVER_BOMB' && lastGameResult && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-8 text-center z-20 border-2 border-red-500/60 shadow-2xl">
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-full mb-3 animate-pulse">
                <Bomb className="text-red-500" size={56} />
              </div>

              <h2 className="text-3xl font-extrabold font-orbitron text-red-500 mb-1">
                BOOM! BOMB DETONATED! 💣💥
              </h2>
              <p className="text-slate-300 text-xs mb-6 font-mono">YOU SLICED A BOMB! GAME OVER</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 w-full max-w-md font-mono">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">FRUITS CUT BEFORE BOMB</div>
                  <div className="text-xl font-bold text-yellow-400 font-orbitron">{lastGameResult.enemiesShot}/10</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">SCORE</div>
                  <div className="text-xl font-bold text-amber-300 font-orbitron">{lastGameResult.score}</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400">SURVIVED TIME</div>
                  <div className="text-xl font-bold text-purple-400 font-orbitron">{lastGameResult.durationSeconds}s</div>
                </div>
              </div>

              <button
                onClick={handleStartGame}
                className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 font-orbitron font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition transform hover:scale-105"
              >
                <RotateCcw size={20} />
                TRY AGAIN (AVOID BOMBS)
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Vision Tracking PIP & MERN Leaderboard */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <VisionRecognizer
            onAimUpdate={handleAimUpdate}
            onShootTrigger={handleShootTrigger}
            isGameActive={gameState === 'PLAYING'}
            sensitivity={sensitivity}
          />

          <Leaderboard newScoreSubmitted={scoreSubmittedCount} />
        </div>
      </main>
    </div>
  );
}
