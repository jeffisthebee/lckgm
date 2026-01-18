import React, { useState, useEffect, useCallback, useRef } from 'react';
import { calculateIndividualIncome, simulateSet, runGameTickEngine, selectPickFromTop3, selectBanFromProbabilities } from '../engine/simEngine';
import { DRAFT_SEQUENCE, championList } from '../data/constants'; 


// --- HELPER: Simple Scoring for Recommendation (Frontend Version) ---
const getRecommendedChampion = (role, currentChamps, availableChamps) => {
    // Filter by Role
    const roleChamps = availableChamps.filter(c => c.role === (role === 'SUP' ? 'SUP' : role));
    if (roleChamps.length === 0) return availableChamps[0];

    // Sort by Tier (1 is best) -> Stats Sum
    return roleChamps.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier; // Lower tier # is better
        const sumA = Object.values(a.stats || {}).reduce((acc, v) => acc + v, 0);
        const sumB = Object.values(b.stats || {}).reduce((acc, v) => acc + v, 0);
        return sumB - sumA;
    })[0];
};

// --- [NEW] HELPER: Calculate POS (Player of the Series) ---
const calculatePOS = (matchHistory, currentSetData, winningTeamName) => {
    const allGames = [...(matchHistory || [])];
    if (currentSetData) {
        // Add the current game to the calculation
        allGames.push({
            winner: currentSetData.winnerName,
            picks: currentSetData.picks 
        });
    }

    const playerScores = {};

    allGames.forEach(game => {
        // Identify which set of picks belongs to the winning team
        const picksA = game.picks?.A || [];
        const picksB = game.picks?.B || [];
        // Heuristic: if picks contain playerData with a team field, use it; otherwise fallback by winner name
        const isTeamA = picksA[0]?.playerData?.팀 === winningTeamName || (picksA[0]?.playerData?.팀 === undefined && game.winner === winningTeamName && picksA[0]);
        const winningPicks = isTeamA ? picksA : picksB;

        (winningPicks || []).forEach(p => {
            if (!p) return;
            if (!playerScores[p.playerName]) playerScores[p.playerName] = { ...p, totalScore: 0, games: 0 };
            
            // Recalculate score for the series
            const stats = p.stats || { kills: p.k || 0, deaths: p.d || 0, assists: p.a || 0, damage: 0 };
            const k = stats.kills || 0;
            const d = (stats.deaths === 0 ? 1 : (stats.deaths || 1));
            const a = stats.assists || 0;
            const gold = p.currentGold || 0;
            const damage = stats.damage || 0;
            
            // Approximate score
            let score = ((k + a) / d * 3) + (damage / 3000) + (gold / 1000) + (a * 1);
            
            const role = p.playerData?.포지션 || 'MID';
            if (['JGL', '정글', 'SUP', '서포터'].includes(role)) score *= 1.15;

            playerScores[p.playerName].totalScore += score;
            playerScores[p.playerName].games += 1;
        });
    });

    const sorted = Object.values(playerScores).sort((a, b) => b.totalScore - a.totalScore);
    return sorted[0]; 
};

// --- [NEW] HELPER: Manual POG Calculation ---
const calculateManualPog = (picksBlue = [], picksRed = [], winnerSide = 'BLUE', gameMinutes = 30) => {
    const winningPicks = winnerSide === 'BLUE' ? picksBlue : picksRed;
    if (!Array.isArray(winningPicks) || winningPicks.length === 0) return null;
    const candidates = winningPicks.map(p => {
        const k = (p.stats?.kills ?? p.k) || 0; 
        const dRaw = (p.stats?.deaths ?? p.d);
        const d = (dRaw === 0 ? 1 : (dRaw || 1)); 
        const a = (p.stats?.assists ?? p.a) || 0;
        const damage = p.stats?.damage || 0;
        
        // DPM
        const dpm = damage / (gameMinutes || 1);
        
        let score = ((k + a) / d * 3) + (dpm / 100) + ((p.currentGold || 0) / 1000) + (a * 1);
        
        const role = p.playerData?.포지션;
        if (['JGL', '정글', 'SUP', '서포터'].includes(role)) score *= 1.15;
        
        return { ...p, pogScore: score, kdaVal: (k+a)/d, dpm };
    });
    candidates.sort((a, b) => (b.pogScore || 0) - (a.pogScore || 0));
    return candidates[0] || null;
};

