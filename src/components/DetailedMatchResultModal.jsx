// src/components/DetailedMatchResultModal.jsx
import React, { useState } from 'react';

export default function DetailedMatchResultModal({ result, onClose, teamA, teamB }) {
    const [activeSet, setActiveSet] = useState(0); 
    
    // Safety check
    if (!result || !result.history || result.history.length === 0) return null;

    // [FIX 1] Parse Match Score (e.g. "2:1") correctly
    let matchScoreA = 0;
    let matchScoreB = 0;
    if (result.score && typeof result.score === 'string' && result.score.includes(':')) {
        const parts = result.score.split(':');
        matchScoreA = parts[0];
        matchScoreB = parts[1];
    } else {
        matchScoreA = result.scoreA || 0;
        matchScoreB = result.scoreB || 0;
    }

    const currentSetData = result.history[activeSet];
    const picksBlue = currentSetData.picks.A || [];
    const picksRed = currentSetData.picks.B || [];
    const bansBlue = currentSetData.bans.A || [];
    const bansRed = currentSetData.bans.B || [];
    const fearlessBans = currentSetData.fearlessBans || [];
    
    const pogPlayer = currentSetData.pogPlayer; 
    const posPlayer = result.posPlayer; 
    
    const gameTimeStr = currentSetData.gameTime || 
        (currentSetData.totalMinutes ? `${currentSetData.totalMinutes}분` : 'Unknown Time');

    // [FIX 2] Get Kill Scores for this specific Set
    const killScoreA = currentSetData.scores?.A || 0;
    const killScoreB = currentSetData.scores?.B || 0;

    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-95 flex items-center justify-center p-0 lg:p-4">
        <div className="bg-gray-100 rounded-none lg:rounded-2xl w-full max-w-6xl h-full lg:h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
          
          {/* === HEADER (MATCH SCORE) === */}
          <div className="bg-black text-white p-3 lg:p-6 shrink-0 relative overflow-hidden flex justify-between items-center z-10">
            <div className="flex items-center gap-4 lg:gap-6">
                <div className="text-3xl lg:text-5xl font-black text-blue-500">{matchScoreA}</div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] lg:text-xs text-gray-400 font-bold tracking-widest hidden sm:block">FINAL</span>
                    <span className="text-xl lg:text-2xl font-black italic text-white">VS</span>
                </div>
                <div className="text-3xl lg:text-5xl font-black text-red-500">{matchScoreB}</div>
            </div>

            {/* POS DISPLAY (Series MVP) */}
            {posPlayer && (
                <div className="flex items-center gap-2 lg:gap-4 bg-purple-900/80 border border-purple-500 px-3 py-1 lg:px-6 lg:py-2 rounded-lg lg:rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] lg:text-[10px] text-purple-300 font-bold tracking-widest">MVP</span>
                        <span className="text-xs lg:text-xl font-black text-white truncate max-w-[120px] lg:max-w-none">{posPlayer.playerName}</span>
                    </div>
                    <div className="w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-purple-600 flex items-center justify-center border-2 border-white shadow-lg text-xs lg:text-lg">
                        👑
                    </div>
                    <div className="hidden lg:flex flex-col">
                            <span className="text-xs text-gray-300">{posPlayer.playerData?.포지션 || 'Player'}</span>
                            <span className="text-[10px] text-purple-400 font-mono">Score: {posPlayer.totalScore?.toFixed(1)}</span>
                    </div>
                </div>
            )}

            <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg font-bold transition text-xs lg:text-base">
                ✖ <span className="hidden sm:inline">CLOSE</span>
            </button>
            
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-red-900/20 pointer-events-none -z-10"></div>
          </div>

          {/* === SET TABS === */}
          <div className="flex bg-gray-200 border-b border-gray-300 overflow-x-auto shrink-0 scrollbar-hide">
             {result.history.map((h, i) => (
               <button 
                 key={i}
                 onClick={() => setActiveSet(i)}
                 className={`px-4 py-3 lg:px-8 lg:py-4 font-bold text-xs lg:text-sm uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${
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
          <div className="flex-1 overflow-y-auto p-2 lg:p-6 bg-gray-50">
            
            {/* GAME INFO BAR */}
            <div className="flex flex-wrap lg:flex-nowrap justify-between items-center mb-3 lg:mb-6 bg-white p-2 lg:p-4 rounded-xl border border-gray-200 shadow-sm gap-2">
                 <div className="flex items-center gap-2 lg:gap-6 flex-wrap">
                     {/* Game Time */}
                     <span className="bg-gray-800 text-white px-2 py-1 lg:px-3 rounded text-[10px] lg:text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                        <span>⏱</span> {gameTimeStr}
                     </span>
                     
                     {/* Kill Score */}
                     <div className="flex items-center gap-2 lg:gap-3 bg-gray-100 px-3 py-1 rounded-full border border-gray-300">
                        <span className="text-xs lg:text-sm font-black text-blue-600 truncate max-w-[50px] lg:max-w-none">{teamA.name}</span>
                        <div className="flex items-center gap-1 text-sm lg:text-xl font-black text-gray-800">
                            <span>{killScoreA}</span>
                            <span className="text-gray-400 text-xs lg:text-sm">:</span>
                            <span>{killScoreB}</span>
                        </div>
                        <span className="text-xs lg:text-sm font-black text-red-600 truncate max-w-[50px] lg:max-w-none">{teamB.name}</span>
                        <span className="hidden lg:inline text-[10px] text-gray-500 font-bold ml-2 uppercase">Kills</span>
                     </div>

                     <span className={`px-2 py-1 lg:px-3 rounded text-[10px] lg:text-xs font-bold whitespace-nowrap ${currentSetData.winner === teamA.name ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        🏆 {currentSetData.winner} WIN
                     </span>
                 </div>

                 {/* POG CARD */}
                 {pogPlayer && (
                     <div className="flex items-center gap-2 lg:gap-3 bg-yellow-100 border border-yellow-300 px-2 py-1 lg:px-4 rounded-full shadow-sm ml-auto">
                         <span className="text-[9px] lg:text-[10px] font-bold text-yellow-800 bg-yellow-300 px-1.5 rounded">POG</span>
                         <span className="font-bold text-xs lg:text-sm text-gray-800 truncate max-w-[100px] lg:max-w-none">{pogPlayer.playerName}</span>
                         <span className="hidden lg:inline text-xs text-gray-600">({pogPlayer.champName})</span>
                         <span className="hidden lg:inline text-[10px] font-mono text-gray-500">Score: {pogPlayer.pogScore?.toFixed(1)}</span>
                     </div>
                 )}
            </div>

            {/* BANS ROW - FIX: Variable width boxes */}
            <div className="grid grid-cols-2 gap-2 lg:gap-8 mb-4 lg:mb-8">
               {/* Blue Bans */}
               <div className="flex items-center gap-1 lg:gap-2 bg-white p-1.5 lg:p-3 rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                  <span className="text-blue-600 font-bold text-[9px] lg:text-xs w-8 lg:w-12 shrink-0 leading-tight">BLUE BANS</span>
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                     {[0,1,2,3,4].map(idx => (
                       <div key={idx} className="h-6 lg:h-8 bg-gray-200 rounded flex items-center justify-center text-[8px] lg:text-[9px] font-bold text-gray-500 shrink-0 px-2 w-auto min-w-[1.5rem] whitespace-nowrap">
                          {bansBlue[idx] || '-'}
                       </div>
                     ))}
                  </div>
               </div>
               {/* Red Bans */}
               <div className="flex items-center justify-end gap-1 lg:gap-2 bg-white p-1.5 lg:p-3 rounded-lg border border-red-100 shadow-sm overflow-hidden">
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide justify-end">
                     {[0,1,2,3,4].map(idx => (
                       <div key={idx} className="h-6 lg:h-8 bg-gray-200 rounded flex items-center justify-center text-[8px] lg:text-[9px] font-bold text-gray-500 shrink-0 px-2 w-auto min-w-[1.5rem] whitespace-nowrap">
                          {bansRed[idx] || '-'}
                       </div>
                     ))}
                  </div>
                  <span className="text-red-600 font-bold text-[9px] lg:text-xs w-8 lg:w-12 text-right shrink-0 leading-tight">RED BANS</span>
               </div>
            </div>

            {/* PICKS (PLAYERS) */}
            <div className="flex gap-2 lg:gap-8 relative">
              {/* VS Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 lg:w-10 lg:h-10 bg-gray-300 rounded-full flex items-center justify-center font-black text-gray-500 z-10 border-2 lg:border-4 border-gray-50 text-[10px] lg:text-xs">
                  VS
              </div>

              {/* BLUE TEAM LIST */}
              <div className="w-1/2 space-y-1 lg:space-y-2">
                 <h3 className="font-black text-blue-600 uppercase text-[10px] lg:text-sm mb-1 lg:mb-2 px-1 lg:px-2 flex justify-between">
                     <span className="truncate">{teamA.name}</span>
                     <span className="hidden sm:inline">K/D/A</span>
                 </h3>
                 <div className="space-y-1 lg:space-y-2">
                   {picksBlue.map((p, i) => {
                       const isPog = pogPlayer && pogPlayer.playerName === p.playerName;
                       return (
                         <div key={i} className={`flex items-center bg-white border-l-2 lg:border-l-4 ${isPog ? 'border-yellow-400 ring-1 lg:ring-2 ring-yellow-400/50 z-10' : 'border-blue-500'} p-1.5 lg:p-3 rounded shadow-sm relative overflow-hidden h-12 lg:h-auto`}>
                            {/* Role */}
                            <div className="w-4 lg:w-8 text-center font-bold text-gray-400 text-[8px] lg:text-xs mr-1 lg:mr-2 shrink-0">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                            
                            {/* Champ Info - FIX: No truncate, allow wrap */}
                            <div className="flex-1">
                              <div className="font-bold text-gray-800 text-xs lg:text-sm flex items-center gap-1 lg:gap-2 whitespace-normal leading-tight">
                                  {p.champName}
                                  {/* POG BADGE */}
                                  {isPog && <span className="bg-yellow-400 text-black text-[8px] lg:text-[9px] px-1 lg:px-1.5 py-0.5 rounded font-black shadow-sm shrink-0">POG</span>}
                              </div>
                              <div className="text-[8px] lg:text-[10px] text-gray-500 truncate">{p.tier}티어 <span className="hidden lg:inline">{p.classType}</span></div>
                            </div>

                            {/* Stats & Name */}
                            <div className="text-right z-10 flex flex-col items-end shrink-0 ml-1">
                              <div className="font-bold text-gray-900 text-[10px] lg:text-sm truncate max-w-[120px] sm:max-w-none">{p.playerName}</div>
                              <div className="text-[9px] lg:text-xs font-mono font-bold text-gray-600">
                                  {p.k ?? p.stats?.kills ?? 0}/<span className="text-red-500">{p.d ?? p.stats?.deaths ?? 0}</span>/{p.a ?? p.stats?.assists ?? 0}
                              </div>
                              <div className="text-[8px] lg:text-[10px] text-yellow-600 font-bold hidden sm:block">
                                  {Math.floor((p.currentGold || 0)/1000)}.{Math.floor(((p.currentGold || 0)%1000)/100)}k
                              </div>
                            </div>
                            
                            <div className="absolute left-0 top-0 bottom-0 w-8 lg:w-16 bg-gradient-to-r from-blue-50 to-transparent opacity-50 pointer-events-none"></div>
                         </div>
                       );
                   })}
                 </div>
              </div>

              {/* RED TEAM LIST */}
              <div className="w-1/2 space-y-1 lg:space-y-2">
                 <h3 className="font-black text-red-600 uppercase text-[10px] lg:text-sm mb-1 lg:mb-2 px-1 lg:px-2 text-right flex justify-between flex-row-reverse">
                     <span className="truncate">{teamB.name}</span>
                     <span className="hidden sm:inline">K/D/A</span>
                 </h3>
                 <div className="space-y-1 lg:space-y-2">
                   {picksRed.map((p, i) => {
                       const isPog = pogPlayer && pogPlayer.playerName === p.playerName;
                       return (
                         <div key={i} className={`flex flex-row-reverse items-center bg-white border-r-2 lg:border-r-4 ${isPog ? 'border-yellow-400 ring-1 lg:ring-2 ring-yellow-400/50 z-10' : 'border-red-500'} p-1.5 lg:p-3 rounded shadow-sm relative overflow-hidden h-12 lg:h-auto`}>
                            {/* Role */}
                            <div className="w-4 lg:w-8 text-center font-bold text-gray-400 text-[8px] lg:text-xs ml-1 lg:ml-2 shrink-0">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                            
                            {/* Champ Info - FIX: No truncate, allow wrap */}
                            <div className="flex-1 text-right">
                              <div className="font-bold text-gray-800 text-xs lg:text-sm flex items-center justify-end gap-1 lg:gap-2 whitespace-normal leading-tight">
                                  {isPog && <span className="bg-yellow-400 text-black text-[8px] lg:text-[9px] px-1 lg:px-1.5 py-0.5 rounded font-black shadow-sm shrink-0">POG</span>}
                                  {p.champName}
                              </div>
                              <div className="text-[8px] lg:text-[10px] text-gray-500 truncate">{p.tier}티어 <span className="hidden lg:inline">{p.classType}</span></div>
                            </div>

                            {/* Stats & Name */}
                            <div className="text-left z-10 flex flex-col items-start mr-1 shrink-0">
                              <div className="font-bold text-gray-900 text-[10px] lg:text-sm truncate max-w-[120px] sm:max-w-none">{p.playerName}</div>
                              <div className="text-[9px] lg:text-xs font-mono font-bold text-gray-600">
                                  {p.k ?? p.stats?.kills ?? 0}/<span className="text-red-500">{p.d ?? p.stats?.deaths ?? 0}</span>/{p.a ?? p.stats?.assists ?? 0}
                              </div>
                              <div className="text-[8px] lg:text-[10px] text-yellow-600 font-bold hidden sm:block">
                                  {Math.floor((p.currentGold || 0)/1000)}.{Math.floor(((p.currentGold || 0)%1000)/100)}k
                              </div>
                            </div>

                            <div className="absolute right-0 top-0 bottom-0 w-8 lg:w-16 bg-gradient-to-l from-red-50 to-transparent opacity-50 pointer-events-none"></div>
                         </div>
                       );
                   })}
                 </div>
              </div>
            </div>

            {/* FEARLESS BANS SECTION */}
            {fearlessBans.length > 0 && (
                <div className="mt-4 lg:mt-8 bg-gray-200 rounded-lg p-2 lg:p-3 text-center">
                    <div className="text-[8px] lg:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Cumulative Fearless Bans Used</div>
                    <div className="flex justify-center gap-1 lg:gap-2 flex-wrap">
                        {fearlessBans.map((b, idx) => (
                            <span key={idx} className="bg-gray-700 text-white text-[9px] lg:text-xs px-1.5 py-0.5 rounded opacity-70 line-through">{b}</span>
                        ))}
                    </div>
                </div>
            )}
  
            {/* LOGS */}
            <div className="mt-4 lg:mt-6 bg-white rounded-xl p-3 lg:p-4 border border-gray-200 shadow-sm">
               <h4 className="font-bold text-gray-500 mb-2 text-xs lg:text-sm uppercase">Game Logs</h4>
               <div className="space-y-1 font-mono text-[10px] lg:text-sm h-24 lg:h-32 overflow-y-auto pr-2 custom-scrollbar">
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