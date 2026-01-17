import React, { useState, useEffect, useCallback, useRef } from 'react';
import { calculateIndividualIncome, simulateSet, runGameTickEngine, selectPickFromTop3, selectBanFromProbabilities } from '../engine/simEngine';
import { DRAFT_SEQUENCE, championList } from '../data/constants'; 

// --- HELPER: Simple Scoring for Recommendation (Frontend Version) ---
const getRecommendedChampion = (role, currentChamps, availableChamps) => {
    const roleChamps = availableChamps.filter(c => c.role === (role === 'SUP' ? 'SUP' : role));
    if (roleChamps.length === 0) return availableChamps[0];

    return roleChamps.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier; 
        const sumA = Object.values(a.stats).reduce((acc, v) => acc + v, 0);
        const sumB = Object.values(b.stats).reduce((acc, v) => acc + v, 0);
        return sumB - sumA;
    })[0];
};

// --- HELPER: Calculate POS (Player of the Series) ---
const calculatePOS = (matchHistory, currentSetData, winningTeamName) => {
    const allGames = [...matchHistory];
    
    // [FIX] Ensure we don't crash if currentSetData is partial or missing stats
    if (currentSetData) {
        allGames.push({
            winner: currentSetData.winnerName,
            picks: currentSetData.picks 
        });
    }

    const playerScores = {};

    allGames.forEach(game => {
        const picksA = game.picks?.A || [];
        const picksB = game.picks?.B || [];
        
        // [FIX] Safe navigation for nested properties to prevent crash
        const firstPick = picksA[0];
        const teamNameA = firstPick?.playerData?.팀 || firstPick?.side || 'Unknown'; 
        
        // If team names match, A is the winner. Otherwise B.
        // Note: This relies on team name matching. In manual mode, we ensure playerData has '팀' now.
        const isTeamA = teamNameA === winningTeamName; 
        const winningPicks = isTeamA ? picksA : picksB;

        winningPicks.forEach(p => {
            if (!p) return;
            if (!playerScores[p.playerName]) playerScores[p.playerName] = { ...p, totalScore: 0, games: 0 };
            
            // [FIX] Use safe fallbacks for all stats to prevent NaN
            const stats = p.stats || {};
            let k = p.k ?? stats.kills ?? 0;
            let d = p.d ?? stats.deaths ?? 0;
            let a = p.a ?? stats.assists ?? 0;
            let gold = p.currentGold || 0;
            let safeD = d === 0 ? 1 : d;
            let damage = p.damage ?? stats.damage ?? 0;
            
            let score = ((k + a) / safeD * 3) + (damage / 3000) + (gold / 1000) + (a * 1);
            
            const role = p.playerData?.포지션 || 'MID';
            if (['JGL', '정글', 'SUP', '서포터'].includes(role)) score *= 1.15;

            if (!isNaN(score)) {
                playerScores[p.playerName].totalScore += score;
            }
            playerScores[p.playerName].games += 1;
        });
    });

    const sorted = Object.values(playerScores).sort((a, b) => b.totalScore - a.totalScore);
    return sorted[0] || null; // Return null if no players found
};

// --- HELPER: Manual POG Calculation ---
const calculateManualPog = (picksBlue, picksRed, winnerSide, gameMinutes) => {
    const winningPicks = winnerSide === 'BLUE' ? picksBlue : picksRed;
    
    if (!Array.isArray(winningPicks) || winningPicks.length === 0) return null;

    const candidates = winningPicks.map(p => {
        const safeStats = p.stats || { kills: 0, deaths: 0, assists: 0, damage: 0 };
        
        const k = p.k ?? safeStats.kills ?? 0;
        const d = p.d ?? safeStats.deaths ?? 0;
        const a = p.a ?? safeStats.assists ?? 0;
        const damage = p.damage ?? safeStats.damage ?? 0;
        const gold = p.currentGold || 5000;
        
        const dpm = damage / (Math.max(1, gameMinutes));
        const safeD = d === 0 ? 1 : d;
        
        let score = ((k + a) / safeD * 3) + (dpm / 100) + (gold / 1000) + (a * 1);
        
        const role = p.playerData?.포지션 || 'MID';
        if (['JGL', '정글', 'SUP', '서포터'].includes(role)) score *= 1.15;
        
        return { ...p, pogScore: isNaN(score) ? 0 : score, kdaVal: (k+a)/safeD, dpm };
    });
    
    candidates.sort((a, b) => b.pogScore - a.pogScore);
    return candidates[0];
};

export default function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [], isManualMode = false }) {
    const activeChampionList = simOptions?.currentChampionList || championList;

    const [currentSet, setCurrentSet] = useState(1);
    const [winsA, setWinsA] = useState(0);
    const [winsB, setWinsB] = useState(0);
    
    const [phase, setPhase] = useState('READY'); 
    
    const [simulationData, setSimulationData] = useState(null);
    const [displayLogs, setDisplayLogs] = useState([]);
    const [resultProcessed, setResultProcessed] = useState(false);
    
    // --- MANUAL MODE STATE ---
    const [manualTeams, setManualTeams] = useState({ blue: null, red: null });
    const [manualPicks, setManualPicks] = useState({ blue: {}, red: {} }); 
    const [manualLockedChamps, setManualLockedChamps] = useState(new Set()); 
    const [selectedChampion, setSelectedChampion] = useState(null);
    const [filterRole, setFilterRole] = useState('TOP');
    const [draftLogs, setDraftLogs] = useState([]);

    // --- DRAFT STATE ---
    const [draftStep, setDraftStep] = useState(0); 
    const [draftTimer, setDraftTimer] = useState(15);
    const [draftState, setDraftState] = useState({
        blueBans: [], redBans: [], bluePicks: Array(5).fill(null), redPicks: Array(5).fill(null), currentAction: 'Starting Draft...'
    });

    const [gameTime, setGameTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [liveStats, setLiveStats] = useState({
      kills: { BLUE: 0, RED: 0 },
      gold: { BLUE: 2500, RED: 2500 }, 
      towers: { BLUE: 0, RED: 0 },
      players: [] 
    });

    // [FIX] Ref to track live stats for intervals (POG calculation)
    const liveStatsRef = useRef(liveStats);
    useEffect(() => {
        liveStatsRef.current = liveStats;
    }, [liveStats]);
  
    const [globalBanList, setGlobalBanList] = useState(externalGlobalBans || []);
    const [matchHistory, setMatchHistory] = useState([]);
    const targetWins = match.format === 'BO5' ? 3 : 2;
  
    // 1. Initialize Set
    const startSet = useCallback(() => {
      setPhase('LOADING');
      setResultProcessed(false);
      setDraftStep(0);
      setDraftTimer(isManualMode ? 25 : 15);
      setDraftLogs([]);
      
      setDraftState({
          blueBans: [], redBans: [],
          bluePicks: Array(5).fill(null), redPicks: Array(5).fill(null),
          currentAction: '밴픽 준비 중...'
      });

      setManualPicks({ blue: {}, red: {} });
      setManualLockedChamps(new Set(globalBanList)); 
      setSelectedChampion(null);

      setTimeout(() => {
          try {
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
                          blueTeam = previousLoser; redTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      } else {
                          redTeam = previousLoser; blueTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      }
                  }
              }

              if (isManualMode) {
                  setManualTeams({ blue: blueTeam, red: redTeam });
                  setPhase('DRAFT');
              } else {
                  // AUTO: Run Full Simulation
                  const result = simulateSet(blueTeam, redTeam, currentSet, globalBanList, simOptions);
                  if (!result || !result.picks) throw new Error("Draft failed");
      
                  const enrichPlayer = (p, teamRoster, side) => {
                      const rosterData = teamRoster.find(r => r.이름 === p.playerName);
                      const safeData = rosterData || { 이름: p.playerName, 포지션: 'TOP', 팀: side === 'BLUE' ? blueTeam.name : redTeam.name, 상세: { 성장: 50, 라인전: 50, 무력: 50, 안정성: 50, 운영: 50, 한타: 50 } };
                      return { 
                          ...p, side: side, k: 0, d: 0, a: 0, currentGold: 500, lvl: 1, xp: 0, 
                          playerData: safeData, 
                          stats: { kills: 0, deaths: 0, assists: 0, damage: 0 }
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

    // --- DRAFT PHASE LOGIC ---
    useEffect(() => {
        if (phase !== 'DRAFT') return;

        if (draftStep >= DRAFT_SEQUENCE.length) {
            if (isManualMode) {
                finalizeManualDraft();
            } else {
                setTimeout(() => setPhase('GAME'), 1000);
            }
            return;
        }

        const stepInfo = DRAFT_SEQUENCE[draftStep];

        // --- MANUAL MODE ---
        if (isManualMode) {
            const actingTeamSide = stepInfo.side; 
            const actingTeamObj = actingTeamSide === 'BLUE' ? manualTeams.blue : manualTeams.red;
            const isPlayerTurn = actingTeamObj.name === simOptions.playerTeamName;

            if (isPlayerTurn && stepInfo.type === 'PICK') {
                const myPicks = actingTeamSide === 'BLUE' ? manualPicks.blue : manualPicks.red;
                const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
                const neededRole = roles.find(r => !myPicks[r]);
                if (neededRole && neededRole !== filterRole) setFilterRole(neededRole);
            }

            if (!isPlayerTurn) {
                const triggerTime = 22; 
                const timer = setInterval(() => {
                    setDraftTimer(prev => {
                        if (prev <= triggerTime) {
                            clearInterval(timer);
                            handleCpuTurn(stepInfo, actingTeamObj, actingTeamSide);
                            return 25;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(timer);
            } else {
                const timer = setInterval(() => {
                    setDraftTimer(prev => {
                        if (prev <= 0) {
                            clearInterval(timer);
                            handleCpuTurn(stepInfo, actingTeamObj, actingTeamSide); 
                            return 25;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(timer);
            }
        } 
        // --- AUTO MODE (FIXED: RELAXED CHECKS) ---
        else if (simulationData) {
            // [FIX] Randomize timing but ensure it triggers
            const triggerTime = Math.floor(Math.random() * 8) + 1; 
            
            const timer = setInterval(() => {
                setDraftTimer(prev => {
                    if (prev <= triggerTime) {
                        // [FIX] Count index based on type/side.
                        // If simulationData missing this item, we skip gracefully instead of stalling.
                        let arrayIndex = 0;
                        for (let i = 0; i < draftStep; i++) {
                            if (DRAFT_SEQUENCE[i].side === stepInfo.side && DRAFT_SEQUENCE[i].type === stepInfo.type) {
                                arrayIndex++;
                            }
                        }

                        let champName = null;
                        if (stepInfo.type === 'BAN') {
                            const bans = stepInfo.side === 'BLUE' ? simulationData.bans?.A : simulationData.bans?.B;
                            if (bans && bans[arrayIndex]) champName = bans[arrayIndex];
                        } else {
                            const picks = stepInfo.side === 'BLUE' ? simulationData.picks?.A : simulationData.picks?.B;
                            if (picks && picks[arrayIndex]) champName = picks[arrayIndex].champName;
                        }

                        if (champName) {
                            processDraftStep(stepInfo, champName);
                        } else {
                            // [FIX] If no data found for this step, just log placeholder and move on.
                            // This prevents "freezing" if simData is incomplete.
                            setDraftState(prev => ({
                                ...prev, 
                                currentAction: `[${stepInfo.order}] ${stepInfo.side} ${stepInfo.type}: (Skipped)`
                            }));
                        }
                        
                        setDraftStep(s => s + 1);
                        return 15; 
                    }
                    return prev - 1;
                });
            }, 50); 
            return () => clearInterval(timer);
        }

    }, [phase, draftStep, simulationData, isManualMode, manualTeams, manualPicks]);

    // --- HELPER: Update Draft UI State ---
    const processDraftStep = (stepInfo, champName) => {
        const logMsg = `[${stepInfo.order}] ${stepInfo.side} ${stepInfo.type}: ${champName}`;
        setDraftState(prev => {
            const newState = { ...prev, currentAction: logMsg };
            if (stepInfo.type === 'BAN') {
                if (stepInfo.side === 'BLUE') newState.blueBans = [...prev.blueBans, champName]; 
                else newState.redBans = [...prev.redBans, champName];
            } else {
                const currentPicks = stepInfo.side === 'BLUE' ? prev.bluePicks : prev.redPicks;
                const teamPicks = stepInfo.side === 'BLUE' ? simulationData.picks?.A : simulationData.picks?.B;
                const pickData = teamPicks?.find(p => p.champName === champName);
                
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
    };

    // --- MANUAL MODE CPU LOGIC ---
    const handleCpuTurn = (stepInfo, team, side) => {
        const availableChamps = activeChampionList.filter(c => !manualLockedChamps.has(c.name));
        let selectedChamp = null;
    
        if (stepInfo.type === 'BAN') {
            const opponentSide = side === 'BLUE' ? 'RED' : 'BLUE';
            const opponentTeam = side === 'BLUE' ? manualTeams.red : manualTeams.blue;
            const opponentOpenRoles = side === 'BLUE' 
                ? ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !manualPicks.red[r])
                : ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !manualPicks.blue[r]);
            
            selectedChamp = selectBanFromProbabilities(opponentTeam, availableChamps, opponentOpenRoles);
            
            if (!selectedChamp) {
                const idx = Math.floor(Math.random() * Math.min(10, availableChamps.length));
                selectedChamp = availableChamps[idx];
            }
        } else {
            const currentPicks = side === 'BLUE' ? manualPicks.blue : manualPicks.red;
            const remainingRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !currentPicks[r]);
            
            let roleCandidates = [];
            remainingRoles.forEach(role => {
                const player = team.roster.find(p => p.포지션 === role);
                if (player) {
                    const candidateChamp = selectPickFromTop3(player, availableChamps);
                    if (candidateChamp) {
                        roleCandidates.push({ role, champ: candidateChamp, score: candidateChamp.score });
                    }
                }
            });
            
            roleCandidates.sort((a, b) => b.score - a.score);
            
            if (roleCandidates.length > 0) {
                const bestPick = roleCandidates[0];
                selectedChamp = { ...bestPick.champ, role: bestPick.role };
            } else {
                const neededRole = remainingRoles[0] || 'MID';
                selectedChamp = getRecommendedChampion(neededRole, [], availableChamps);
            }
        }
    
        if (selectedChamp) {
            commitDraftAction(stepInfo, selectedChamp, team, side);
        }
    };

    const handlePlayerLockIn = () => {
        if (!selectedChampion) return;
        const stepInfo = DRAFT_SEQUENCE[draftStep];
        const side = stepInfo.side;
        const team = side === 'BLUE' ? manualTeams.blue : manualTeams.red;
        
        commitDraftAction(stepInfo, selectedChampion, team, side);
        setSelectedChampion(null);
    };

    const commitDraftAction = (stepInfo, champ, team, side) => {
        const actionLabel = stepInfo.type === 'BAN' ? '🚫' : '✅';
        const logMsg = `[${stepInfo.order}] ${stepInfo.label}: ${actionLabel} ${champ.name}`;
        
        setDraftLogs(prev => [...prev, logMsg]);
        setManualLockedChamps(prev => new Set([...prev, champ.name]));

        setDraftState(prev => {
            const newState = { ...prev, currentAction: logMsg.split(']')[1] };
            if (stepInfo.type === 'BAN') {
                if (side === 'BLUE') newState.blueBans = [...prev.blueBans, champ.name];
                else newState.redBans = [...prev.redBans, champ.name];
            } else {
                const teamPicks = side === 'BLUE' ? prev.bluePicks : prev.redPicks;
                const emptyIdx = teamPicks.findIndex(p => p === null);
                if (emptyIdx !== -1) {
                    const newPicks = [...teamPicks];
                    const player = team.roster.find(p => p.포지션 === champ.role) || { 이름: 'Unknown' };
                    newPicks[emptyIdx] = { champName: champ.name, playerName: player.이름, tier: champ.tier };
                    if (side === 'BLUE') newState.bluePicks = newPicks;
                    else newState.redPicks = newPicks;
                }
            }
            return newState;
        });

        if (stepInfo.type === 'PICK') {
            setManualPicks(prev => ({
                ...prev,
                [side.toLowerCase()]: { ...prev[side.toLowerCase()], [champ.role]: champ }
            }));
        }

        setDraftStep(prev => prev + 1);
        setDraftTimer(25); 
    };

    const finalizeManualDraft = () => {
        if (!manualTeams.blue || !manualTeams.red) {
            alert("Error: Teams not initialized. Please restart.");
            return;
        }

        const mapToEngineFormat = (sidePicks, roster, teamSide) => {
            return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(pos => {
                const c = sidePicks[pos];
                const safeChamp = c || activeChampionList.find(ch => ch.role === pos) || activeChampionList[0];
                const p = roster.find(pl => pl.포지션 === pos);
                
                // [FIX] Ensure playerData has '팀' property for POS calculation later
                const teamName = teamSide === 'BLUE' ? manualTeams.blue.name : manualTeams.red.name;
                const safePlayerData = p 
                    ? { ...p, 팀: teamName }
                    : { 
                        이름: 'Unknown', 
                        포지션: pos, 
                        팀: teamName,
                        종합: 75, 
                        상세: { 라인전: 75, 무력: 75, 한타: 75, 성장: 75, 안정성: 75, 운영: 75 } 
                    };

                return {
                    champName: safeChamp.name || 'Unknown',
                    tier: safeChamp.tier || 3,
                    role: pos,
                    side: teamSide,
                    classType: safeChamp.class || '전사',
                    dmgType: safeChamp.dmg_type || 'AD',
                    mastery: { games: 0, winRate: 50, kda: 3.0 },
                    playerName: safePlayerData.이름,
                    playerOvr: safePlayerData.종합,
                    playerData: safePlayerData,
                    conditionModifier: 1.0,
                    currentGold: 500,
                    level: 1,
                    xp: 0,
                    deadUntil: 0,
                    flashEndTime: 0,
                    stats: { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }
                };
            }).filter(Boolean);
        };
    
        try {
            const picksBlueDetailed = mapToEngineFormat(manualPicks.blue, manualTeams.blue.roster, 'BLUE');
            const picksRedDetailed = mapToEngineFormat(manualPicks.red, manualTeams.red.roster, 'RED');
        
            if (picksBlueDetailed.length < 5 || picksRedDetailed.length < 5) {
                alert('Draft Error: Incomplete teams (Must pick 5 champions).');
                return;
            }
        
            const safeOptions = simOptions || { difficulty: 'normal', playerTeamName: '' };
            const result = runGameTickEngine(manualTeams.blue, manualTeams.red, picksBlueDetailed, picksRedDetailed, safeOptions);
            
            setSimulationData({
                winnerName: result.winnerName,
                gameResult: result,
                logs: [
                    `========== [ MANUAL DRAFT ] ==========`,
                    ...draftLogs,
                    `========== [ GAME START ] ==========`,
                    ...result.logs
                ],
                blueTeam: manualTeams.blue,
                redTeam: manualTeams.red,
                totalSeconds: result.totalSeconds,
                gameTime: result.finalTimeStr || `${result.totalMinutes}분 00초`,
                picks: { A: picksBlueDetailed, B: picksRedDetailed },
                bans: { A: draftState.blueBans, B: draftState.redBans },
                pogPlayer: null, 
                usedChamps: [...picksBlueDetailed, ...picksRedDetailed].map(p => p.champName) 
            });
        
            setLiveStats({
                kills: { BLUE: 0, RED: 0 },
                gold: { BLUE: 2500, RED: 2500 },
                towers: { BLUE: 0, RED: 0 },
                players: [...picksBlueDetailed, ...picksRedDetailed].map(p => ({
                    ...p,
                    k: 0, d: 0, a: 0, lvl: 1, xp: 0, currentGold: 500,
                    // Ensure nested stats exist
                    stats: { kills: 0, deaths: 0, assists: 0, damage: 0 } 
                }))
            });
        
            setGameTime(0);
            setDisplayLogs([]);
            setPhase('GAME');

        } catch (error) {
            console.error("CRITICAL SIMULATION ERROR:", error);
            alert(`Simulation Failed: ${error.message}`);
        }
    };

    const skipDraft = () => {
        if (isManualMode) {
            alert("수동 모드에서는 스킵할 수 없습니다.");
            return;
        }
        setPhase('GAME');
    };

    // --- GAME PHASE TICK ---
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
                                    
                                    if (!killer.stats) killer.stats = { kills:0, deaths:0, assists:0, damage:0 };
                                    if (!victim.stats) victim.stats = { kills:0, deaths:0, assists:0, damage:0 };
                                    
                                    killer.stats.kills = (killer.stats.kills || 0) + 1;
                                    victim.stats.deaths = (victim.stats.deaths || 0) + 1;
                                    killer.stats.damage = (killer.stats.damage || 0) + 500 + (killer.lvl * 50);

                                    if (l.includes('assists:')) {
                                        const assistStr = l.split('assists:')[1].trim();
                                        const rawAssisters = assistStr.split(',').map(s => s.split('[')[0].split('(')[0].trim());
                                        rawAssisters.forEach(aName => {
                                            const assister = nextStats.players.find(p => p.playerName === aName && p.side === killer.side);
                                            if (assister) { 
                                                assister.a++; assister.currentGold += 150; assister.xp += 50 + (victim.lvl * 10);
                                                if (!assister.stats) assister.stats = { kills:0, deaths:0, assists:0, damage:0 };
                                                assister.stats.assists = (assister.stats.assists || 0) + 1;
                                            }
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
              
              // [FIX] Calculate POG using liveStatsRef (latest state)
              if (isManualMode && !simulationData.pogPlayer) {
                   const finalStats = liveStatsRef.current;
                   const manualPog = calculateManualPog(
                       finalStats.players.filter(p => p.side === 'BLUE'),
                       finalStats.players.filter(p => p.side === 'RED'),
                       simulationData.winnerName === manualTeams.blue.name ? 'BLUE' : 'RED',
                       Math.floor(finalSec / 60)
                   );
                   setSimulationData(prev => ({ ...prev, pogPlayer: manualPog }));
              }
              
              setTimeout(() => setPhase('SET_RESULT'), 1000);
              return finalSec;
          }
          return nextTime;
        });
      }, intervalMs);
      return () => clearInterval(timer);
    }, [phase, simulationData, playbackSpeed]);
  
    if ((!simulationData && !isManualMode && phase !== 'SET_RESULT') || (isManualMode && !manualTeams.blue)) {
        return <div className="fixed inset-0 bg-black text-white flex items-center justify-center z-[200] font-bold text-3xl">경기 로딩 중...</div>;
    }
    
    const currentBlueTeam = isManualMode ? manualTeams.blue : simulationData?.blueTeam;
    const currentRedTeam = isManualMode ? manualTeams.red : simulationData?.redTeam;
    
    const isBlueTeamA = currentBlueTeam?.name === teamA.name;
    const blueTeamWins = isBlueTeamA ? winsA : winsB;
    const redTeamWins = isBlueTeamA ? winsB : winsA;
  
    const currentStepInfo = isManualMode ? DRAFT_SEQUENCE[draftStep] : null;
    const isUserTurn = isManualMode && currentStepInfo && 
        ((currentStepInfo.side === 'BLUE' && manualTeams.blue.name === simOptions.playerTeamName) ||
         (currentStepInfo.side === 'RED' && manualTeams.red.name === simOptions.playerTeamName));
    
    let recommendedChamp = null;
    if (isManualMode && isUserTurn) {
        const available = activeChampionList.filter(c => !manualLockedChamps.has(c.name));
        recommendedChamp = getRecommendedChampion(filterRole, [], available);
    }

    return (
      <div className="fixed inset-0 bg-gray-900 z-[200] flex flex-col text-white font-sans">
        {/* Header */}
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
                      <div className="text-4xl font-black text-blue-500">{currentBlueTeam?.name}</div>
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < blueTeamWins ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                   </div>
              </div>
              <div className="flex flex-col items-center justify-center w-1/3 relative">
                  {phase === 'DRAFT' ? (
                      <div className="flex flex-col items-center w-full">
                          <div className="flex items-center gap-4 mb-2">
                              {/* Blue Bans */}
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
                              {/* Red Bans */}
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
              <div className="flex flex-col items-end w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="flex gap-2">
                          {Array(match.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < redTeamWins ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                      <div className="text-4xl font-black text-red-500">{currentRedTeam?.name}</div>
                   </div>
              </div>
            </div>
        </div>
  
        {/* Draft / Game Views (Identical Layout to previous) */}
        {phase === 'DRAFT' ? (
             <div className="flex-1 flex bg-gray-900 p-8 gap-8 items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-red-900/20 pointer-events-none"></div>

                 <div className="w-1/4 space-y-4 z-10">
                     {draftState.bluePicks.map((pick, i) => (
                         <div key={i} className={`h-24 border-l-4 ${pick ? 'border-blue-500 bg-blue-900/30' : 'border-gray-700 bg-gray-800/50'} rounded-r-lg flex items-center p-4 transition-all duration-500`}>
                             {pick ? (
                                 <>
                                    <div className="w-16 h-16 rounded border border-blue-400 flex items-center justify-center bg-black overflow-hidden">
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

                 <div className="flex-1 flex flex-col items-center justify-center z-20 h-full relative">
                     {isUserTurn ? (
                         <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl h-[600px] flex flex-col overflow-hidden">
                             <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
                                 <div className="flex gap-2">
                                     {['TOP','JGL','MID','ADC','SUP'].map(r => (
                                         <button 
                                            key={r} 
                                            onClick={() => setFilterRole(r)}
                                            className={`px-4 py-2 rounded font-bold text-sm transition ${filterRole === r ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                         >
                                             {r}
                                         </button>
                                     ))}
                                 </div>
                                 <div className="text-yellow-400 font-bold animate-pulse text-lg">
                                     {currentStepInfo.type === 'BAN' ? '🚫 챔피언 금지' : '✅ 챔피언 선택'}
                                 </div>
                             </div>

                             {recommendedChamp && (
                                <div className="bg-blue-900/30 p-2 px-4 flex items-center gap-4 border-b border-blue-800">
                                    <span className="text-xs font-bold text-blue-300 uppercase">Recommended</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-black rounded border border-blue-500 flex items-center justify-center text-[10px]">{recommendedChamp.name}</div>
                                        <span className="font-bold text-sm text-white">{recommendedChamp.name}</span>
                                        <span className="text-xs text-blue-200">({recommendedChamp.tier}티어)</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedChampion(recommendedChamp)}
                                        className="ml-auto text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-500"
                                    >
                                        선택
                                    </button>
                                </div>
                             )}

                             <div className="flex-1 overflow-y-auto p-4 grid grid-cols-5 gap-3 content-start">
                                 {activeChampionList
                                    .filter(c => c.role === (filterRole === 'SUP' ? 'SUP' : filterRole)) 
                                    .sort((a,b) => a.tier - b.tier)
                                    .map(champ => {
                                        const isLocked = manualLockedChamps.has(champ.name);
                                        const isSelected = selectedChampion?.name === champ.name;
                                        
                                        return (
                                            <button 
                                                key={champ.id}
                                                disabled={isLocked}
                                                onClick={() => setSelectedChampion(champ)}
                                                className={`relative group flex flex-col items-center p-2 rounded border transition ${
                                                    isLocked ? 'opacity-30 grayscale cursor-not-allowed border-transparent' : 
                                                    isSelected ? 'bg-yellow-500/20 border-yellow-500' : 
                                                    'bg-gray-700/50 border-gray-600 hover:bg-gray-600 hover:border-gray-400'
                                                }`}
                                            >
                                                <div className="w-16 h-16 bg-black rounded mb-2 flex items-center justify-center text-xs text-gray-400 font-bold overflow-hidden">
                                                    {champ.name}
                                                </div>
                                                <div className="text-xs font-bold text-center w-full truncate">{champ.name}</div>
                                                <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${champ.tier === 1 ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-500 text-gray-400'}`}>
                                                    {champ.tier}
                                                </div>
                                            </button>
                                        );
                                    })}
                             </div>

                             <div className="p-4 bg-gray-900 border-t border-gray-700 flex justify-center">
                                 <button 
                                    onClick={handlePlayerLockIn}
                                    disabled={!selectedChampion}
                                    className={`px-12 py-3 rounded text-xl font-black uppercase tracking-widest transition ${
                                        selectedChampion ? 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105 shadow-lg shadow-yellow-500/20' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                                 >
                                     LOCK IN
                                 </button>
                             </div>
                         </div>
                     ) : (
                         <div className="text-9xl font-black text-white opacity-30 select-none">VS</div>
                     )}
                 </div>

                 <div className="w-1/4 space-y-4 z-10">
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
  
        {/* Result Overlay */}
        {phase === 'SET_RESULT' && (
           <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-fade-in p-8">
               <h1 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">
                   {simulationData.winnerName} WIN!
               </h1>
               
               <div className="flex gap-8 w-full max-w-4xl justify-center items-stretch mb-8">
                   {/* POG CARD */}
                   <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/50 p-6 rounded-2xl shadow-2xl w-1/3 flex flex-col items-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 bg-yellow-500 text-black font-bold px-3 py-1 text-xs rounded-br-lg z-10">
                            SET {currentSet} POG
                        </div>
                        <div className="w-24 h-24 rounded-full bg-gray-700 border-2 border-yellow-400 mb-4 flex items-center justify-center overflow-hidden">
                            <span className="text-3xl">👤</span>
                        </div>
                        <div className="text-xl font-bold text-yellow-400">{simulationData.pogPlayer?.playerName || 'Unknown'}</div>
                        <div className="text-sm text-gray-400 mb-2">{simulationData.pogPlayer?.champName}</div>
                        
                        <div className="w-full space-y-2 mt-2 bg-black/30 p-3 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">KDA</span>
                                <span className="font-mono font-bold text-white">
                                    {simulationData.pogPlayer?.stats?.kills || simulationData.pogPlayer?.k || 0}/
                                    {simulationData.pogPlayer?.stats?.deaths || simulationData.pogPlayer?.d || 0}/
                                    {simulationData.pogPlayer?.stats?.assists || simulationData.pogPlayer?.a || 0}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Score</span>
                                <span className="font-mono text-yellow-500">{simulationData.pogPlayer?.pogScore?.toFixed(1) || 'N/A'}</span>
                            </div>
                        </div>
                   </div>

                   {/* POS CARD */}
                   {match.format === 'BO5' && 
                     (winsA + (simulationData.winnerName === teamA.name ? 1 : 0) >= targetWins || 
                      winsB + (simulationData.winnerName === teamB.name ? 1 : 0) >= targetWins) && (
                        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-400 p-6 rounded-2xl shadow-2xl w-1/3 flex flex-col items-center relative overflow-hidden animate-pulse-slow">
                            <div className="absolute top-0 right-0 bg-purple-500 text-white font-bold px-3 py-1 text-xs rounded-bl-lg z-10">
                                SERIES MVP
                            </div>
                            
                            {(() => {
                                const winnerName = (winsA + (simulationData.winnerName === teamA.name ? 1 : 0) >= targetWins) ? teamA.name : teamB.name;
                                
                                // [FIX] Manual mode creates history at the END of this render. 
                                // So we need to inject the current game manually with LIVE stats for POS calculation.
                                const currentSetWithStats = {
                                    ...simulationData,
                                    winnerName: simulationData.winnerName,
                                    // Merge live stats into picks so POS calculator sees damage/kills
                                    picks: {
                                        A: simulationData.picks.A.map(p => {
                                            const lp = liveStats.players.find(x => x.playerName === p.playerName);
                                            return lp ? { ...p, ...lp, stats: lp.stats || p.stats } : p;
                                        }),
                                        B: simulationData.picks.B.map(p => {
                                            const lp = liveStats.players.find(x => x.playerName === p.playerName);
                                            return lp ? { ...p, ...lp, stats: lp.stats || p.stats } : p;
                                        })
                                    }
                                };

                                const posPlayer = calculatePOS(matchHistory, currentSetWithStats, winnerName);
                                
                                if (!posPlayer) return <div className="text-gray-400 mt-10">Calculating MVP...</div>;

                                return (
                                    <>
                                        <div className="w-24 h-24 rounded-full bg-purple-800 border-2 border-purple-300 mb-4 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                                            <span className="text-3xl">👑</span>
                                        </div>
                                        <div className="text-2xl font-black text-white">{posPlayer.playerName}</div>
                                        <div className="text-sm text-purple-300 mb-2">{posPlayer.playerData?.포지션 || 'Player'}</div>
                                        <div className="mt-2 text-center text-gray-300 text-sm italic">
                                            "Series MVP"
                                        </div>
                                        <div className="mt-4 bg-black/40 px-4 py-2 rounded text-purple-200 font-mono text-sm">
                                            Score: {posPlayer.totalScore?.toFixed(1)}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                   )}
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
                    
                    const isBlueA = simulationData.blueTeam.name === teamA.name;
                    const killsA = isBlueA ? liveStats.kills.BLUE : liveStats.kills.RED;
                    const killsB = isBlueA ? liveStats.kills.RED : liveStats.kills.BLUE;

                    // [FIX] CRITICAL: Merge Live Stats into History Item
                    // Otherwise history has 0 kills/damage and POS calc fails next time
                    const mergedPicks = {
                        A: simulationData.picks.A.map(p => {
                            const lp = liveStats.players.find(x => x.playerName === p.playerName);
                            return lp ? { ...p, ...lp, stats: lp.stats || p.stats } : p;
                        }),
                        B: simulationData.picks.B.map(p => {
                            const lp = liveStats.players.find(x => x.playerName === p.playerName);
                            return lp ? { ...p, ...lp, stats: lp.stats || p.stats } : p;
                        })
                    };

                    const histItem = { 
                        set: currentSet, 
                        winner: simulationData.winnerName, 
                        picks: mergedPicks, // Use merged picks
                        bans: simulationData.bans, 
                        logs: simulationData.logs,
                        pogPlayer: simulationData.pogPlayer,
                        gameTime: simulationData.gameTime || "30분 00초",
                        totalMinutes: simulationData.totalMinutes || 30,
                        scores: { A: killsA, B: killsB } 
                    };

                    const newHist = [...matchHistory, histItem];
                    setMatchHistory(newHist);
                    setGlobalBanList(prev => [...prev, ...(simulationData.usedChamps||[])]);
                    
                    if(newA >= targetWins || newB >= targetWins) {
                        const winnerName = newA > newB ? teamA.name : teamB.name;
                        
                        let posData = null;
                        if (match.format === 'BO5') {
                            // Calculate POS using the FULL history including this game
                            // We pass null for currentSetData because newHist already has it
                            posData = calculatePOS(newHist, null, winnerName);
                        }

                        onMatchComplete(match, { 
                            winner: winnerName, 
                            scoreString: `${newA}:${newB}`, 
                            history: newHist,
                            posPlayer: posData
                        });
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