export default function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [], isManualMode = false }) {
    // [FIX] Define Active Champion List (Dynamic Meta)
    const activeChampionList = simOptions?.currentChampionList || championList;

    const [currentSet, setCurrentSet] = useState(1);
    const [winsA, setWinsA] = useState(0);
    const [winsB, setWinsB] = useState(0);
    
    // Phase: READY -> LOADING -> DRAFT -> GAME -> SET_RESULT
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
    // -------------------------

    // --- DRAFT STATE ---
    const [draftStep, setDraftStep] = useState(0); 
    const [draftTimer, setDraftTimer] = useState(15);
    const [draftState, setDraftState] = useState({
        blueBans: [],
        redBans: [],
        bluePicks: Array(5).fill(null),
        redPicks: Array(5).fill(null),
        currentAction: 'Starting Draft...'
    });

    // Real-time stats for UI
    const [gameTime, setGameTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [liveStats, setLiveStats] = useState({
      kills: { BLUE: 0, RED: 0 },
      gold: { BLUE: 2500, RED: 2500 }, 
      towers: { BLUE: 0, RED: 0 },
      players: [] 
    });
    const liveStatsRef = useRef(liveStats);
    useEffect(() => { liveStatsRef.current = liveStats; }, [liveStats]);
  
    const [globalBanList, setGlobalBanList] = useState(Array.isArray(externalGlobalBans) ? externalGlobalBans.slice() : []);
    const [matchHistory, setMatchHistory] = useState([]);
    const targetWins = match?.format === 'BO5' ? 3 : 2;

    // safe utility
    const safeArray = (v) => Array.isArray(v) ? v : [];
    const ROLE_ORDER = ['TOP','JGL','MID','ADC','SUP'];
  
    // 1. Initialize Set Simulation or Manual Setup
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
                          blueTeam = previousLoser;
                          redTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      } else {
                          redTeam = previousLoser;
                          blueTeam = (previousLoser.name === teamA.name) ? teamB : teamA;
                      }
                  }
              }

              if (isManualMode) {
                  setManualTeams({ blue: blueTeam, red: redTeam });
                  setPhase('DRAFT');
              } else {
                  // AUTO: Run Full Simulation Upfront
                  const result = simulateSet(blueTeam, redTeam, currentSet, globalBanList, simOptions);
                  if (!result || !result.picks) throw new Error("Draft failed");

                  // Ensure we have logs and pogPlayer shape
                  const safeResult = {
                      ...result,
                      logs: safeArray(result.logs),
                      pogPlayer: result.pogPlayer || null,
                      totalSeconds: result.totalSeconds || (result.totalMinutes ? result.totalMinutes * 60 : 30 * 60)
                  };
      
                  const enrichPlayer = (p, teamRoster, side) => {
                      const rosterData = teamRoster.find(r => r.이름 === p.playerName) || {};
                      const safeData = rosterData || { 이름: p.playerName, 포지션: 'TOP', 상세: { 성장: 50, 라인전: 50, 무력: 50, 안정성: 50, 운영: 50, 한타: 50 } };
                      return { 
                          ...p, side: side, k: p.stats?.kills ?? p.k ?? 0, d: p.stats?.deaths ?? p.d ?? 0, a: p.stats?.assists ?? p.a ?? 0, currentGold: p.currentGold || 500, lvl: p.level || 1, xp: p.xp || 0, playerData: safeData 
                      };
                  };
      
                  const initPlayers = [
                      ...safeArray(safeResult.picks?.A).map(p => enrichPlayer(p, blueTeam.roster, 'BLUE')),
                      ...safeArray(safeResult.picks?.B).map(p => enrichPlayer(p, redTeam.roster, 'RED'))
                  ];
      
                  setSimulationData({ ...safeResult, blueTeam, redTeam }); // result now includes pogPlayer from engine
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
              // don't crash the whole page - close modal gracefully
              try { onClose && onClose(); } catch { /* swallow */ }
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

        if (isManualMode) {
            const stepInfo = DRAFT_SEQUENCE[draftStep];
            const actingTeamSide = stepInfo.side; 
            const actingTeamObj = actingTeamSide === 'BLUE' ? manualTeams.blue : manualTeams.red;
            const isPlayerTurn = actingTeamObj?.name === simOptions?.playerTeamName;

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
        
        else if (simulationData) {
            const triggerTime = Math.floor(Math.random() * 12) + 1; 
            const timer = setInterval(() => {
                setDraftTimer(prev => {
                    if (prev <= triggerTime) {
                        const stepInfo = DRAFT_SEQUENCE[draftStep];
                        const logEntry = (simulationData.logs || []).find(l => l && l.startsWith && l.startsWith(`[${stepInfo.order}]`));
                        
                        if (logEntry) {
                            processDraftStepLog(stepInfo, logEntry);
                        }
                        setDraftStep(s => s + 1);
                        return 15; 
                    }
                    return prev - 1;
                });
            }, 1000); 
            return () => clearInterval(timer);
        }

    }, [phase, draftStep, simulationData, isManualMode, manualTeams, manualPicks, filterRole]);

    // --- MANUAL MODE HELPER FUNCTIONS ---
    const handleCpuTurn = (stepInfo, team, side) => {
        const availableChamps = activeChampionList.filter(c => !manualLockedChamps.has(c.name));
        let selectedChamp = null;
    
        if (stepInfo.type === 'BAN') {
            const opponentSide = side === 'BLUE' ? 'RED' : 'BLUE';
            const opponentTeam = side === 'BLUE' ? manualTeams.red : manualTeams.blue;
            const opponentOpenRoles = side === 'BLUE' 
                ? ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !manualPicks.red[r])
                : ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !manualPicks.blue[r]);
            
            selectedChamp = selectBanFromProbabilities(opponentTeam || {}, availableChamps, opponentOpenRoles);
            
            if (!selectedChamp) {
                const idx = Math.floor(Math.random() * Math.min(10, availableChamps.length));
                selectedChamp = availableChamps[idx];
            }
        } else {
            const currentPicks = side === 'BLUE' ? manualPicks.blue : manualPicks.red;
            const remainingRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].filter(r => !currentPicks[r]);
            
            let roleCandidates = [];
            remainingRoles.forEach(role => {
                const player = team?.roster?.find(p => p.포지션 === role);
                if (player) {
                    const candidateChamp = selectPickFromTop3(player, availableChamps);
                    if (candidateChamp) {
                        roleCandidates.push({ role, champ: candidateChamp, score: candidateChamp.score || 0 });
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
                // Ensure role is set for the champ object
                selectedChamp = { ...selectedChamp, role: neededRole };
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
        setManualLockedChamps(prev => new Set([...Array.from(prev), champ.name]));

        setDraftState(prev => {
            const newState = { ...prev, currentAction: logMsg.split(']')[1] || logMsg };
            if (stepInfo.type === 'BAN') {
                if (side === 'BLUE') newState.blueBans = [...prev.blueBans, champ.name];
                else newState.redBans = [...prev.redBans, champ.name];
            } else {
                // PICK: place into the slot that corresponds to the champion's role (so manual picks can be out-of-order)
                const roleIdx = ROLE_ORDER.indexOf(champ.role || filterRole || 'MID');
                const teamPicks = side === 'BLUE' ? prev.bluePicks.slice() : prev.redPicks.slice();

                // If desired role index is valid and empty, put it there
                if (roleIdx >= 0 && teamPicks[roleIdx] === null) {
                    teamPicks[roleIdx] = { champName: champ.name, playerName: (team?.roster || []).find(p => p.포지션 === (champ.role || filterRole))?.이름 || 'Unknown', tier: champ.tier };
                } else {
                    // Fallback: first null slot (preserve previous behavior if role slot occupied)
                    const emptyIdx = teamPicks.findIndex(p => p === null);
                    if (emptyIdx !== -1) {
                        teamPicks[emptyIdx] = { champName: champ.name, playerName: (team?.roster || []).find(p => p.포지션 === (champ.role || filterRole))?.이름 || 'Unknown', tier: champ.tier };
                    } else {
                        // As last resort, overwrite the role slot
                        if (roleIdx >= 0) teamPicks[roleIdx] = { champName: champ.name, playerName: (team?.roster || []).find(p => p.포지션 === (champ.role || filterRole))?.이름 || 'Unknown', tier: champ.tier };
                    }
                }

                if (side === 'BLUE') newState.bluePicks = teamPicks;
                else newState.redPicks = teamPicks;
            }
            return newState;
        });

        if (stepInfo.type === 'PICK') {
            // Also update manualPicks mapping by role so UI & CPU logic know which roles are filled
            const role = champ.role || filterRole || 'MID';
            setManualPicks(prev => ({
                ...prev,
                [side.toLowerCase()]: { ...prev[side.toLowerCase()], [role]: champ }
            }));
        }

        setDraftStep(prev => prev + 1);
        setDraftTimer(25); 
    };

    // =========================================================================
    // FINALIZE MANUAL DRAFT (SAFE VERSION)
    // =========================================================================
    const finalizeManualDraft = () => {
        // 1. Validate Teams
        if (!manualTeams.blue || !manualTeams.red) {
            console.error("Critical Error: Teams not initialized");
            alert("Error: Teams not initialized. Please restart.");
            return;
        }

        const mapToEngineFormat = (sidePicks, roster, teamSide) => {
            return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(pos => {
                const c = sidePicks[pos];
                // Safe fallback if no champion selected
                const safeChamp = c || activeChampionList.find(ch => ch.role === pos) || activeChampionList[0];
                const p = (roster || []).find(pl => pl.포지션 === pos);
                
                const safePlayerData = p || { 
                    이름: 'Unknown', 
                    포지션: pos, 
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
            const picksBlueDetailed = mapToEngineFormat(manualPicks.blue || {}, manualTeams.blue?.roster || [], 'BLUE');
            const picksRedDetailed = mapToEngineFormat(manualPicks.red || {}, manualTeams.red?.roster || [], 'RED');
        
            if (picksBlueDetailed.length < 5 || picksRedDetailed.length < 5) {
                alert('Draft Error: Incomplete teams (Must pick 5 champions).');
                return;
            }
        
            // 2. [FIX] Safe Engine Call with Manual Options
            const safeOptions = simOptions || { difficulty: 'normal', playerTeamName: '' };
            const result = runGameTickEngine(manualTeams.blue, manualTeams.red, picksBlueDetailed, picksRedDetailed, safeOptions);

            // Normalize result
            const winnerName = result?.winnerName || result?.gameResult?.winnerName || (result?.winner || null);
            const totalSeconds = result?.totalSeconds ?? (result?.totalMinutes ? result.totalMinutes * 60 : 30 * 60);
            const logs = safeArray(result?.logs);
            const usedChamps = safeArray(result?.usedChamps || []);
            const totalMinutes = result?.totalMinutes ?? Math.floor((totalSeconds || 1800) / 60);

            // 3. Calculate POG - determine winner side explicitly
            const winnerSide = (winnerName === manualTeams.blue?.name) ? 'BLUE' : 'RED';
            const pogPlayer = calculateManualPog(picksBlueDetailed, picksRedDetailed, winnerSide, totalMinutes);

            // 4. Set Data (make simulationData shape consistent with AUTO simulateSet)
            setSimulationData({
                winnerName: winnerName,
                gameResult: result,
                logs: [
                    `========== [ MANUAL DRAFT ] ==========` ,
                    ...draftLogs,
                    `========== [ GAME START ] ==========`,
                    ...logs
                ],
                blueTeam: manualTeams.blue,
                redTeam: manualTeams.red,
                totalSeconds,
                totalMinutes,
                gameTime: result?.finalTimeStr || `${totalMinutes}분 00초`,
                
                picks: { A: picksBlueDetailed, B: picksRedDetailed },
                bans: { A: draftState.blueBans || [], B: draftState.redBans || [] },
                pogPlayer: pogPlayer || null,
                usedChamps: [...usedChamps]
            });
        
            setLiveStats({
                kills: { BLUE: 0, RED: 0 },
                gold: { BLUE: 2500, RED: 2500 },
                towers: { BLUE: 0, RED: 0 },
                players: [...picksBlueDetailed, ...picksRedDetailed].map(p => ({
                    ...p,
                    k: 0, d: 0, a: 0, lvl: 1, xp: 0, currentGold: 500, stats: p.stats || { kills:0, deaths:0, assists:0, damage:0, takenDamage:0 }
                }))
            });
        
            setGameTime(0);
            setDisplayLogs([]);
            setPhase('GAME');

        } catch (error) {
            console.error("CRITICAL SIMULATION ERROR:", error);
            alert(`Simulation Failed: ${error?.message || error}`);
        }
    };

    const processDraftStepLog = (stepInfo, logEntry) => {
        if (!logEntry) return;
        let champName = 'Unknown';
        if (logEntry.includes('🚫')) {
            champName = logEntry.split('🚫')[1]?.trim();
        } else if (logEntry.includes('✅')) {
            champName = logEntry.split('✅')[1]?.split('(')[0]?.trim();
        }

        setDraftState(prev => {
            const newState = { ...prev, currentAction: logEntry.split(']')[1] || logEntry };
            if (stepInfo.type === 'BAN') {
                if (stepInfo.side === 'BLUE') newState.blueBans = [...prev.blueBans, champName];
                else newState.redBans = [...prev.redBans, champName];
            } else {
                const currentPicks = stepInfo.side === 'BLUE' ? prev.bluePicks : prev.redPicks;
                const teamPicks = stepInfo.side === 'BLUE' ? (simulationData?.picks?.A || []) : (simulationData?.picks?.B || []);
                const pickData = (teamPicks || []).find(p => p && p.champName === champName);
                
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
      
      const finalSec = Number(simulationData.totalSeconds || simulationData.totalSeconds === 0 ? simulationData.totalSeconds : (simulationData.totalMinutes ? simulationData.totalMinutes * 60 : 1800));
      const intervalMs = 1000 / Math.max(0.1, playbackSpeed);
  
      const timer = setInterval(() => {
        setGameTime(prevTime => {
          const nextTime = prevTime + 1;
          const currentMinute = Math.floor(nextTime / 60) + 1; 
  
          // A. Process Logs
          const currentLogs = (simulationData.logs || []).filter(l => {
               const m = (l || '').match(/^\s*\[(\d+):(\d{1,2})\]/);
               return m && ((parseInt(m[1],10)*60 + parseInt(m[2],10)) === nextTime);
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
                // Log Parsing logic
                currentLogs.forEach(l => {
                    if (!l) return;
                    if (l.includes('⚔️') || l.includes('🛡️')) {
                        try {
                            const parts = l.split('➜');
                            if (parts.length < 2) return;
                            const extractName = (str) => {
                                const openParenIndex = str.indexOf('(');
                                const preParen = openParenIndex === -1 ? str : str.substring(0, openParenIndex); 
                                const lastBracketIndex = preParen.lastIndexOf(']');
                                if (lastBracketIndex === -1) return preParen.trim();
                                return preParen.substring(lastBracketIndex + 1).trim();
                            };
                            const killerName = extractName(parts[0]);
                            const victimName = extractName(parts[1]);

                            if (killerName && victimName) {
                                const killer = nextStats.players.find(p => p.playerName === killerName);
                                const victim = nextStats.players.find(p => p.playerName === victimName);
                                if (killer && victim && killer.side !== victim.side) {
                                    killer.k = (killer.k || 0) + 1;
                                    nextStats.kills[killer.side] = (nextStats.kills[killer.side] || 0) + 1;
                                    killer.currentGold = (killer.currentGold || 0) + 300;
                                    victim.d = (victim.d || 0) + 1;
                                    killer.xp = (killer.xp || 0) + 100 + ((victim.lvl || 1) * 25);
                                    
                                    // [NEW] Track damage for POG calc in manual mode
                                    if (!killer.stats) killer.stats = { damage: 0 };
                                    killer.stats.damage = (killer.stats.damage || 0) + 500 + ((killer.lvl || 1) * 50);

                                    if (l.includes('assists:')) {
                                        const assistStr = l.split('assists:')[1]?.trim() || '';
                                        const rawAssisters = assistStr.split(',').map(s => s.split('[')[0].split('(')[0].trim()).filter(Boolean);
                                        rawAssisters.forEach(aName => {
                                            const assister = nextStats.players.find(p => p.playerName === aName && p.side === killer.side);
                                            if (assister) { assister.a = (assister.a || 0) + 1; assister.currentGold = (assister.currentGold || 0) + 150; assister.xp = (assister.xp || 0) + 50 + ((victim.lvl || 1) * 10); }
                                        });
                                    }
                                }
                            }
                        } catch (err) { console.warn(err); }
                    }
                    if (l.includes('포탑') || l.includes('억제기')) {
                        if (l.includes(simulationData.blueTeam?.name)) { nextStats.towers.BLUE = (nextStats.towers.BLUE||0) + 1; nextStats.players.filter(p => p.side === 'BLUE').forEach(p => p.currentGold = (p.currentGold||0) + 100); } 
                        else if (l.includes(simulationData.redTeam?.name)) { nextStats.towers.RED = (nextStats.towers.RED||0) + 1; nextStats.players.filter(p => p.side === 'RED').forEach(p => p.currentGold = (p.currentGold||0) + 100); }
                    }
                });
            }
            // Passive Income
            nextStats.players.forEach(p => {
                const income = calculateIndividualIncome(p, currentMinute, 1.0); 
                if (income.gold > 0) p.currentGold = (p.currentGold || 0) + (income.gold / 60);
                if (income.xp > 0) p.xp = (p.xp || 0) + (income.xp / 60);
                if (p.lvl < 18) { const reqXp = 180 + (p.lvl * 100); if (p.xp >= reqXp) { p.xp -= reqXp; p.lvl++; } }
            });
            nextStats.gold.BLUE = Math.floor(nextStats.players.filter(p=>p.side==='BLUE').reduce((a,b)=>a+(b.currentGold||0),0));
            nextStats.gold.RED = Math.floor(nextStats.players.filter(p=>p.side==='RED').reduce((a,b)=>a+(b.currentGold||0),0));
            return nextStats;
          });
  
          if (nextTime >= finalSec) {
              setGameTime(finalSec);
              // Use safe path for finalKills
              const finalKills = simulationData?.gameResult?.finalKills || liveStatsRef.current?.kills || { BLUE: 0, RED: 0 };
              setLiveStats(st => ({ ...st, kills: finalKills }));
              
              // [NEW] If Manual Mode, Ensure POG is final based on observed stats
              if (isManualMode && !simulationData?.pogPlayer) {
                   const manualPog = calculateManualPog(
                       liveStatsRef.current.players?.filter(p => p.side === 'BLUE') || [],
                       liveStatsRef.current.players?.filter(p => p.side === 'RED') || [],
                       (simulationData?.winnerName === manualTeams.blue?.name) ? 'BLUE' : 'RED',
                       Math.floor((simulationData?.totalMinutes || (finalSec/60)) || 30)
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
    }, [phase, simulationData, playbackSpeed, isManualMode, manualTeams]);

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
        ((currentStepInfo.side === 'BLUE' && manualTeams.blue?.name === simOptions?.playerTeamName) ||
         (currentStepInfo.side === 'RED' && manualTeams.red?.name === simOptions?.playerTeamName));
    
    let recommendedChamp = null;
    if (isManualMode && isUserTurn) {
        const available = activeChampionList.filter(c => !manualLockedChamps.has(c.name));
        recommendedChamp = getRecommendedChampion(filterRole, [], available);
    }

    // Small helper to safely read pog fields in UI
    const pog = simulationData?.pogPlayer || simulationData?.gameResult?.pogPlayer || null;

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
              <div className="flex flex-col w-1/3">
                   <div className="flex items-center gap-4 mb-2">
                      <div className="text-4xl font-black text-blue-500">{currentBlueTeam?.name}</div>
                      <div className="flex gap-2">
                          {Array(match?.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < blueTeamWins ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                   </div>
              </div>

              <div className="flex flex-col items-center justify-center w-1/3 relative">
                  {phase === 'DRAFT' ? (
                      <div className="flex flex-col items-center w-full">
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
                          {Array(match?.format === 'BO5' ? 3 : 2).fill(0).map((_,i) => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i < redTeamWins ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                          ))}
                      </div>
                      <div className="text-4xl font-black text-red-500">{currentRedTeam?.name}</div>
                   </div>
              </div>
            </div>
        </div>

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
                                     {currentStepInfo?.type === 'BAN' ? '🚫 챔피언 금지' : '✅ 챔피언 선택'}
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
                                    .sort((a,b) => (a.tier||99) - (b.tier||99))
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
                                  <div className="bg-blue-500 h-full" style={{width: `${(p.xp / (180 + (p.lvl||1) * 100))*100}%`}}></div>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
      
               {/* GAME UI: Center (Logs) */}
               <div className="flex-1 flex flex-col bg-black/95 relative">
                  <div className="flex-1 p-4 space-y-2 overflow-y-auto font-mono text-sm pb-20 scrollbar-hide">
                      {displayLogs.map((log, i) => (
                          <div key={i} className={`py-1 px-2 rounded ${log?.includes('⚔️') ? 'bg-red-900/20 text-red-200 border-l-2 border-red-500' : (log?.includes('🐛') || log?.includes('🐉') ? 'bg-purple-900/20 text-purple-200' : 'text-gray-400')}`}>
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
                                  <div className="bg-red-500 h-full" style={{width: `${(p.xp / (180 + (p.lvl||1) * 100))*100}%`}}></div>
                              </div>
                          </div>
                      </div>
                  ))}
               </div>
            </div>
        )}
  
        {/* 3. [UPDATED] Result Overlay with POG/POS */}
        {phase === 'SET_RESULT' && (
           <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-fade-in p-8">
               <h1 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">
                   {simulationData?.winnerName || simulationData?.gameResult?.winnerName || 'WIN'} WIN!
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
                        <div className="text-xl font-bold text-yellow-400">{pog?.playerName || 'Unknown'}</div>
                        <div className="text-sm text-gray-400 mb-2">{pog?.champName || ''}</div>
                        
                        <div className="w-full space-y-2 mt-2 bg-black/30 p-3 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">KDA</span>
                                <span className="font-mono font-bold text-white">
                                    {pog?.stats?.kills ?? pog?.k ?? 0}/
                                    {pog?.stats?.deaths ?? pog?.d ?? 0}/
                                    {pog?.stats?.assists ?? pog?.a ?? 0}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Score</span>
                                <span className="font-mono text-yellow-500">{pog?.pogScore ? (pog.pogScore.toFixed(1)) : 'N/A'}</span>
                            </div>
                        </div>
                   </div>

                   {/* POS CARD (Only if Series Ends & BO5) */}
                   {match?.format === 'BO5' && 
                     (winsA + ((simulationData?.winnerName === teamA.name) ? 1 : 0) >= targetWins || 
                      winsB + ((simulationData?.winnerName === teamB.name) ? 1 : 0) >= targetWins) && (
                        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-400 p-6 rounded-2xl shadow-2xl w-1/3 flex flex-col items-center relative overflow-hidden animate-pulse-slow">
                            <div className="absolute top-0 right-0 bg-purple-500 text-white font-bold px-3 py-1 text-xs rounded-bl-lg z-10">
                                SERIES MVP
                            </div>
                            
                            {/* Calculate POS on the fly */}
                            {(() => {
                                const winnerName = (winsA + ((simulationData?.winnerName === teamA.name) ? 1 : 0) >= targetWins) ? teamA.name : teamB.name;
                                const posPlayer = calculatePOS(matchHistory, simulationData, winnerName);
                                return (
                                    <>
                                        <div className="w-24 h-24 rounded-full bg-purple-800 border-2 border-purple-300 mb-4 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                                            <span className="text-3xl">👑</span>
                                        </div>
                                        <div className="text-2xl font-black text-white">{posPlayer?.playerName || 'Unknown'}</div>
                                        <div className="text-sm text-purple-300 mb-2">{posPlayer?.playerData?.포지션 || 'Player'}</div>
                                        <div className="mt-2 text-center text-gray-300 text-sm italic">
                                            "Series MVP"
                                        </div>
                                        <div className="mt-4 bg-black/40 px-4 py-2 rounded text-purple-200 font-mono text-sm">
                                            Score: {posPlayer?.totalScore ? posPlayer.totalScore.toFixed(1) : 'N/A'}
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

        const winnerIsA = simulationData?.winnerName === teamA.name;
        const newA = winsA + (winnerIsA ? 1 : 0);
        const newB = winsB + (winnerIsA ? 0 : 1);
        
        setWinsA(newA); 
        setWinsB(newB);
        
        // [FIX] Calculate Kill Scores for History (use liveStatsRef if available)
        const isBlueA = (simulationData?.blueTeam?.name === teamA.name);
        const killsA = isBlueA ? (liveStatsRef.current?.kills?.BLUE ?? 0) : (liveStatsRef.current?.kills?.RED ?? 0);
        const killsB = isBlueA ? (liveStatsRef.current?.kills?.RED ?? 0) : (liveStatsRef.current?.kills?.BLUE ?? 0);

        // [UPDATED] Save History Item (use simulationData safely)
        const histItem = { 
            set: currentSet, 
            winner: simulationData?.winnerName, 
            picks: simulationData?.picks, 
            bans: simulationData?.bans, 
            logs: simulationData?.logs,
            pogPlayer: simulationData?.pogPlayer,
            gameTime: simulationData?.gameTime || `${simulationData?.totalMinutes || 30}분 00초`,
            totalMinutes: simulationData?.totalMinutes || 30,
            
            // [FIX] Save the Kill Scores here!
            scores: { A: killsA, B: killsB } 
        };

        const newHist = [...matchHistory, histItem];
        setMatchHistory(newHist);
        setGlobalBanList(prev => [...prev, ...(simulationData?.usedChamps||[])]);
        
        if(newA >= targetWins || newB >= targetWins) {
            const winnerName = newA > newB ? teamA.name : teamB.name;
            
            let posData = null;
            if (match?.format === 'BO5') {
                posData = calculatePOS(newHist, null, winnerName);
            }

            try {
                onMatchComplete && onMatchComplete(match, { 
                    winner: winnerName, 
                    scoreString: `${newA}:${newB}`, 
                    history: newHist,
                    posPlayer: posData
                });
            } catch (err) { console.warn("onMatchComplete error:", err); }
        } else {
            setCurrentSet(s => s+1);
            setPhase('READY'); 
        }
    }} 
    className="px-12 py-5 bg-white text-black rounded-full font-black text-2xl hover:scale-105 transition shadow-xl"
>
    {(winsA + ((simulationData?.winnerName === teamA.name) ? 1 : 0) >= targetWins) || 
    (winsB + ((simulationData?.winnerName === teamB.name) ? 1 : 0) >= targetWins)
        ? '매치 종료 (Finish Match)' 
        : '다음 세트 (Next Set)'}
</button>
           </div>
        )}
      </div>
    );
}