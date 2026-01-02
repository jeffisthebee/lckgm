// src/components/DetailedMatchResultModal.jsx
import React, { useState } from 'react';

export default function DetailedMatchResultModal({ result, onClose, teamA, teamB }) {
    const [activeSet, setActiveSet] = useState(0); 
    
    const currentSetData = result.history[activeSet];
    const picksBlue = currentSetData.picks.A;
    const picksRed = currentSetData.picks.B;
    const bansBlue = currentSetData.bans.A;
    const bansRed = currentSetData.bans.B;
    const fearlessBans = currentSetData.fearlessBans || [];
  
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-95 flex items-center justify-center p-4">
        <div className="bg-gray-100 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
          {/* Header */}
          <div className="bg-black text-white p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black text-blue-500">{result.scoreA}</span>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 font-bold tracking-widest">FINAL SCORE</span>
                <span className="text-2xl font-bold">VS</span>
              </div>
              <span className="text-3xl font-black text-red-500">{result.scoreB}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-center">{result.winner} WIN!</h2>
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-bold">닫기</button>
          </div>
  
          {/* Tabs */}
          <div className="flex bg-gray-200 border-b border-gray-300 shrink-0">
            {result.history.map((set, idx) => (
              <button 
                key={idx} 
                onClick={() => setActiveSet(idx)}
                className={`flex-1 py-4 font-bold text-lg transition ${activeSet === idx ? 'bg-white text-black border-b-4 border-black' : 'text-gray-500 hover:bg-gray-300'}`}
              >
                SET {set.setNumber} <span className="text-sm font-normal text-gray-400 ml-2">({set.winner} 승)</span>
              </button>
            ))}
          </div>
  
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Bans Section with improved layout & Full Names */}
            <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
               <div className="flex justify-between items-start">
                 {/* Blue Team Bans */}
                 <div className="flex flex-col gap-2">
                   <div className="text-blue-600 font-black text-sm uppercase tracking-wider mb-1">Blue Phase Bans</div>
                   <div className="flex gap-2">
                     {bansBlue.map((b, i) => (
                       <div key={i} className="group relative">
                          <div className="w-16 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300 text-gray-600 font-bold text-[10px] shadow-sm p-1 text-center leading-tight">
                             {b}
                          </div>
                       </div>
                     ))}
                   </div>
                 </div>
  
                 {/* Global (Fearless) Bans - Center */}
                 {fearlessBans.length > 0 && (
                     <div className="flex flex-col gap-2 items-center mx-4">
                       <div className="text-purple-600 font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>🚫</span> Fearless (Locked)
                       </div>
                       <div className="flex gap-1 flex-wrap justify-center max-w-lg bg-purple-50 p-2 rounded-lg border border-purple-100">
                         {fearlessBans.map((b, i) => (
                           <span key={i} className="text-[10px] font-bold text-purple-700 bg-white px-2 py-1 rounded border border-purple-200 shadow-sm">{b}</span>
                         ))}
                       </div>
                     </div>
                 )}
  
                 {/* Red Team Bans */}
                 <div className="flex flex-col gap-2 items-end">
                   <div className="text-red-600 font-black text-sm uppercase tracking-wider mb-1">Red Phase Bans</div>
                   <div className="flex gap-2">
                      {bansRed.map((b, i) => (
                       <div key={i} className="group relative">
                          <div className="w-16 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300 text-gray-600 font-bold text-[10px] shadow-sm p-1 text-center leading-tight">
                             {b}
                          </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
            </div>
  
            {/* Rosters & Picks */}
            <div className="grid grid-cols-2 gap-8 h-full">
              {/* Blue Team */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-blue-500">
                 <h3 className="text-xl font-black text-blue-700 mb-4 text-center">{teamA.name} <span className="text-sm text-gray-400 font-normal">BLUE SIDE</span></h3>
                 <div className="space-y-3">
                   {picksBlue.map((p, i) => (
                     <div key={i} className="flex items-center bg-blue-50 p-3 rounded-lg border border-blue-100 relative overflow-hidden">
                        <div className="w-8 text-center font-bold text-gray-400 text-xs mr-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-lg">{p.champName}</div>
                          <div className="text-xs text-blue-600 font-bold">{p.tier}티어 챔피언</div>
                        </div>
                        <div className="text-right z-10">
                          <div className="font-bold text-gray-900">{p.playerName}</div>
                          <div className="text-xs text-gray-500 font-medium">OVR {p.playerOvr}</div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-blue-200 to-transparent opacity-30 pointer-events-none"></div>
                     </div>
                   ))}
                 </div>
              </div>
  
              {/* Red Team */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-red-500">
                 <h3 className="text-xl font-black text-red-700 mb-4 text-center">{teamB.name} <span className="text-sm text-gray-400 font-normal">RED SIDE</span></h3>
                 <div className="space-y-3">
                   {picksRed.map((p, i) => (
                     <div key={i} className="flex items-center bg-red-50 p-3 rounded-lg border border-red-100 relative overflow-hidden">
                        <div className="w-8 text-center font-bold text-gray-400 text-xs mr-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-lg">{p.champName}</div>
                          <div className="text-xs text-red-600 font-bold">{p.tier}티어 챔피언</div>
                        </div>
                        <div className="text-right z-10">
                          <div className="font-bold text-gray-900">{p.playerName}</div>
                          <div className="text-xs text-gray-500 font-medium">OVR {p.playerOvr}</div>
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-red-200 to-transparent opacity-30 pointer-events-none"></div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
  
            {/* Logs */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
               <h4 className="font-bold text-gray-500 mb-2 text-sm uppercase">Game Logs</h4>
               <div className="space-y-1 font-mono text-sm h-32 overflow-y-auto">
                 {currentSetData.logs.map((l, i) => <div key={i} className="border-b border-gray-200 last:border-0 pb-1 text-gray-700">{l}</div>)}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }