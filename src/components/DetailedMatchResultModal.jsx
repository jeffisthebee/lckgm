import React, { useState } from 'react';

export default function DetailedMatchResultModal({ result, onClose, teamA, teamB }) {
    const [activeSet, setActiveSet] = useState(0); 
    
    // Safety check in case history is empty
    if (!result || !result.history || result.history.length === 0) return null;

    const currentSetData = result.history[activeSet];
    const picksBlue = currentSetData.picks.A || [];
    const picksRed = currentSetData.picks.B || [];
    const bansBlue = currentSetData.bans.A || [];
    const bansRed = currentSetData.bans.B || [];
    const fearlessBans = currentSetData.fearlessBans || [];
    
    // [NEW] Extract POG and POS
    const pogPlayer = currentSetData.pogPlayer; 
    const posPlayer = result.posPlayer; // Passed from LiveGamePlayer on match completion
    
    // Helper to format Game Time if available
    const gameTimeStr = currentSetData.gameTime || 
        (currentSetData.totalMinutes ? `${currentSetData.totalMinutes}분` : 'Unknown Time');

    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-95 flex items-center justify-center p-4">
        <div className="bg-gray-100 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
          
          {/* === HEADER === */}
          <div className="bg-black text-white p-6 shrink-0 relative overflow-hidden">
            <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-6">
                  <div className="text-4xl font-black text-blue-500">{result.scoreA || 0}</div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 font-bold tracking-widest">FINAL SCORE</span>
                    <span className="text-2xl font-black italic">VS</span>
                  </div>
                  <div className="text-4xl font-black text-red-500">{result.scoreB || 0}</div>
                </div>

                {/* [NEW] POS DISPLAY (Series MVP) */}
                {posPlayer && (
                    <div className="flex items-center gap-4 bg-purple-900/80 border border-purple-500 px-6 py-2 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-purple-300 font-bold tracking-widest">SERIES MVP</span>
                            <span className="text-xl font-black text-white">{posPlayer.playerName}</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center border-2 border-white shadow-lg text-lg">
                            👑
                        </div>
                        <div className="flex flex-col">
                             <span className="text-xs text-gray-300">{posPlayer.playerData?.포지션 || 'Player'}</span>
                             <span className="text-[10px] text-purple-400 font-mono">Score: {posPlayer.totalScore?.toFixed(1)}</span>
                        </div>
                    </div>
                )}

                <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold transition">
                  CLOSE
                </button>
            </div>
            
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-red-900/20 pointer-events-none"></div>
          </div>

          {/* === SET TABS === */}
          <div className="flex bg-gray-200 border-b border-gray-300 overflow-x-auto shrink-0">
             {result.history.map((h, i) => (
               <button 
                 key={i}
                 onClick={() => setActiveSet(i)}
                 className={`px-8 py-4 font-bold text-sm uppercase tracking-wider transition-all ${
                   activeSet === i 
                   ? 'bg-white text-black border-b-4 border-black shadow-inner' 
                   : 'text-gray-500 hover:text-gray-800 hover:bg-gray-300'
                 }`}
               >
                 Set {h.setNumber || i + 1}
               </button>
             ))}
          </div>

          {/* === CONTENT === */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            
            {/* GAME INFO BAR */}
            <div className="flex justify-between items-center mb-6">
                 <div className="flex gap-2">
                     <span className="bg-gray-800 text-white px-3 py-1 rounded text-xs font-bold">
                        ⏱ {gameTimeStr}
                     </span>
                     <span className={`px-3 py-1 rounded text-xs font-bold ${currentSetData.winner === teamA.name ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        🏆 WINNER: {currentSetData.winner}
                     </span>
                 </div>

                 {/* [NEW] POG CARD (Small Version) */}
                 {pogPlayer && (
                     <div className="flex items-center gap-3 bg-yellow-100 border border-yellow-300 px-4 py-1 rounded-full shadow-sm">
                         <span className="text-[10px] font-bold text-yellow-800 bg-yellow-300 px-2 rounded">POG</span>
                         <span className="font-bold text-sm text-gray-800">{pogPlayer.playerName}</span>
                         <span className="text-xs text-gray-600">({pogPlayer.champName})</span>
                         <span className="text-[10px] font-mono text-gray-500">Score: {pogPlayer.pogScore?.toFixed(1)}</span>
                     </div>
                 )}
            </div>

            {/* BANS ROW */}
            <div className="grid grid-cols-2 gap-8 mb-8">
               {/* Blue Bans */}
               <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <span className="text-blue-600 font-bold text-xs w-12">BLUE BANS</span>
                  <div className="flex gap-1">
                     {[0,1,2,3,4].map(idx => (
                       <div key={idx} className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-[9px] font-bold text-gray-500">
                          {bansBlue[idx] || '-'}
                       </div>
                     ))}
                  </div>
               </div>
               {/* Red Bans */}
               <div className="flex items-center justify-end gap-2 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                  <div className="flex gap-1">
                     {[0,1,2,3,4].map(idx => (
                       <div key={idx} className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-[9px] font-bold text-gray-500">
                          {bansRed[idx] || '-'}
                       </div>
                     ))}
                  </div>
                  <span className="text-red-600 font-bold text-xs w-12 text-right">RED BANS</span>
               </div>
            </div>

            {/* PICKS (PLAYERS) */}
            <div className="flex gap-8 relative">
              {/* VS Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-black text-gray-500 z-10 border-4 border-gray-50 text-xs">
                  VS
              </div>

              {/* BLUE TEAM LIST */}
              <div className="w-1/2 space-y-2">
                 <h3 className="font-black text-blue-600 uppercase text-sm mb-2 px-2 flex justify-between">
                     <span>{teamA.name}</span>
                     <span>K / D / A (Gold)</span>
                 </h3>
                 <div className="space-y-2">
                   {picksBlue.map((p, i) => {
                       const isPog = pogPlayer && pogPlayer.playerName === p.playerName;
                       return (
                         <div key={i} className={`flex items-center bg-white border-l-4 ${isPog ? 'border-yellow-400 ring-2 ring-yellow-400/50 z-10' : 'border-blue-500'} p-3 rounded shadow-sm relative overflow-hidden`}>
                            <div className="w-8 text-center font-bold text-gray-400 text-xs mr-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                            
                            {/* Champ Info */}
                            <div className="flex-1">
                              <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                  {p.champName}
                                  {/* POG BADGE */}
                                  {isPog && <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">POG</span>}
                              </div>
                              <div className="text-[10px] text-gray-500">{p.tier}티어 {p.classType}</div>
                            </div>

                            {/* [UPDATED] Stats & Name */}
                            <div className="text-right z-10 flex flex-col items-end">
                              <div className="font-bold text-gray-900 text-sm">{p.playerName}</div>
                              <div className="text-xs font-mono font-bold text-gray-600">
                                  {p.k ?? p.stats?.kills ?? 0} / <span className="text-red-500">{p.d ?? p.stats?.deaths ?? 0}</span> / {p.a ?? p.stats?.assists ?? 0}
                              </div>
                              <div className="text-[10px] text-yellow-600 font-bold">
                                  {Math.floor((p.currentGold || 0)/1000)}.{Math.floor(((p.currentGold || 0)%1000)/100)}k G
                              </div>
                            </div>
                            
                            {/* Gradient BG */}
                            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-blue-50 to-transparent opacity-50 pointer-events-none"></div>
                         </div>
                       );
                   })}
                 </div>
              </div>

              {/* RED TEAM LIST */}
              <div className="w-1/2 space-y-2">
                 <h3 className="font-black text-red-600 uppercase text-sm mb-2 px-2 text-right flex justify-between flex-row-reverse">
                     <span>{teamB.name}</span>
                     <span>K / D / A (Gold)</span>
                 </h3>
                 <div className="space-y-2">
                   {picksRed.map((p, i) => {
                       const isPog = pogPlayer && pogPlayer.playerName === p.playerName;
                       return (
                         <div key={i} className={`flex flex-row-reverse items-center bg-white border-r-4 ${isPog ? 'border-yellow-400 ring-2 ring-yellow-400/50 z-10' : 'border-red-500'} p-3 rounded shadow-sm relative overflow-hidden`}>
                            <div className="w-8 text-center font-bold text-gray-400 text-xs ml-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                            
                            {/* Champ Info */}
                            <div className="flex-1 text-right">
                              <div className="font-bold text-gray-800 text-sm flex items-center justify-end gap-2">
                                  {isPog && <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.5 rounded font-black shadow-sm">POG</span>}
                                  {p.champName}
                              </div>
                              <div className="text-[10px] text-gray-500">{p.tier}티어 {p.classType}</div>
                            </div>

                            {/* [UPDATED] Stats & Name */}
                            <div className="text-left z-10 flex flex-col items-start mr-3">
                              <div className="font-bold text-gray-900 text-sm">{p.playerName}</div>
                              <div className="text-xs font-mono font-bold text-gray-600">
                                  {p.k ?? p.stats?.kills ?? 0} / <span className="text-red-500">{p.d ?? p.stats?.deaths ?? 0}</span> / {p.a ?? p.stats?.assists ?? 0}
                              </div>
                              <div className="text-[10px] text-yellow-600 font-bold">
                                  {Math.floor((p.currentGold || 0)/1000)}.{Math.floor(((p.currentGold || 0)%1000)/100)}k G
                              </div>
                            </div>

                            {/* Gradient BG */}
                            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-red-50 to-transparent opacity-50 pointer-events-none"></div>
                         </div>
                       );
                   })}
                 </div>
              </div>
            </div>

            {/* FEARLESS BANS SECTION */}
            {fearlessBans.length > 0 && (
                <div className="mt-8 bg-gray-200 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Cumulative Fearless Bans Used</div>
                    <div className="flex justify-center gap-2 flex-wrap">
                        {fearlessBans.map((b, idx) => (
                            <span key={idx} className="bg-gray-700 text-white text-xs px-2 py-0.5 rounded opacity-70 line-through">{b}</span>
                        ))}
                    </div>
                </div>
            )}
  
            {/* LOGS */}
            <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
               <h4 className="font-bold text-gray-500 mb-2 text-sm uppercase">Game Logs</h4>
               <div className="space-y-1 font-mono text-sm h-32 overflow-y-auto pr-2 custom-scrollbar">
                 {currentSetData.logs.map((l, i) => (
                    <div key={i} className={`truncate ${l.includes('킬') ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                        {l}
                    </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
}