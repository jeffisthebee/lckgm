import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { calculateIndividualIncome, simulateSet } from '../engine/simEngine'; 
import { DRAFT_SEQUENCE, championList } from '../data/constants'; 

export default function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [], isManualMode = false }) {
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
    const [draftTimer, setDraftTimer] = useState(isManualMode ? 25 : 15);
    const [draftState, setDraftState] = useState({
        blueBans: [],
        redBans: [],
        bluePicks: Array(5).fill(null),
        redPicks: Array(5).fill(null),
        currentAction: '밴픽 준비 중...'
    });

    // Manual Mode Specifics
    const [manualMySide, setManualMySide] = useState('BLUE'); // 'BLUE' or 'RED'
    const [selectedChamp, setSelectedChamp] = useState(null);
    const [filterRole, setFilterRole] = useState('TOP'); // TOP, JGL, MID, ADC, SUP
    const [manualDraftFinished, setManualDraftFinished] = useState(false);

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
  
    // Determine Sides and Initialize
    const startSet = useCallback(() => {
      setPhase('LOADING');
      setResultProcessed(false);
      setDraftStep(0);
      setDraftTimer(isManualMode ? 25 : 15);
      setManualDraftFinished(false);
      setDraftState({
          blueBans: [], redBans: [],
          bluePicks: Array(5).fill(null), redPicks: Array(5).fill(null),
          currentAction: '밴픽 준비 중...'
      });
      
      setTimeout(() => {
          try {
              // Side Selection Logic
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

              // Determine My Side for Manual Mode
              if (isManualMode) {
                  const myTeamName = simOptions.playerTeamName;
                  setManualMySide(blueTeam.name === myTeamName ? 'BLUE' : 'RED');
              }

              if (isManualMode) {
                  // In Manual Mode, we initialize basic data but DON'T run simulateSet yet.
                  // We just set up the teams and start the Draft Phase.
                  setSimulationData({ blueTeam, redTeam, logs: [] }); // Placeholder
                  setPhase('DRAFT');
              } else {
                  // Auto Mode: Pre-calculate everything
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
                  setPhase('DRAFT'); 
              }
  
          } catch (e) {
              console.error("Simulation Error:", e);
              onClose(); 
          }
      }, 500);
    }, [currentSet, teamA, teamB, globalBanList, simOptions, onClose, matchHistory, isManualMode]);
  
    useEffect(() => {
      if (phase === 'READY') startSet();
    }, [phase, startSet]);

    // --- MANUAL DRAFT LOGIC ---
    // Helper to get unavailable champions
    const getUnavailableChampions = () => {
        const picked = [...draftState.bluePicks, ...draftState.redPicks].filter(Boolean).map(p => p.champName);
        const banned = [...draftState.blueBans, ...draftState.redBans];
        return new Set([...globalBanList, ...picked, ...banned]);
    };

    // Helper to get Recommended Champion
    const getRecommendedChampion = (role, unavailableSet) => {
        const pool = championList.filter(c => c.role === role && !unavailableSet.has(c.name));
        if (pool.length === 0) return null;
        // Simple recommendation based on Tier (lower is better) and Stats
        return pool.sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            const statA = Object.values(a.stats).reduce((s, v) => s + v, 0);
            const statB = Object.values(b.stats).reduce((s, v) => s + v, 0);
            return statB - statA;
        })[0];
    };

    // Handle Manual Step Tick
    useEffect(() => {
        if (phase !== 'DRAFT' || !isManualMode || manualDraftFinished) return;

        // Draft Finished Check
        if (draftStep >= DRAFT_SEQUENCE.length) {
            setManualDraftFinished(true);
            handleManualDraftCompletion();
            return;
        }

        const currentStep = DRAFT_SEQUENCE[draftStep];
        const isMyTurn = currentStep.side === manualMySide;

        // Auto-set filter to the appropriate role for picks
        if (isMyTurn && currentStep.type === 'PICK') {
            // Determine role based on pick order index logic or simplified assumptions
            // For simplicity in this UI, we default to TOP but user can switch.
            // Or better, infer role if possible.
        }

        const timer = setInterval(() => {
            setDraftTimer(prev => {
                if (prev <= 1) {
                    // Time runs out
                    if (isMyTurn) {
                        // Auto pick random/recommended
                        const unavailable = getUnavailableChampions();
                        const randomChamp = championList.find(c => !unavailable.has(c.name));
                        if (randomChamp) handleManualAction(randomChamp);
                    } else {
                        // CPU Move
                        performCpuMove();
                    }
                    return 25;
                }
                return prev - 1;
            });
        }, 1000);

        // If CPU turn, trigger move with random delay (visual only, real logic at 0 or trigger)
        // Ideally we want CPU to act fast, not wait for 25s.
        if (!isMyTurn && draftTimer > 23) { // Small buffer
             const cpuThinkTime = Math.floor(Math.random() * 3000) + 1000;
             setTimeout(() => performCpuMove(), cpuThinkTime);
        }

        return () => clearInterval(timer);
    }, [phase, draftStep, isManualMode, draftTimer, manualDraftFinished]);

    const performCpuMove = () => {
        // Simplified CPU Logic for UI
        const unavailable = getUnavailableChampions();
        const pool = championList.filter(c => !unavailable.has(c.name));
        if (pool.length > 0) {
            const randomPick = pool[Math.floor(Math.random() * pool.length)];
            handleManualAction(randomPick);
        }
    };

    const handleManualAction = (champion) => {
        if (!champion) return;
        const stepInfo = DRAFT_SEQUENCE[draftStep];
        const isBan = stepInfo.type === 'BAN';
        const teamSide = stepInfo.side;

        setDraftState(prev => {
            const newState = { ...prev, currentAction: `${stepInfo.label} 완료` };
            if (isBan) {
                if (teamSide === 'BLUE') newState.blueBans = [...prev.blueBans, champion.name];
                else newState.redBans = [...prev.redBans, champion.name];
            } else {
                const currentPicks = teamSide === 'BLUE' ? prev.bluePicks : prev.redPicks;
                const emptyIdx = currentPicks.findIndex(p => p === null);
                
                // Need to find player for this pick
                const teamObj = teamSide === 'BLUE' ? simulationData.blueTeam : simulationData.redTeam;
                // For simplicity, assign to roster in order 0-4
                const player = teamObj.roster[emptyIdx] || { 이름: 'Unknown' };
                
                const pickObj = {
                    champName: champion.name,
                    playerName: player.이름,
                    tier: champion.tier,
                    ...champion
                };

                const newPicks = [...currentPicks];
                newPicks[emptyIdx] = pickObj;
                
                if (teamSide === 'BLUE') newState.bluePicks = newPicks;
                else newState.redPicks = newPicks;
            }
            return newState;
        });

        setSelectedChamp(null);
        setDraftStep(s => s + 1);
        setDraftTimer(25);
    };

    const handleManualDraftCompletion = () => {
        // Here we would normally call simulateSet with forced picks.
        // For this step, we just transition to GAME visually or show a message.
        // Since we need to run the engine with these picks:
        // We can't fully run the engine without 'simulateSet' refactoring.
        // For now, we will simulate a dummy loading into game.
        setTimeout(() => setPhase('GAME'), 2000);
        // NOTE: In Step 3 you will connect this to actual engine.
    };

    // --- AUTO DRAFT PHASE LOGIC (Replay) ---
    useEffect(() => {
        if (phase !== 'DRAFT' || isManualMode || !simulationData) return;

        if (draftStep >= DRAFT_SEQUENCE.length) {
            setTimeout(() => setPhase('GAME'), 1000);
            return;
        }

        const triggerTime = Math.floor(Math.random() * 12) + 1; 

        const timer = setInterval(() => {
            setDraftTimer(prev => {
                if (prev <= triggerTime) {
                    const stepInfo = DRAFT_SEQUENCE[draftStep];
                    const logs = simulationData.logs;
                    const logEntry = logs.find(l => l.startsWith(`[${stepInfo.order}]`));
                    
                    if (logEntry) {
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
                                const currentPicks = stepInfo.side === 'BLUE' ? prev.bluePicks : prev.redPicks;
                                const teamPicks = stepInfo.side === 'BLUE' ? simulationData.picks.A : simulationData.picks.B;
                                const pickData = teamPicks.find(p => p.champName === champName);
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
                    return 15; 
                }
                return prev - 1;
            });
        }, 1000); 

        return () => clearInterval(timer);
    }, [phase, draftStep, simulationData, isManualMode]);

    const skipDraft = () => {
        setPhase('GAME');
    };

    // ... (Keep existing GAME phase useEffect unchanged) ...
    useEffect(() => {
      if (phase !== 'GAME' || !simulationData || playbackSpeed === 0) return;
      if (isManualMode && !simulationData.logs?.length) {
          // Fallback if manual mode entered game without simulation data
          // This prevents crash in Step 2. In Step 3 this will be real data.
          return; 
      }
      
      const finalSec = Number(simulationData.totalSeconds);
      const intervalMs = 1000 / Math.max(0.1, playbackSpeed);
  
      const timer = setInterval(() => {
        setGameTime(prevTime => {
          const nextTime = prevTime + 1;
          const currentMinute = Math.floor(nextTime / 60) + 1; 
  
          // Log Processing Logic
          const currentLogs = simulationData.logs.filter(l => {
               const m = l.match(/^\s*\[(\d+):(\d{1,2})\]/);
               return m && ((parseInt(m[1])*60 + parseInt(m[2])) === nextTime);
          });
  
          setLiveStats(prevStats => {
            const nextStats = { ...prevStats, kills: { ...prevStats.kills }, towers: { ...prevStats.towers }, players: prevStats.players.map(p => ({...p})) };
            if (currentLogs.length > 0) {
                setDisplayLogs(prevLogs => [...prevLogs, ...currentLogs].slice(-15));
                // Basic Stat Updates from Logs
                currentLogs.forEach(l => {
                    if (l.includes('⚔️')) {
                        const parts = l.split('➜');
                        if (parts.length >= 2) {
                            const extractName = (str) => {
                                const open = str.indexOf('('); if (open === -1) return null;
                                const pre = str.substring(0, open); const last = pre.lastIndexOf(']');
                                return pre.substring(last + 1).trim();
                            };
                            const kName = extractName(parts[0]);
                            const vName = extractName(parts[1]);
                            if (kName && vName) {
                                const killer = nextStats.players.find(p => p.playerName === kName);
                                const victim = nextStats.players.find(p => p.playerName === vName);
                                if (killer && victim) {
                                    killer.k++; nextStats.kills[killer.side]++; killer.currentGold += 300; victim.d++;
                                }
                            }
                        }
                    }
                });
            }
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
    }, [phase, simulationData, playbackSpeed, isManualMode]);
  
    if (!simulationData && phase !== 'SET_RESULT' && !isManualMode) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center z-[200] font-bold text-3xl">경기 로딩 중...</div>;
  
    const { blueTeam, redTeam } = simulationData || { blueTeam: teamA, redTeam: teamB };
    const isBlueTeamA = blueTeam?.name === teamA.name;
    const blueTeamWins = isBlueTeamA ? winsA : winsB;
    const redTeamWins = isBlueTeamA ? winsB : winsA;

    // --- RENDER HELPERS ---
    const currentStepInfo = DRAFT_SEQUENCE[draftStep] || { label: '완료', side: 'NONE' };
    const isUserTurn = isManualMode && !manualDraftFinished && currentStepInfo.side === manualMySide;
    const unavailableSet = getUnavailableChampions();
    const recommendedChamp = isUserTurn ? getRecommendedChampion(filterRole, unavailableSet) : null;

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
                              <div className={`text-3xl font-black w-16 text-center ${draftTimer <= 5 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>{Math.ceil(draftTimer)}</div>
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
                          {!isManualMode && <button onClick={skipDraft} className="absolute -bottom-8 text-[10px] text-gray-500 hover:text-white underline">SKIP DRAFT ⏩</button>}
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
                 <div className="w-64 space-y-4 z-10">
                     {draftState.bluePicks.map((pick, i) => (
                         <div key={i} className={`h-20 border-l-4 ${pick ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800/50'} rounded-r-lg flex items-center p-3 transition-all duration-300`}>
                             {pick ? (
                                 <>
                                    <div className="w-12 h-12 rounded border border-blue-400 flex items-center justify-center bg-black overflow-hidden shrink-0">
                                        <div className="font-bold text-[10px] text-center">{pick.champName}</div>
                                    </div>
                                    <div className="ml-3 overflow-hidden">
                                        <div className="text-lg font-black text-white truncate">{pick.champName}</div>
                                        <div className="text-xs text-blue-300 font-bold truncate">{pick.playerName}</div>
                                    </div>
                                 </>
                             ) : <div className="text-gray-600 font-bold text-sm">Pick {i+1}</div>}
                         </div>
                     ))}
                 </div>

                 {/* CENTER: User Interaction Area or Splash */}
                 <div className="flex-1 flex flex-col items-center justify-center h-full relative z-20">
                     {isUserTurn ? (
                         <div className="w-full max-w-4xl h-full flex flex-col bg-gray-900/90 border border-gray-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm animate-fade-in-up">
                             {/* Tabs */}
                             <div className="flex border-b border-gray-700 bg-black/40">
                                 {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                                     <button 
                                        key={role} 
                                        onClick={() => setFilterRole(role)}
                                        className={`flex-1 py-3 font-bold text-sm transition hover:bg-gray-800 ${filterRole === role ? 'text-white bg-gray-800 border-b-2 border-yellow-500' : 'text-gray-500'}`}
                                     >
                                         {role}
                                     </button>
                                 ))}
                             </div>

                             {/* Recommendation Bar */}
                             {recommendedChamp && (
                                 <div className="bg-gradient-to-r from-yellow-900/40 to-black p-3 flex items-center justify-between border-b border-yellow-800/30">
                                     <div className="flex items-center gap-3">
                                         <span className="text-yellow-400 font-black text-sm uppercase tracking-wider">⭐ Recommended</span>
                                         <span className="font-bold text-white">{recommendedChamp.name}</span>
                                         <span className="text-xs text-gray-400">{recommendedChamp.tier} Tier</span>
                                     </div>
                                     <button 
                                        onClick={() => setSelectedChamp(recommendedChamp)}
                                        className="text-xs bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1 rounded font-bold transition"
                                     >
                                         선택
                                     </button>
                                 </div>
                             )}

                             {/* Champion Grid */}
                             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                 <div className="grid grid-cols-6 gap-2">
                                     {championList
                                        .filter(c => c.role === filterRole)
                                        .sort((a,b) => a.tier - b.tier)
                                        .map(c => {
                                            const isBanned = unavailableSet.has(c.name);
                                            const isSelected = selectedChamp?.id === c.id;
                                            return (
                                                <button 
                                                    key={c.id}
                                                    disabled={isBanned}
                                                    onClick={() => setSelectedChamp(c)}
                                                    className={`aspect-square relative group rounded-lg overflow-hidden border-2 transition ${
                                                        isBanned ? 'opacity-30 grayscale cursor-not-allowed border-transparent' : 
                                                        isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/50 scale-105 z-10' : 
                                                        'border-gray-700 hover:border-gray-400 hover:scale-105'
                                                    }`}
                                                >
                                                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                                                        {/* Placeholder for Image */}
                                                        <span className="text-xs font-bold text-center px-1">{c.name}</span>
                                                    </div>
                                                    <div className="absolute top-1 left-1 bg-black/60 px-1.5 rounded text-[10px] font-bold text-white border border-gray-600">
                                                        {c.tier}티어
                                                    </div>
                                                    {isBanned && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-red-500 text-2xl font-black">✕</span></div>}
                                                </button>
                                            );
                                        })}
                                 </div>
                             </div>

                             {/* Action Footer */}
                             <div className="p-4 bg-black/60 border-t border-gray-700 flex justify-center">
                                 <button 
                                    disabled={!selectedChamp}
                                    onClick={() => handleManualAction(selectedChamp)}
                                    className={`w-full max-w-md py-3 rounded-lg font-black text-xl transition transform ${selectedChamp ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                 >
                                     {currentStepInfo.type === 'BAN' ? '🚫 밴 확정 (BAN)' : '✅ 픽 확정 (LOCK IN)'}
                                 </button>
                             </div>
                         </div>
                     ) : (
                         <div className="text-center opacity-50 animate-pulse">
                             <div className="text-9xl font-black text-white mb-4">VS</div>
                             <div className="text-xl font-bold text-gray-400">{isManualMode ? "상대방이 선택 중입니다..." : ""}</div>
                         </div>
                     )}
                 </div>

                 {/* Red Picks Column */}
                 <div className="w-64 space-y-4 z-10">
                     {draftState.redPicks.map((pick, i) => (
                         <div key={i} className={`h-20 border-r-4 ${pick ? 'border-red-500 bg-red-900/30' : 'border-gray-700 bg-gray-800/50'} rounded-l-lg flex flex-row-reverse items-center p-3 transition-all duration-300`}>
                             {pick ? (
                                 <>
                                    <div className="w-12 h-12 rounded border border-red-400 flex items-center justify-center bg-black overflow-hidden shrink-0">
                                        <div className="font-bold text-[10px] text-center">{pick.champName}</div>
                                    </div>
                                    <div className="mr-3 text-right overflow-hidden">
                                        <div className="text-lg font-black text-white truncate">{pick.champName}</div>
                                        <div className="text-xs text-red-300 font-bold truncate">{pick.playerName}</div>
                                    </div>
                                 </>
                             ) : <div className="text-gray-600 font-bold text-sm">Pick {i+1}</div>}
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