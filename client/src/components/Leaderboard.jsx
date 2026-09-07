import React, { useEffect, useState } from 'react';
import { Trophy, RefreshCw, Medal, Target, Clock, AlertCircle } from 'lucide-react';

export default function Leaderboard({ newScoreSubmitted }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [error, setError] = useState(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scores/leaderboard');
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.data || []);
        setSource(data.source);
        setError(null);
      } else {
        setError('Failed to fetch leaderboard stats.');
      }
    } catch (err) {
      console.warn('API error, relying on local view:', err);
      setError('Express API offline. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [newScoreSubmitted]);

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-5 text-white font-sans shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2 font-orbitron">
          <Trophy className="text-yellow-400" size={22} />
          <h2 className="text-lg font-bold text-cyan-300">CYBER LEADERBOARD</h2>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
          title="Refresh Scores"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {source && (
        <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
          <span>Data Store: <strong className="text-cyan-400">{source}</strong></span>
          <span className="text-slate-500">Goal: Defeat 10 Enemies</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded mb-3 border border-amber-500/20">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">
          Loading High Scores...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">
          No recorded high scores yet. Complete a game to be the first!
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => {
            const isTop3 = index < 3;
            const medalColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

            return (
              <div
                key={entry._id || index}
                className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition ${
                  index === 0
                    ? 'bg-gradient-to-r from-yellow-500/20 to-slate-800 border border-yellow-500/30'
                    : 'bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center font-extrabold text-sm">
                    {isTop3 ? (
                      <Medal className={`inline ${medalColors[index]}`} size={16} />
                    ) : (
                      `#${index + 1}`
                    )}
                  </span>
                  <div>
                    <div className="font-bold text-slate-200">{entry.username}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span><Target className="inline" size={10} /> {entry.enemiesShot}/10 Shot</span>
                      <span><Clock className="inline" size={10} /> {entry.durationSeconds || 0}s</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-cyan-300 text-sm font-orbitron">{entry.score} pts</div>
                  <div className="text-[10px] text-emerald-400">{entry.accuracy || 0}% Acc</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
