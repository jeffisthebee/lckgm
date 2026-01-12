import React, { useState, useEffect, useCallback } from 'react';
import { calculateIndividualIncome, simulateSet } from '../engine/simEngine'; 
import { DRAFT_SEQUENCE } from '../data/constants'; // Make sure to import this

export default function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [] }) {
    const [currentSet, setCurrentSet] = useState(1);
    const [winsA, setWinsA] = useState(0);
    const [winsB, setWinsB] = useState(0);
    
    // Phase: READY -> LOADING -> DRAFT -> GAME -> SET_RESULT
    const [phase, setPhase] = useState('READY'); 
    
    const [simulationData, setSimulationData] = useState(null);
    const [displayLogs, setDisplayLogs] = useState([]);
    const [resultProcessed, setResultProcessed] = useState(false);
    
    // --- DRAFT STATE ---
    const [draftStep, setDraftStep] = useState(0); // 0 to 20
    const [draftTimer, setDraftTimer] = useState(15);
    const [draftState, setDraftState] = useState({
        blueBans: [],
        redBans: [],
        bluePicks: Array(5).fill(null),
        redPicks: Array(5).fill(null),
        currentAction: 'Starting Draft...'
    });
    // -------------------

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
      setDraftStep(0);
      setDraftTimer(15);
      setDraftState({
          blueBans: [], redBans: [],
          bluePicks: Array(5).fill(null), redPicks: Array(5).fill(null),
          currentAction: '밴픽 준비 중...'
      });
      
      setTimeout(() => {
          try {
              // --- Side Selection Logic (Same as before) ---
              let blueTeam, redTeam;
              if (currentSet === 1) {
                  blueTeam = teamA; redTeam = teamB;
              } else {
                  const lastGame = matchHistory[matchHistory.length - 1];
                  if (!lastGame) {
                      blueTeam = currentSet % 2 !== 0 ? teamA : teamB;
                      redTeam = currentSet % 2 !== 0 ? teamB : teamA;
                  } else {
                      const lastWinnerName = lastGame.winner;
                      const previousLoser = (lastWinnerName === teamA.name) ? teamB : teamA;
                      const loserPicksBlue = Math.random() < 0.90;
                      if (loserPicksBlue) {
                          blueTeam = previousLoser;
                          redTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      } else {
                          redTeam = previousLoser;
                          blueTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      }
                  }
              }

              const result = simulateSet(blueTeam, redTeam, currentSet, globalBanList, simOptions);
              if (!result || !result.picks) throw new Error("Draft failed");
  
              const enrichPlayer = (p, teamRoster, side) => {
                  const rosterData = teamRoster.find(r => r.이름 === p.playerName);
                  const safeData = rosterData || { 이름: p.playerName, 포지션: 'TOP', 상세: { 성장: 50, 라인전: 50, 무력: 50, 안정성: 50, 운영: 50, 한타: 50 } };
                  return { 
                      ...p, side: side, k: 0, d: 0, a: 0, currentGold: 500, lvl: 1, xp: 0, playerData: safeData 
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
              setPhase('DRAFT'); // Start with Draft Phase
  
          } catch (e) {
              console.error("Simulation Error:", e);
              onClose(); 
          }
      }, 500);
    }, [currentSet, teamA, teamB, globalBanList, simOptions, onClose, matchHistory]);
  
    useEffect(() => {
      if (phase === 'READY') startSet();
    }, [phase, startSet]);

    // --- DRAFT PHASE LOGIC ---
    useEffect(() => {
        if (phase !== 'DRAFT' || !simulationData) return;

        // Draft finished?
        if (draftStep >= DRAFT_SEQUENCE.length) {
            setTimeout(() => setPhase('GAME'), 1000);
            return;
        }

        const timer = setInterval(() => {
            setDraftTimer(prev => {
                if (prev <= 1) {
                    // Execute Step
                    const stepInfo = DRAFT_SEQUENCE[draftStep];
                    const logs = simulationData.logs;
                    
                    // Parse the log for this specific step order (e.g., "[1] 블루 1밴: ...")
                    const logEntry = logs.find(l => l.startsWith(`[${stepInfo.order}]`));
                    
                    if (logEntry) {
                        // Extract Info
                        const isBan = stepInfo.type === 'BAN';
                        let champName = 'Unknown';
                        
                        if (logEntry.includes('🚫')) {
                            champName = logEntry.split('🚫')[1].trim();
                        } else if (logEntry.includes('✅')) {
                            champName = logEntry.split('✅')[1].split('(')[0].trim();
                        }

                        setDraftState(prev => {
                            const newState = { ...prev, currentAction: logEntry.split(']')[1] };
                            
                            if (isBan) {
                                if (stepInfo.side === 'BLUE') newState.blueBans = [...prev.blueBans, champName];
                                else newState.redBans = [...prev.redBans, champName];
                            } else {
                                // For Picks, find the actual player object from simulationData
                                // We need to find which 'index' this pick corresponds to visually.
                                // We'll just push them into the first available slot for that team for now
                                // or try to match position if available.
                                const teamPicks = stepInfo.side === 'BLUE' ? simulationData.picks.A : simulationData.picks.B;
                                const pickData = teamPicks.find(p => p.champName === champName);
                                
                                // Find first empty slot index
                                const currentPicks = stepInfo.side === 'BLUE' ? prev.bluePicks : prev.redPicks;
                                const emptyIdx = currentPicks.findIndex(p => p === null);
                                
                                if (emptyIdx !== -1 && pickData) {
                                    const newPicks = [...currentPicks];
                                    newPicks[emptyIdx] = pickData;
                                    if (stepInfo.side === 'BLUE') newState.bluePicks = newPicks;
                                    else newState.redPicks = newPicks;
                                }
                            }
                            return newState;
                        });
                    }

                    setDraftStep(s => s + 1);
                    return 15; // Reset timer
                }
                return prev - 1;
            });
        }, 100); // Fast tick for smooth UI, but logic based on seconds

        return () => clearInterval(timer);
    }, [phase, draftStep, simulationData]);

    // Skip Draft Helper
    const skipDraft = () => {
        setPhase('GAME');
    };

    // ... (Keep existing GAME phase useEffect unchanged) ...
    useEffect(() => {
      if (phase !== 'GAME' || !simulationData || playbackSpeed === 0) return;
      
      const finalSec = Number(simulationData.totalSeconds);
      const intervalMs = 1000 / Math.max(0.1, playbackSpeed);
  
      const timer = setInterval(() => {
        setGameTime(prevTime => {
          const nextTime = prevTime + 1;
          const currentMinute = Math.floor(nextTime / 60) + 1; 
  
          // A. Process Logs (Same as before)
          const currentLogs = simulationData.logs.filter(l => {
               const m = l.match(/^\s*\[(\d+):(\d{1,2})\]/);
               return m && ((parseInt(m[1])*60 + parseInt(m[2])) === nextTime);
          });
  
          // B. Update Stats (Same as before)
          setLiveStats(prevStats => {
            const nextStats = { 
                ...prevStats, 
                kills: { ...prevStats.kills },
                towers: { ...prevStats.towers },
                players: prevStats.players.map(p => ({...p})) 
            };
    
            if (currentLogs.length > 0) {
                setDisplayLogs(prevLogs => [...prevLogs, ...currentLogs].slice(-15));
                // ... (Keep existing Log Parsing logic) ...
                currentLogs.forEach(l => {
                    if (l.includes('⚔️') || l.includes('🛡️')) {
                        try {
                            const parts = l.split('➜');
                            if (parts.length < 2) return;
                            const extractName = (str) => {
                                const openParenIndex = str.indexOf('(');
                                if (openParenIndex === -1) return null;
                                const preParen = str.substring(0, openParenIndex); 
                                const lastBracketIndex = preParen.lastIndexOf(']');
                                if (lastBracketIndex === -1) return null;
                                return preParen.substring(lastBracketIndex + 1).trim();
                            };
                            const killerName = extractName(parts[0]);
                            const victimName = extractName(parts[1]);

                            if (killerName && victimName) {
                                const killer = nextStats.players.find(p => p.playerName === killerName);
                                const victim = nextStats.players.find(p => p.playerName === victimName);
                                if (killer && victim && killer.side !== victim.side) {
                                    killer.k++; nextStats.kills[killer.side]++; killer.currentGold += 300; victim.d++; killer.xp += 100 + (victim.lvl * 25);
                                    if (l.includes('assists:')) {
                                        const assistStr = l.split('assists:')[1].trim();
                                        const rawAssisters = assistStr.split(',').map(s => s.split('[')[0].split('(')[0].trim());
                                        rawAssisters.forEach(aName => {
                                            const assister = nextStats.players.find(p => p.playerName === aName && p.side === killer.side);
                                            if (assister) { assister.a++; assister.currentGold += 150; assister.xp += 50 + (victim.lvl * 10); }
                                        });
                                    }
                                }
                            }
                        } catch (err) { console.warn(err); }
                    }
                    if (l.includes('포탑') || l.includes('억제기')) {
                        if (l.includes(simulationData.blueTeam.name)) { nextStats.towers.BLUE++; nextStats.players.filter(p => p.side === 'BLUE').forEach(p => p.currentGold += 100); } 
                        else if (l.includes(simulationData.redTeam.name)) { nextStats.towers.RED++; nextStats.players.filter(p => p.side === 'RED').forEach(p => p.currentGold += 100); }
                    }
                });
            }
            // Passive Income
            nextStats.players.forEach(p => {
                const income = calculateIndividualIncome(p, currentMinute, 1.0); 
                if (income.gold > 0) p.currentGold += (income.gold / 60);
                if (income.xp > 0) p.xp += (income.xp / 60);
                if (p.lvl < 18) { const reqXp = 180 + (p.lvl * 100); if (p.xp >= reqXp) { p.xp -= reqXp; p.lvl++; } }
            });
            nextStats.gold.BLUE = Math.floor(nextStats.players.filter(p=>p.side==='BLUE').reduce((a,b)=>a+b.currentGold,0));
            nextStats.gold.RED = Math.floor(nextStats.players.filter(p=>p.side==='RED').reduce((a,b)=>a+b.currentGold,0));
            return nextStats;
          });
  
          if (nextTime >= finalSec) {
              setGameTime(finalSec);
              setLiveStats(st => ({ ...st, kills: simulationData.gameResult.finalKills }));
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
        
        {/* Header - Always Visible */}
        <div className="bg-black border-b border-gray-800 flex flex-col shrink-0">
            {globalBanList.length > 0 && (
              <div className="bg-purple-900/50 text-purple-200 text-[10px] text-center py-1 font-bold border-b border-purple-900 flex justify-center gap-4">
                  <span className="opacity-70">FEARLESS BANS:</span>
                  {globalBanList.map((b, idx) => <span key={idx} className="text-white">{b}</span>)}
              </div>
            )}
  
            <div className="h-24 flex items-center justify-between px-8">
              {/* Blue Team Info */}
              <div className="flex flex-col w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="text-4xl font-black text-blue-500">{blueTeam?.name}</div>
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < blueTeamWins ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                   </div>
              </div>
  
              {/* Center: Score or Bans (Depending on Phase) */}
              <div className="flex flex-col items-center justify-center w-1/3 relative">
                  {phase === 'DRAFT' ? (
                      <div className="flex flex-col items-center w-full">
                          {/* Bans Row */}
                          <div className="flex items-center gap-4 mb-2">
                              <div className="flex gap-1">
                                  {[0,1,2,3,4].map(i => (
                                      <div key={i} className="w-10 h-10 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                          {draftState.blueBans[i] ? (
                                             <div className="text-[10px] font-bold text-gray-400 text-center leading-tight">{draftState.blueBans[i]}</div>
                                          ) : <div className="w-full h-full bg-blue-900/20"></div>}
                                      </div>
                                  ))}
                              </div>
                              <div className="text-2xl font-black text-yellow-400 w-12 text-center">{Math.ceil(draftTimer)}</div>
                              <div className="flex gap-1">
                                  {[0,1,2,3,4].map(i => (
                                      <div key={i} className="w-10 h-10 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                          {draftState.redBans[i] ? (
                                             <div className="text-[10px] font-bold text-gray-400 text-center leading-tight">{draftState.redBans[i]}</div>
                                          ) : <div className="w-full h-full bg-red-900/20"></div>}
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="text-xs text-gray-400 font-mono animate-pulse">{draftState.currentAction}</div>
                          <button onClick={skipDraft} className="absolute -bottom-8 text-[10px] text-gray-500 hover:text-white underline">SKIP DRAFT ⏩</button>
                      </div>
                  ) : (
                      <>
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
                      </>
                  )}
              </div>
  
              {/* Red Team Info */}
              <div className="flex flex-col items-end w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < redTeamWins ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                      <div className="text-4xl font-black text-red-500">{redTeam?.name}</div>
                   </div>
              </div>
            </div>
        </div>
  
        {/* Main Content Area */}
        {phase === 'DRAFT' ? (
             <div className="flex-1 flex bg-gray-900 p-8 gap-8 items-center justify-center relative overflow-hidden">
                 {/* Background Effect */}
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-red-900/20 pointer-events-none"></div>

                 {/* Blue Picks Column */}
                 <div className="w-1/4 space-y-4">
                     {draftState.bluePicks.map((pick, i) => (
                         <div key={i} className={`h-24 border-l-4 ${pick ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800/50'} rounded-r-lg flex items-center p-4 transition-all duration-500`}>
                             {pick ? (
                                 <>
                                    <div className="w-16 h-16 rounded border border-blue-400 flex items-center justify-center bg-black overflow-hidden">
                                        {/* Placeholder for Champion Image - using text for now */}
                                        <div className="font-bold text-xs text-center">{pick.champName}</div>
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-2xl font-black text-white">{pick.champName}</div>
                                        <div className="text-sm text-blue-300 font-bold">{pick.playerName}</div>
                                    </div>
                                 </>
                             ) : <div className="text-gray-600 font-bold text-lg">Pick {i+1}</div>}
                         </div>
                     ))}
                 </div>

                 {/* Center Splash Art / Vs (Optional) */}
                 <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                     <div className="text-9xl font-black text-white">VS</div>
                 </div>

                 {/* Red Picks Column */}
                 <div className="w-1/4 space-y-4">
                     {draftState.redPicks.map((pick, i) => (
                         <div key={i} className={`h-24 border-r-4 ${pick ? 'border-red-500 bg-red-900/30' : 'border-gray-700 bg-gray-800/50'} rounded-l-lg flex flex-row-reverse items-center p-4 transition-all duration-500`}>
                             {pick ? (
                                 <>
                                    <div className="w-16 h-16 rounded border border-red-400 flex items-center justify-center bg-black overflow-hidden">
                                        <div className="font-bold text-xs text-center">{pick.champName}</div>
                                    </div>
                                    <div className="mr-4 text-right">
                                        <div className="text-2xl font-black text-white">{pick.champName}</div>
                                        <div className="text-sm text-red-300 font-bold">{pick.playerName}</div>
                                    </div>
                                 </>
                             ) : <div className="text-gray-600 font-bold text-lg">Pick {i+1}</div>}
                         </div>
                     ))}
                 </div>
             </div>
        ) : (
            <div className="flex-1 flex overflow-hidden">
               {/* GAME UI: Left (Blue) */}
               <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col pt-2">
                  {liveStats.players.filter(p => p.side === 'BLUE').map((p, i) => (
                      <div key={i} className="flex-1 border-b border-gray-800 relative p-2 flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-800 rounded border border-blue-600 relative overflow-hidden">
                              <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-blue-200 text-center leading-none">{p.champName}</div>
                              <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] px-1 font-bold">{p.lvl}</div>
                          </div>
                          <div className="flex-1">
                              <div className="flex justify-between items-center">
                                  <span className="font-bold text-sm text-blue-100">{p.playerName}</span>
                                  <span className="text-yellow-400 font-mono text-xs">{Math.floor(p.currentGold)}g</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs text-gray-400 truncate w-16">{p.champName}</span>
                                  <span className="font-bold text-white text-sm">{p.k}/{p.d}/{p.a}</span>
                              </div>
                              <div className="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden">
                                  <div className="bg-blue-500 h-full" style={{width: `${(p.xp / (180 + p.lvl * 100))*100}%`}}></div>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
      
               {/* GAME UI: Center (Logs) */}
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
      
               {/* GAME UI: Right (Red) */}
               <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col pt-2">
                  {liveStats.players.filter(p => p.side === 'RED').map((p, i) => (
                      <div key={i} className="flex-1 border-b border-gray-800 relative p-2 flex flex-row-reverse items-center gap-3 text-right">
                          <div className="w-12 h-12 bg-gray-800 rounded border border-red-600 relative overflow-hidden">
                              <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-red-200 text-center leading-none">{p.champName}</div>
                              <div className="absolute bottom-0 left-0 bg-black text-white text-[10px] px-1 font-bold">{p.lvl}</div>
                          </div>
                          <div className="flex-1">
                              <div className="flex justify-between items-center flex-row-reverse">
                                  <span className="font-bold text-sm text-red-100">{p.playerName}</span>
                                  <span className="text-yellow-400 font-mono text-xs">{Math.floor(p.currentGold)}g</span>
                              </div>
                              <div className="flex justify-between items-center mt-1 flex-row-reverse">
                                  <span className="text-xs text-gray-400 truncate w-16">{p.champName}</span>
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
        )}
  
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