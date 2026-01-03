import React, { useState, useEffect, useCallback } from 'react';
import { calculateIndividualIncome, simulateSet } from '../engine/simEngine'; 

export default function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [] }) {
    const [currentSet, setCurrentSet] = useState(1);
    const [winsA, setWinsA] = useState(0);
    const [winsB, setWinsB] = useState(0);
    const [phase, setPhase] = useState('READY'); 
    const [simulationData, setSimulationData] = useState(null);
    const [displayLogs, setDisplayLogs] = useState([]);
    const [resultProcessed, setResultProcessed] = useState(false);
    
    // Real-time stats for UI
    const [gameTime, setGameTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [liveStats, setLiveStats] = useState({
      kills: { BLUE: 0, RED: 0 },
      gold: { BLUE: 2500, RED: 2500 }, 
      towers: { BLUE: 0, RED: 0 },
      players: [] 
    });
  
    const [globalBanList, setGlobalBanList] = useState(externalGlobalBans || []);
    const [matchHistory, setMatchHistory] = useState([]);
    const targetWins = match.format === 'BO5' ? 3 : 2;
  
    // 1. Initialize Set Simulation
    const startSet = useCallback(() => {
      setPhase('LOADING');
      setResultProcessed(false);
      
      setTimeout(() => {
          try {
              // ============================================================
              // [LOGIC UPDATE] Loser Picks Side (90% Blue / 10% Red)
              // ============================================================
              let blueTeam, redTeam;

              if (currentSet === 1) {
                  // Game 1: Team A (Higher Seed/Home) is always Blue
                  blueTeam = teamA;
                  redTeam = teamB;
              } else {
                  // Game 2+: The loser of the previous set chooses the side
                  // We get the last game result from matchHistory
                  const lastGame = matchHistory[matchHistory.length - 1];
                  
                  // Safety Check (Should not happen if logic is correct)
                  if (!lastGame) {
                      blueTeam = currentSet % 2 !== 0 ? teamA : teamB;
                      redTeam = currentSet % 2 !== 0 ? teamB : teamA;
                  } else {
                      const lastWinnerName = lastGame.winner;
                      const previousLoser = (lastWinnerName === teamA.name) ? teamB : teamA;

                      // 90% Chance Loser picks Blue Side
                      const loserPicksBlue = Math.random() < 0.90;

                      if (loserPicksBlue) {
                          blueTeam = previousLoser;
                          redTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      } else {
                          // 10% Chance Loser picks Red Side (Strategic counter-pick?)
                          redTeam = previousLoser;
                          blueTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      }
                  }
              }
              // ============================================================
              
              const result = simulateSet(blueTeam, redTeam, currentSet, globalBanList, simOptions);
  
              if (!result || !result.picks) throw new Error("Draft failed");
  
              const enrichPlayer = (p, teamRoster, side) => {
                  const rosterData = teamRoster.find(r => r.이름 === p.playerName);
                  const safeData = rosterData || { 이름: p.playerName, 포지션: 'TOP', 상세: { 성장: 50, 라인전: 50, 무력: 50, 안정성: 50, 운영: 50, 한타: 50 } };
                  
                  return { 
                      ...p, 
                      side: side, 
                      k: 0, d: 0, a: 0, 
                      currentGold: 500, 
                      lvl: 1, 
                      xp: 0, 
                      playerData: safeData 
                  };
              };
  
              const initPlayers = [
                  ...result.picks.A.map(p => enrichPlayer(p, blueTeam.roster, 'BLUE')),
                  ...result.picks.B.map(p => enrichPlayer(p, redTeam.roster, 'RED'))
              ];
  
              setSimulationData({ ...result, blueTeam, redTeam });
              setLiveStats({
                  kills: { BLUE: 0, RED: 0 },
                  gold: { BLUE: 2500, RED: 2500 },
                  towers: { BLUE: 0, RED: 0 },
                  players: initPlayers
              });
              
              setGameTime(0);
              setDisplayLogs([]);
              setPhase('GAME'); 
  
          } catch (e) {
              console.error("Simulation Error:", e);
              onClose(); 
          }
      }, 500);
    }, [currentSet, teamA, teamB, globalBanList, simOptions, onClose, matchHistory]); // Added matchHistory to dependency
  
    useEffect(() => {
      if (phase === 'READY') startSet();
    }, [phase, startSet]);
  
    useEffect(() => {
      if (phase !== 'GAME' || !simulationData || playbackSpeed === 0) return;
      
      const finalSec = Number(simulationData.totalSeconds);
      const intervalMs = 1000 / Math.max(0.1, playbackSpeed);
  
      const timer = setInterval(() => {
        setGameTime(prevTime => {
          const nextTime = prevTime + 1;
          const currentMinute = Math.floor(nextTime / 60) + 1; 
  
          // A. Process Logs
          const currentLogs = simulationData.logs.filter(l => {
               const m = l.match(/^\s*\[(\d+):(\d{1,2})\]/);
               return m && ((parseInt(m[1])*60 + parseInt(m[2])) === nextTime);
          });
  
          // B. Update Stats
          setLiveStats(prevStats => {
            const nextStats = { 
                ...prevStats, 
                kills: { ...prevStats.kills },
                towers: { ...prevStats.towers },
                players: prevStats.players.map(p => ({...p})) 
            };
    
            if (currentLogs.length > 0) {
                setDisplayLogs(prevLogs => [...prevLogs, ...currentLogs].slice(-15));
                
                currentLogs.forEach(l => {
                    if (l.includes('⚔️') || l.includes('🛡️')) {
                        try {
                            const parts = l.split('➜');
                            if (parts.length < 2) return;
  
                            const killerPart = parts[0]; 
                            const victimPart = parts[1]; 
  
                            const extractName = (str) => {
                                const openParenIndex = str.indexOf('(');
                                if (openParenIndex === -1) return null;
                                const preParen = str.substring(0, openParenIndex); 
                                const lastBracketIndex = preParen.lastIndexOf(']');
                                if (lastBracketIndex === -1) return null;
                                return preParen.substring(lastBracketIndex + 1).trim();
                            };
  
                            const killerName = extractName(killerPart);
                            const victimName = extractName(victimPart);
  
                            if (killerName && victimName) {
                                const killer = nextStats.players.find(p => p.playerName === killerName);
                                const victim = nextStats.players.find(p => p.playerName === victimName);
  
                                if (killer && victim && killer.side !== victim.side) {
                                    killer.k++;
                                    nextStats.kills[killer.side]++;
                                    killer.currentGold += 300;
                                    victim.d++;
                                
                                    killer.xp += 100 + (victim.lvl * 25); 
                                
                                    if (l.includes('assists:')) {
                                        const assistStr = l.split('assists:')[1].trim();
                                        const rawAssisters = assistStr.split(',').map(s => {
                                            return s.split('[')[0].split('(')[0].trim();
                                        });
                                
                                        rawAssisters.forEach(aName => {
                                            const assister = nextStats.players.find(p => p.playerName === aName && p.side === killer.side);
                                            if (assister) {
                                                assister.a++;
                                                assister.currentGold += 150;
                                                assister.xp += 50 + (victim.lvl * 10);
                                            }
                                        });
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn("Log parse error:", err);
                        }
                    }
                    
                    if (l.includes('포탑') || l.includes('억제기')) {
                        if (l.includes(simulationData.blueTeam.name)) {
                            nextStats.towers.BLUE++; 
                            nextStats.players.filter(p => p.side === 'BLUE').forEach(p => p.currentGold += 100);
                        } else if (l.includes(simulationData.redTeam.name)) {
                            nextStats.towers.RED++;
                            nextStats.players.filter(p => p.side === 'RED').forEach(p => p.currentGold += 100);
                        }
                    }
                });
            }
              // Passive Gold & XP Logic (Per Second)
              nextStats.players.forEach(p => {
                  const income = calculateIndividualIncome(p, currentMinute, 1.0); 
                  if (income.gold > 0) p.currentGold += (income.gold / 60);
                  if (income.xp > 0) p.xp += (income.xp / 60);
                  if (p.lvl < 18) {
                      const reqXp = 180 + (p.lvl * 100);
                      if (p.xp >= reqXp) {
                          p.xp -= reqXp;
                          p.lvl++;
                      }
                  }
              });
  
              nextStats.gold.BLUE = Math.floor(nextStats.players.filter(p=>p.side==='BLUE').reduce((a,b)=>a+b.currentGold,0));
              nextStats.gold.RED = Math.floor(nextStats.players.filter(p=>p.side==='RED').reduce((a,b)=>a+b.currentGold,0));
  
              return nextStats;
          });
  
          if (nextTime >= finalSec) {
              setGameTime(finalSec);
              setLiveStats(st => ({ 
                  ...st, 
                  kills: simulationData.gameResult.finalKills 
              }));
              setTimeout(() => setPhase('SET_RESULT'), 1000);
              return finalSec;
          }
          return nextTime;
        });
      }, intervalMs);
      return () => clearInterval(timer);
    }, [phase, simulationData, playbackSpeed]);
  
    if (!simulationData && phase !== 'SET_RESULT') return <div className="fixed inset-0 bg-black text-white flex items-center justify-center z-[200] font-bold text-3xl">경기 로딩 중...</div>;
  
    const { blueTeam, redTeam } = simulationData || {};
    const isBlueTeamA = blueTeam?.name === teamA.name;
    const blueTeamWins = isBlueTeamA ? winsA : winsB;
    const redTeamWins = isBlueTeamA ? winsB : winsA;
  
    return (
      <div className="fixed inset-0 bg-gray-900 z-[200] flex flex-col text-white font-sans">
        
        <div className="bg-black border-b border-gray-800 flex flex-col shrink-0">
            
            {globalBanList.length > 0 && (
              <div className="bg-purple-900/50 text-purple-200 text-[10px] text-center py-1 font-bold border-b border-purple-900 flex justify-center gap-4">
                  <span className="opacity-70">FEARLESS BANS:</span>
                  {globalBanList.map((b, idx) => <span key={idx} className="text-white">{b}</span>)}
              </div>
            )}
  
            <div className="h-24 flex items-center justify-between px-8">
              <div className="flex flex-col w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="text-4xl font-black text-blue-500">{blueTeam?.name}</div>
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < blueTeamWins ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <span className="text-blue-500 font-bold text-xs self-center">BAN:</span>
                      {simulationData?.bans?.A?.map((b,i) => (
                          <span key={i} className="text-xs text-gray-300 font-medium bg-gray-800 px-1 rounded">{b}</span>
                      ))}
                   </div>
              </div>
  
              <div className="flex flex-col items-center justify-center w-1/3">
                  <div className="flex items-center gap-6">
                      <span className="text-5xl font-black text-blue-400">{liveStats.kills.BLUE}</span>
                      <div className="bg-gray-800 px-4 py-1 rounded text-xl font-mono font-bold text-white">
                          {Math.floor(gameTime/60)}:{String(gameTime%60).padStart(2,'0')}
                      </div>
                      <span className="text-5xl font-black text-red-400">{liveStats.kills.RED}</span>
                  </div>
                  <div className="flex gap-8 text-xs font-bold text-gray-500 mt-1">
                      <span>💰 {(liveStats.gold.BLUE/1000).toFixed(1)}k</span>
                      <span>🔥 {liveStats.towers.BLUE}</span>
                      <span>VS</span>
                      <span>🔥 {liveStats.towers.RED}</span>
                      <span>💰 {(liveStats.gold.RED/1000).toFixed(1)}k</span>
                  </div>
              </div>
  
              <div className="flex flex-col items-end w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < redTeamWins ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                      <div className="text-4xl font-black text-red-500">{redTeam?.name}</div>
                   </div>
                   <div className="flex gap-2 justify-end">
                      {simulationData?.bans?.B?.map((b,i) => (
                          <span key={i} className="text-xs text-gray-300 font-medium bg-gray-800 px-1 rounded">{b}</span>
                      ))}
                      <span className="text-red-500 font-bold text-xs self-center">BAN:</span>
                   </div>
              </div>
            </div>
        </div>
  
        <div className="flex-1 flex overflow-hidden">
           {/* Left: Blue Team */}
           <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col pt-2">
              {liveStats.players.filter(p => p.side === 'BLUE').map((p, i) => (
                  <div key={i} className="flex-1 border-b border-gray-800 relative p-2 flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-800 rounded border border-blue-600 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-blue-200">{p.champName.substring(0,3)}</div>
                          <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] px-1 font-bold">{p.lvl}</div>
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-blue-100">{p.playerName}</span>
                              <span className="text-yellow-400 font-mono text-xs">{Math.floor(p.currentGold)}g</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                              <span className="text-xs text-gray-400">{p.champName}</span>
                              <span className="font-bold text-white text-sm">{p.k}/{p.d}/{p.a}</span>
                          </div>
                          <div className="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full" style={{width: `${(p.xp / (180 + p.lvl * 100))*100}%`}}></div>
                          </div>
                      </div>
                  </div>
              ))}
           </div>
  
           {/* Center */}
           <div className="flex-1 flex flex-col bg-black/95 relative">
              <div className="flex-1 p-4 space-y-2 overflow-y-auto font-mono text-sm pb-20 scrollbar-hide">
                  {displayLogs.map((log, i) => (
                      <div key={i} className={`py-1 px-2 rounded ${log.includes('⚔️') ? 'bg-red-900/20 text-red-200 border-l-2 border-red-500' : (log.includes('🐛') || log.includes('🐉') ? 'bg-purple-900/20 text-purple-200' : 'text-gray-400')}`}>
                          {log}
                      </div>
                  ))}
              </div>
              
              <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-2">
                  <button onClick={() => setPlaybackSpeed(0)} className="w-12 h-10 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xl">⏸</button>
                  {[1, 4, 8, 16, 32].map(speed => (
                      <button 
                          key={speed} 
                          onClick={() => setPlaybackSpeed(speed)} 
                          className={`w-12 h-10 rounded font-bold transition ${playbackSpeed === speed ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                          x{speed}
                      </button>
                  ))}
                  <button onClick={() => setPlaybackSpeed(100)} className="w-16 h-10 rounded font-bold bg-gray-700 hover:bg-red-600 transition">SKIP</button>
              </div>
           </div>
  
           {/* Right: Red Team */}
           <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col pt-2">
              {liveStats.players.filter(p => p.side === 'RED').map((p, i) => (
                  <div key={i} className="flex-1 border-b border-gray-800 relative p-2 flex flex-row-reverse items-center gap-3 text-right">
                      <div className="w-12 h-12 bg-gray-800 rounded border border-red-600 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-red-200">{p.champName.substring(0,3)}</div>
                          <div className="absolute bottom-0 left-0 bg-black text-white text-[10px] px-1 font-bold">{p.lvl}</div>
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between items-center flex-row-reverse">
                              <span className="font-bold text-sm text-red-100">{p.playerName}</span>
                              <span className="text-yellow-400 font-mono text-xs">{Math.floor(p.currentGold)}g</span>
                          </div>
                          <div className="flex justify-between items-center mt-1 flex-row-reverse">
                              <span className="text-xs text-gray-400">{p.champName}</span>
                              <span className="font-bold text-white text-sm">{p.k}/{p.d}/{p.a}</span>
                          </div>
                           <div className="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden flex justify-end">
                              <div className="bg-red-500 h-full" style={{width: `${(p.xp / (180 + p.lvl * 100))*100}%`}}></div>
                          </div>
                      </div>
                  </div>
              ))}
           </div>
        </div>
  
        {/* 3. Result Overlay */}
        {phase === 'SET_RESULT' && (
           <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-fade-in">
               <h1 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">
                   {simulationData.winnerName} WIN!
               </h1>
               <div className="flex gap-10 text-2xl font-bold text-gray-400 mb-10">
                   <div className="text-blue-400">BLUE: {liveStats.kills.BLUE} Kills</div>
                   <div className="text-red-400">RED: {liveStats.kills.RED} Kills</div>
               </div>
               
               <button 
                  onClick={() => {
                    if (resultProcessed) return;
                    setResultProcessed(true);
  
                    const winnerIsA = simulationData.winnerName === teamA.name;
                    const newA = winsA + (winnerIsA ? 1 : 0);
                    const newB = winsB + (!winnerIsA ? 1 : 0);
                    
                    setWinsA(newA); 
                    setWinsB(newB);
                    
                    const histItem = { set: currentSet, winner: simulationData.winnerName, picks: simulationData.picks, bans: simulationData.bans, logs: simulationData.logs };
                    const newHist = [...matchHistory, histItem];
                    setMatchHistory(newHist);
                    setGlobalBanList(prev => [...prev, ...(simulationData.usedChamps||[])]);
                    
                    if(newA >= targetWins || newB >= targetWins) {
                        const winnerName = newA > newB ? teamA.name : teamB.name;
                        onMatchComplete(match, { winner: winnerName, scoreString: `${newA}:${newB}`, history: newHist });
                    } else {
                        setCurrentSet(s => s+1);
                        setPhase('READY'); 
                    }
               }} 
               className="px-12 py-5 bg-white text-black rounded-full font-black text-2xl hover:scale-105 transition shadow-xl"
               >
                   {(winsA + (simulationData.winnerName === teamA.name ? 1 : 0) >= targetWins) || 
                    (winsB + (simulationData.winnerName === teamB.name ? 1 : 0) >= targetWins)
                      ? '매치 종료 (Finish Match)' 
                      : '다음 세트 (Next Set)'}
               </button>
           </div>
        )}
      </div>
    );
}