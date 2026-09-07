import React from 'react';
import { Target, Trophy, Flame, Crosshair, Eye, Hand, Settings } from 'lucide-react';

export default function HUD({
  stats,
  sensitivity,
  onSensitivityChange,
  username,
  onUsernameChange
}) {
  return (
    <div className="hud-overlay">
      {/* Top Arcade Navigation Bar */}
      <div className="hud-top-bar flex items-center justify-between px-6 py-3 bg-slate-900/90 backdrop-blur border-b border-amber-500/30 text-white font-orbitron">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 border border-amber-400/50 rounded-lg">
            <span className="text-2xl">🍉</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-400 to-red-500 bg-clip-text text-transparent">
              OPENCV FRUIT NINJA
            </h1>
            <p className="text-xs text-amber-300/70 font-sans">Computer Vision Gesture Fruit Slicer</p>
          </div>
        </div>

        {/* 10 Fruits Counter Badge */}
        <div className="flex items-center gap-6">
          <div className="hud-stat-card">
            <span className="label">FRUITS CUT</span>
            <div className="value-badge font-extrabold text-xl text-yellow-400">
              <span className="mr-1">🍓</span>
              {stats.enemiesShot} / {stats.totalEnemies || 10}
            </div>
          </div>

          <div className="hud-stat-card">
            <span className="label">SCORE</span>
            <div className="value-badge font-extrabold text-xl text-amber-300">
              <Trophy className="inline mr-1 text-amber-400" size={18} />
              {stats.score}
            </div>
          </div>

          <div className="hud-stat-card">
            <span className="label">ACCURACY</span>
            <div className="value-badge font-extrabold text-xl text-emerald-400">
              <Flame className="inline mr-1 text-emerald-400" size={18} />
              {stats.accuracy}%
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="hud-bottom-bar flex items-center justify-between px-6 py-2 bg-slate-950/80 backdrop-blur border-t border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-yellow-300">
            <Hand size={14} className="text-yellow-400" /> Move Index Finger to SLICE FRUITS
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 text-pink-400">
            <Eye size={14} className="text-pink-400" /> Wink / Pinch to SLASH
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Or Mouse / Spacebar</span>
        </div>

        {/* Sensitivity & Player Name Input */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-slate-400" />
            <span className="text-slate-400">Wink Sensitivity:</span>
            <input
              type="range"
              min="0.15"
              max="0.35"
              step="0.01"
              value={sensitivity}
              onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer"
            />
            <span className="text-amber-400 font-mono w-8">{sensitivity}</span>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <span className="text-slate-400">Player:</span>
            <input
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="FruitNinja"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-amber-300 focus:outline-none focus:border-amber-500 font-mono text-xs w-28"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
