// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teams, teamFinanceData } from '../data/teams';
import { championList, difficulties } from '../data/constants';
import { simulateMatch, getTeamRoster, generateSchedule, quickSimulateMatch } from '../engine/simEngine';
import { getFullTeamRoster } from '../engine/rosterLogic';
import LiveGamePlayer from '../components/LiveGamePlayer';
import DetailedMatchResultModal from '../components/DetailedMatchResultModal';
import playerList from '../data/players.json';
import { computeStandings, calculateFinalStandings, calculateGroupPoints, sortGroupByStandings, createPlayInBracket, createPlayInRound2Matches, createPlayInFinalMatch, createPlayoffRound2Matches, createPlayoffRound3Matches, createPlayoffLoserRound3Match, createPlayoffQualifierMatch, createPlayoffFinalMatch } from '../engine/BracketManager';
import { updateChampionMeta, generateSuperWeekMatches } from '../engine/SeasonManager';
import { computeAwards } from '../engine/statsManager'; // [NEW] Import for MVP calc
import FinalStandingsModal from '../components/FinalStandingsModal';
import MatchupBox from '../components/MatchupBox';
import RosterTab from '../components/RosterTab';
import StandingsTab from '../components/StandingsTab';
import MetaTab from '../components/MetaTab';
import FinanceTab from '../components/FinanceTab';
import ScheduleTab from '../components/ScheduleTab';
import PlayoffTab from '../components/PlayoffTab';
import StatsTab from '../components/TEMP_StatsTab';
import {updateLeague, getLeagueById } from '../engine/storage';
import AwardsTab from '../components/AwardsTab';
import ForeignLeaguesTab from '../components/ForeignLeaguesTab'; 
import HistoryTab from '../components/HistoryTab'; // [NEW] Import History Tab



// --- HELPER FUNCTIONS ---
const getOvrBadgeStyle = (ovr) => {
    if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
    if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
    if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
    if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
    return 'bg-green-100 text-green-700 border-green-300 ring-green-200';
  };
  
  const getPotBadgeStyle = (pot) => {
    if (pot >= 95) return 'text-purple-600 font-black'; 
    if (pot >= 90) return 'text-blue-600 font-bold'; 
    return 'text-gray-500 font-medium';
  };

  export default function Dashboard() {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const [league, setLeague] = useState(null);
    const [viewingTeamId, setViewingTeamId] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [prizeMoney, setPrizeMoney] = useState(0.0);
    const [showPlayInBracket, setShowPlayInBracket] = useState(false);
    const [isLiveGameMode, setIsLiveGameMode] = useState(false);
    const [liveMatchData, setLiveMatchData] = useState(null);
    
    // Mobile Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
    // 드래프트 상태
    const [isDrafting, setIsDrafting] = useState(false);
    const [draftPool, setDraftPool] = useState([]);
    const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
    const [draftTurn, setDraftTurn] = useState('user');
    const draftTimeoutRef = useRef(null);
  
    // 메타 분석 탭 상태
    const [metaRole, setMetaRole] = useState('TOP');
  
    // 시뮬레이션 결과 모달 상태
    const [myMatchResult, setMyMatchResult] = useState(null);
  
    // 로컬 순위표 상태
    const [computedStandings, setComputedStandings] = useState({});
  
    // 플레이-인/플레이오프 상대 선택 모달 상태
    const [opponentChoice, setOpponentChoice] = useState(null); 
    const [showFinalStandings, setShowFinalStandings] = useState(false);

    // Define this helper before it is used in useEffect
    const recalculateStandings = (lg) => {
      const newStandings = computeStandings(lg);
      setComputedStandings(newStandings);
  };
  
    useEffect(() => {
      const loadData = () => {
        const found = getLeagueById(leagueId);
        if (found) {
          const sanitizedLeague = {
              ...found,
              metaVersion: found.metaVersion || '16.01',
              currentChampionList: found.currentChampionList || championList
          };
          setLeague(sanitizedLeague);
          updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
          setViewingTeamId(sanitizedLeague.team.id);
          recalculateStandings(sanitizedLeague);
        }
      };
      loadData();
    }, [leagueId]);

    // Effect: Calculate Prize Money Safely
    useEffect(() => {
      if (!league || !league.matches) return;

      // Check if Season is Over
      const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
      const isSeasonFinished = grandFinal && grandFinal.status === 'finished';

      if (isSeasonFinished) {
        const getID = (id) => (typeof id === 'object' ? id.id : Number(id));
        const getWinnerId = (m) => teams.find(t => t.name === m.result.winner)?.id;
        const getLoserId = (m) => {
            const wId = getWinnerId(m);
            const t1Id = getID(m.t1);
            const t2Id = getID(m.t2);
            return t1Id === wId ? t2Id : t1Id;
        };

        const winnerId = getID(getWinnerId(grandFinal));
        const runnerUpId = getID(getLoserId(grandFinal));
        const r4Match = league.matches.find(m => m.type === 'playoff' && m.round === 4);
        const thirdId = getID(getLoserId(r4Match));
        
        // Use ID from league state directly
        const myId = getID(league.team.id);

        let earned = 0.1; 
        if (myId === winnerId) earned = 0.5;
        else if (myId === runnerUpId) earned = 0.25;
        else if (myId === thirdId) earned = 0.2;

        setPrizeMoney(earned);
      }
    }, [league]);

    // [NEW] AUTO-ARCHIVE HISTORY EFFECT
    useEffect(() => {
        if (!league || !league.matches) return;

        // 1. Check if Season is Finished
        const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
        const isSeasonFinished = grandFinal && grandFinal.status === 'finished';

        if (isSeasonFinished) {
            const currentYear = league.year || 2026;
            const currentSeasonName = league.seasonName || 'LCK CUP';

            // 2. Check if this season is ALREADY in history (Prevent Duplicates)
            const history = league.history || [];
            const alreadySaved = history.some(h => h.year === currentYear && h.seasonName === currentSeasonName);

            if (!alreadySaved) {
                console.log("Auto-Archiving Season History...");
                
                // 3. Generate Snapshot Data
                const finalStandings = calculateFinalStandings(league);
                const awardsData = computeAwards(league, teams, playerList);
                
                // 4. Create History Object
                const seasonSnapshot = {
                    year: currentYear,
                    seasonName: currentSeasonName,
                    champion: finalStandings[0]?.team, // 1st Place Team Object
                    runnerUp: finalStandings[1]?.team,
                    finalStandings: finalStandings,
                    groupStandings: {
                        baron: sortGroupByStandings(league.groups.baron, computedStandings).map(id => ({
                            teamName: teams.find(t=>t.id===id).name,
                            w: computedStandings[id].w,
                            l: computedStandings[id].l,
                            diff: computedStandings[id].diff
                        })),
                        elder: sortGroupByStandings(league.groups.elder, computedStandings).map(id => ({
                            teamName: teams.find(t=>t.id===id).name,
                            w: computedStandings[id].w,
                            l: computedStandings[id].l,
                            diff: computedStandings[id].diff
                        }))
                    },
                    awards: {
                        mvp: awardsData.mvp, // { name, team, role, points }
                        allPro: awardsData.allProTeams // { 1: [...], 2: [...], 3: [...] }
                    }
                };

                // 5. Save to League State
                const newHistory = [...history, seasonSnapshot];
                const updatedLeague = { ...league, history: newHistory };
                
                setLeague(updatedLeague);
                updateLeague(league.id, updatedLeague);
                
                // Optional: Notify User
                // alert("🏆 시즌 기록이 역사에 저장되었습니다! '역대 기록' 탭에서 확인할 수 있습니다.");
            }
        }
    }, [league?.matches]); // Trigger when matches update (e.g. final match finishes)
  
  // [CRITICAL FIX] handleMatchClick now injects round info for old saves
  const handleMatchClick = (match) => {
    if (!match || match.status !== 'finished' || !match.result) return;
    
    // Helper to safely get ID
    const getID = (id) => (typeof id === 'object' ? id.id : Number(id));
    
    const t1Id = getID(match.t1);
    const t2Id = getID(match.t2);
    
    const teamA = teams.find(t => t.id === t1Id);
    const teamB = teams.find(t => t.id === t2Id);

    // We merge the match metadata (round, label) into the result object
    // This ensures DetailedMatchResultModal knows it's the Finals
    setMyMatchResult({
        resultData: {
            ...match.result,
            round: match.round,
            roundIndex: match.roundIndex,
            roundName: match.label || match.roundName || (match.round === 5 ? 'Grand Final' : undefined),
            matchId: match.id
        }, 
        teamA: teamA,
        teamB: teamB
    });
};
  
    const handleMenuClick = (tabId) => {
      setActiveTab(tabId);
      setIsSidebarOpen(false); // Close sidebar on selection for mobile
      if (tabId === 'dashboard' && league) {
        setViewingTeamId(league.team.id);
      }
    };
  
    if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중... (응답이 없으면 메인에서 초기화해주세요)</div>;
     
    const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
    const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
    const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
     
    const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
    const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
    
    const nextGlobalMatch = league.matches ? league.matches.find(m => m.status === 'pending') : null;
  
    // ID Normalization Helper to safely compare IDs
    const safeId = (id) => (typeof id === 'object' ? id.id : Number(id));
  
    const isMyNextMatch = nextGlobalMatch 
      ? (safeId(nextGlobalMatch.t1) === safeId(myTeam.id) || safeId(nextGlobalMatch.t2) === safeId(myTeam.id)) 
      : false;
  
    const t1 = nextGlobalMatch ? teams.find(t => t.id === safeId(nextGlobalMatch.t1)) : null;
    const t2 = nextGlobalMatch ? teams.find(t => t.id === safeId(nextGlobalMatch.t2)) : null;
  
    
  
    const applyMatchResult = (targetMatch, result) => {
      const updatedMatches = league.matches.map(m => {
          if (m.id === targetMatch.id) {
              return { ...m, status: 'finished', result: { winner: result.winner, score: result.scoreString } };
          }
          return m;
      });
  
      const updatedLeague = { ...league, matches: updatedMatches };
      updateLeague(league.id, { matches: updatedMatches });
      setLeague(updatedLeague);
      recalculateStandings(updatedLeague); 
      
      checkAndGenerateNextPlayInRound(updatedMatches);
      checkAndGenerateNextPlayoffRound(updatedMatches);
    };
  
    const generatePlayInRound2 = (matches, seed1, seed2, pickedTeam, remainingTeam) => {
      const newMatches = createPlayInRound2Matches(matches, seed1, seed2, pickedTeam, remainingTeam);
      
      updateLeague(league.id, { matches: newMatches });
      setLeague(prev => ({ ...prev, matches: newMatches }));
      alert("플레이-인 2라운드 대진이 완성되었습니다!");
      setOpponentChoice(null);
  };
  
  const checkAndGenerateNextPlayInRound = (matches) => {
    // 1. Check if Round 1 is finished
    const r1Matches = matches.filter(m => m.type === 'playin' && m.round === 1);
    const r1Finished = r1Matches.length > 0 && r1Matches.every(m => m.status === 'finished');
    const r2Exists = matches.some(m => m.type === 'playin' && m.round === 2);
  
    if (r1Finished && !r2Exists) {
        const r1Winners = r1Matches.map(m => teams.find(t => t.name === m.result.winner));
        const playInSeeds = league.playInSeeds || []; 
        
        // Fallback: If playInSeeds missing, try to reconstruct or abort safely
        if (!playInSeeds || playInSeeds.length < 2) {
           console.warn("PlayIn Seeds missing, using fallback.");
        }
  
        const seed1 = teams.find(t => t.id === (playInSeeds[0]?.id || 0));
        const seed2 = teams.find(t => t.id === (playInSeeds[1]?.id || 0));
        
        if (!seed1 || !seed2) return;
  
        const winnersWithSeed = r1Winners.map(w => ({ ...w, seedIndex: playInSeeds.findIndex(s => s.id === w.id) }));
        winnersWithSeed.sort((a, b) => a.seedIndex - b.seedIndex);
        
        // Check if we are waiting for user input (Seed 1 is My Team)
        if (seed1.id === myTeam.id && !opponentChoice) {
             setOpponentChoice({
                type: 'playin',
                title: '플레이-인 2라운드 상대 선택',
                description: '1라운드 승리팀 중 한 팀을 2라운드 상대로 지명할 수 있습니다.',
                picker: seed1,
                opponents: winnersWithSeed,
                onConfirm: (pickedTeam) => {
                    const remainingTeam = winnersWithSeed.find(w => w.id !== pickedTeam.id);
                    generatePlayInRound2(matches, seed1, seed2, pickedTeam, remainingTeam);
                }
            });
            return;
        } 
        
        // If not my team, or I'm not seed 1, or just auto-gen needed
        if (seed1.id !== myTeam.id) {
             const lowerSeedWinner = winnersWithSeed[1]; 
             const higherSeedWinner = winnersWithSeed[0];
             let pickedTeam;
             if (Math.random() < 0.65) pickedTeam = lowerSeedWinner; else pickedTeam = higherSeedWinner;
             const remainingTeam = (pickedTeam.id === lowerSeedWinner.id) ? higherSeedWinner : lowerSeedWinner;
             generatePlayInRound2(matches, seed1, seed2, pickedTeam, remainingTeam);
        }
    }
  
    // 2. Check if Round 2 is finished -> Generate Final (Round 3)
    const r2Matches = matches.filter(m => m.type === 'playin' && m.round === 2);
    const r2Finished = r2Matches.length > 0 && r2Matches.every(m => m.status === 'finished');
    const finalExists = matches.some(m => m.type === 'playin' && m.round === 3);
  
    if (r2Finished && !finalExists) {
      const newMatches = createPlayInFinalMatch(matches, teams);
      updateLeague(league.id, { matches: newMatches });
      setLeague(prev => ({ ...prev, matches: newMatches }));
      alert("🛡️ 플레이-인 최종전(2라운드 패자 대결) 대진이 완성되었습니다!");
  }
  };
  
  const checkAndGenerateNextPlayoffRound = (currentMatches) => {
    if (!league.playoffSeeds) return;
  
    const getWinner = m => teams.find(t => t.name === m.result.winner).id;
    const getLoser = m => (m.t1 === getWinner(m) ? m.t2 : m.t1);
  
    // --- R1 -> R2 (Winners/Losers) ---
    const r1Matches = currentMatches.filter(m => m.type === 'playoff' && m.round === 1);
    const r1Finished = r1Matches.length === 2 && r1Matches.every(m => m.status === 'finished');
    const r2Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 2);
  
    if (r1Finished && !r2Exists) {
        const r1Winners = r1Matches.map(m => ({ id: getWinner(m), fromMatch: m.match }));
        const r1Losers = r1Matches.map(m => ({ id: getLoser(m), fromMatch: m.match }));
        
        const seed1 = league.playoffSeeds.find(s => s.seed === 1).id;
        const seed2 = league.playoffSeeds.find(s => s.seed === 2).id;
  
        const generateR2Matches = (pickedWinner) => {
          const remainingWinner = r1Winners.find(w => w.id !== pickedWinner.id).id;
          
          const newMatches = createPlayoffRound2Matches(
              currentMatches,
              seed1,
              seed2,
              pickedWinner.id,
              remainingWinner,
              r1Losers[0].id,
              r1Losers[1].id
          );
          
          updateLeague(league.id, { matches: newMatches });
          setLeague(prev => ({ ...prev, matches: newMatches }));
          alert("👑 플레이오프 2라운드 대진이 완성되었습니다!");
          setOpponentChoice(null);
      };
  
        if (seed1 === myTeam.id) {
            setOpponentChoice({
                type: 'playoff_r2',
                title: '플레이오프 2라운드 상대 선택',
                description: '1라운드 승리팀 중 한 팀을 2라운드 상대로 지명할 수 있습니다.',
                picker: teams.find(t => t.id === seed1),
                opponents: r1Winners.map(w => teams.find(t => t.id === w.id)),
                onConfirm: (pickedTeam) => generateR2Matches(pickedTeam)
            });
            return;
        } else {
            // AI Logic
            const r1m1Winner = getWinner(r1Matches.find(m => m.match === 1));
            const r1m2Winner = getWinner(r1Matches.find(m => m.match === 2));
            const r1m1Seed3 = r1Matches.find(m => m.match === 1).t1;
            
            let pickedId;
            pickedId = Math.random() < 0.5 ? r1m1Winner : r1m2Winner;
            generateR2Matches(teams.find(t => t.id === pickedId));
        }
        return; 
    }

  const r2wMatches = currentMatches.filter(m => m.type === 'playoff' && m.round === 2);
  const r2lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 2.1);
  const r2Finished = r2wMatches.length === 2 && r2wMatches.every(m => m.status === 'finished') && r2lMatch?.status === 'finished';
  const r3Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 3);

  if (r2Finished && !r3Exists) {
      const newMatches = createPlayoffRound3Matches(currentMatches, league.playoffSeeds, teams);
      updateLeague(league.id, { matches: newMatches });
      setLeague(prev => ({ ...prev, matches: newMatches }));
      alert("👑 플레이오프 3라운드 승자조 및 2라운드 패자조 경기가 생성되었습니다!");
      return;
  }
    
    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lExists = currentMatches.some(m => m.type === 'playoff' && m.round === 3.1);

    if (r2_2Match?.status === 'finished' && r3wMatch?.status === 'finished' && !r3lExists) {
        const newMatches = createPlayoffLoserRound3Match(currentMatches, league.playoffSeeds, teams);
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("👑 플레이오프 3라운드 패자조 경기가 생성되었습니다!");
        return;
    }
  
    // --- R4 Qualifier (Loser Bracket Final) ---
    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);
    const r4Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 4);

    if (r3lMatch?.status === 'finished' && r3wMatch?.status === 'finished' && !r4Exists) {
        const newMatches = createPlayoffQualifierMatch(currentMatches, teams);
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("👑 플레이오프 결승 진출전이 생성되었습니다!");
        return;
    }
  
    const r4Match = currentMatches.find(m => m.type === 'playoff' && m.round === 4);
    const finalExists = currentMatches.some(m => m.type === 'playoff' && m.round === 5);

    if (r4Match?.status === 'finished' && r3wMatch?.status === 'finished' && !finalExists) {
        const newMatches = createPlayoffFinalMatch(currentMatches, teams);
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("🏆 대망의 결승전이 생성되었습니다!");
        return;
    }
  };
  
    const runSimulationForMatch = (match, isPlayerMatch) => {
      try {
        const getID = (val) => {
            if (val && typeof val === 'object' && val.id) return Number(val.id);
            return Number(val);
        };
  
        const t1Id = getID(match.t1);
        const t2Id = getID(match.t2);
    
        const t1Obj = teams.find(t => Number(t.id) === t1Id);
        const t2Obj = teams.find(t => Number(t.id) === t2Id);
    
        if (!t1Obj || !t2Obj) throw new Error(`Teams not found for Match ID: ${match.id}`);
    
        const t1Roster = getTeamRoster(t1Obj.name);
        const t2Roster = getTeamRoster(t2Obj.name);
        const format = match.format || 'BO3';

        // --- 1. QUICK SIM (CPU Matches) ---
        if (!isPlayerMatch) {
            const result = quickSimulateMatch(
                { ...t1Obj, roster: t1Roster }, 
                { ...t2Obj, roster: t2Roster }, 
                format
            );
            
            return {
                winnerName: result.winner,
                scoreString: result.scoreString,
                history: result.history
            };
        }

        // --- 2. HEAVY SIM (Player Matches) ---
        const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0) 
            ? league.currentChampionList 
            : championList;
  
        const simOptions = {
          currentChampionList: safeChampionList,
          difficulty: isPlayerMatch ? league.difficulty : undefined,
          playerTeamName: isPlayerMatch ? myTeam.name : undefined
        };
        
        const result = simulateMatch(
          { ...t1Obj, roster: t1Roster },
          { ...t2Obj, roster: t2Roster },
          format, 
          simOptions
        );
    
        if (!result) throw new Error("Simulation returned null result");
    
        return {
            winnerName: result.winner,
            scoreString: result.scoreString,
            history: result.history
        };
  
      } catch (err) {
        console.error("Simulation Error:", err);
        throw err; 
      }
    };
    
  const handleProceedNextMatch = () => {
    try {
      if (!nextGlobalMatch) return;
  
      // Safe ID check
      const getID = (val) => (val && typeof val === 'object' && val.id) ? val.id : val;
      const myId = String(myTeam.id);
      
      const isPlayerMatch =
        String(getID(nextGlobalMatch.t1)) === myId ||
        String(getID(nextGlobalMatch.t2)) === myId;
  
      if (!isPlayerMatch) {
        // Run the sim (this now calls the fast Quick Sim)
        const result = runSimulationForMatch(nextGlobalMatch, false);
  
        if (!result) throw new Error("Simulation returned null");
  
        // Standardize Score String
        let scoreStr = "2:0"; 
        if (result.scoreString) {
            scoreStr = result.scoreString;
        } else if (result.score) {
            const values = Object.values(result.score);
            if (values.length >= 2) scoreStr = `${values[0]}:${values[1]}`;
        }
  
        // Construct Final Result Object
        const finalResult = { 
            winner: result.winnerName, 
            score: scoreStr,
            history: result.history
        };
  
        // Update League State
        const updatedMatches = league.matches.map(m => 
            m.id === nextGlobalMatch.id ? { ...m, status: 'finished', result: finalResult } : m
        );
  
        const updatedLeague = { ...league, matches: updatedMatches };
        
        updateLeague(league.id, updatedLeague);
        setLeague(updatedLeague);
        recalculateStandings(updatedLeague); 
  
        // Trigger Next Round Checks
        checkAndGenerateNextPlayInRound(updatedMatches);
        checkAndGenerateNextPlayoffRound(updatedMatches);
  
        return;
      }
  
      // If player match, navigate to game
      navigate(`/match/${nextGlobalMatch.id}`);
    } catch (err) {
      console.error("Next Match Error:", err);
      alert("경기 진행 중 오류 발생: " + err.message);
    }
  };
  
    // [FIX] Robust Start Match Handler (Green Button) - Updated for Captain Mode
    const handleStartMyMatch = (mode = 'auto') => {
      try {
        if (!nextGlobalMatch) {
          alert("진행할 경기가 없습니다.");
          return;
        }
    
        // 1. Force IDs to Numbers
        const t1Id = typeof nextGlobalMatch.t1 === 'object' ? nextGlobalMatch.t1.id : Number(nextGlobalMatch.t1);
        const t2Id = typeof nextGlobalMatch.t2 === 'object' ? nextGlobalMatch.t2.id : Number(nextGlobalMatch.t2);
    
        const t1Obj = teams.find(t => Number(t.id) === t1Id);
        const t2Obj = teams.find(t => Number(t.id) === t2Id);
    
        if (!t1Obj || !t2Obj) {
          alert(`팀 데이터 오류! T1 ID: ${t1Id}, T2 ID: ${t2Id}`);
          return;
        }
    
        // 2. Fetch Rosters using the global function (Full Roster for Manual Mode)
        // [MODIFIED] Now using getFullTeamRoster to support substitutes in LiveGamePlayer
        const t1Roster = getFullTeamRoster(t1Obj.name);
        const t2Roster = getFullTeamRoster(t2Obj.name);
  
        // 3. Check for Champion List validity
        const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0) 
            ? league.currentChampionList 
            : championList;
    
        // 4. Set Data for Live Modal (Added isManualMode flag)
        setLiveMatchData({
          match: nextGlobalMatch,
          teamA: { ...t1Obj, roster: t1Roster },
          teamB: { ...t2Obj, roster: t2Roster },
          safeChampionList: safeChampionList,
          isManualMode: mode === 'manual' 
        });
        
        setIsLiveGameMode(true);
    
      } catch (error) {
        console.error("경기 시작 오류:", error);
        alert(`경기 시작 실패: ${error.message}`);
      }
    };
  
    const handleLiveMatchComplete = (match, resultData) => {
      // 1. 매치 결과 업데이트
      const updatedMatches = league.matches.map(m => {
          if (m.id === match.id) {
              return {
                  ...m,
                  status: 'finished',
                  result: {
                      winner: resultData.winner,
                      score: resultData.scoreString,
                      history: resultData.history,
                      posPlayer: resultData.posPlayer // Save Series MVP if exists
                  }
              };
          }
          return m;
      });
  
      // 2. 리그 데이터 저장 및 상태 갱신
      const updatedLeague = { ...league, matches: updatedMatches };
      updateLeague(league.id, updatedLeague);
      setLeague(updatedLeague);
      recalculateStandings(updatedLeague);
  
      // 3. 다음 라운드 생성 체크
      checkAndGenerateNextPlayInRound(updatedMatches);
      checkAndGenerateNextPlayoffRound(updatedMatches);
  
      // 4. 모달 닫기
      setIsLiveGameMode(false);
      setLiveMatchData(null);
      
      setTimeout(() => alert(`경기 종료! 승리: ${resultData.winner}`), 100);
    };
  
    // [3] 드래프트 시작 핸들러
    const handleDraftStart = () => {
      if (hasDrafted) return;
      setIsDrafting(true);
      const pool = teams.filter(t => t.id !== 1 && t.id !== 2);
      setDraftPool(pool);
      setDraftGroups({ baron: [1], elder: [2] }); 
  
      if (isCaptain) {
          if (myTeam.id === 1) { setDraftTurn('user'); } 
          else { setDraftTurn('cpu'); triggerCpuPick(pool, { baron: [1], elder: [2] }, 'cpu'); }
      } else {
          handleAutoDraft(pool);
      }
    };
  
    const pickComputerTeam = (available) => {
      const sorted = [...available].sort((a, b) => b.power - a.power);
      const topTeam = sorted[0];
      const topPower = topTeam.power;
      let chance = 0.5;
      if (topPower >= 84) chance = 0.90; else if (topPower >= 80) chance = 0.70;
      if (Math.random() < chance) return topTeam;
      if (available.length > 1) {
          const others = available.filter(t => t.id !== topTeam.id);
          return others[Math.floor(Math.random() * others.length)];
      }
      return topTeam;
    };
  
    const triggerCpuPick = (currentPool, currentGroups, turn) => {
      draftTimeoutRef.current = setTimeout(() => {
          if (currentPool.length === 0) { finalizeDraft(currentGroups); return; }
          const picked = pickComputerTeam(currentPool);
          const newPool = currentPool.filter(t => t.id !== picked.id);
          let newGroups = { ...currentGroups };
          if (myTeam.id === 1) newGroups.elder.push(picked.id); else newGroups.baron.push(picked.id);
          setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('user');
          if (newPool.length === 0) finalizeDraft(newGroups);
      }, 800);
    };
  
    const handleUserPick = (teamId) => {
      if (draftTurn !== 'user') return;
      const picked = teams.find(t => t.id === teamId);
      const newPool = draftPool.filter(t => t.id !== teamId);
      let newGroups = { ...draftGroups };
      if (myTeam.id === 1) newGroups.baron.push(picked.id); else newGroups.elder.push(picked.id);
      setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('cpu'); 
      if (newPool.length === 0) finalizeDraft(newGroups); else triggerCpuPick(newPool, newGroups, 'cpu');
    };
  
    const handleAutoDraft = (pool) => {
      let currentPool = [...pool];
      let baron = [1]; let elder = [2];
      let turn = 0; 
      while (currentPool.length > 0) {
          const picked = pickComputerTeam(currentPool);
          currentPool = currentPool.filter(t => t.id !== picked.id);
          if (turn === 0) baron.push(picked.id); else elder.push(picked.id);
          turn = 1 - turn;
      }
      finalizeDraft({ baron, elder });
    };
  
    const finalizeDraft = (groups) => {
      const matches = generateSchedule(groups.baron, groups.elder);
      const updated = updateLeague(league.id, { groups, matches });
      if (updated) {
        setLeague(prev => ({...prev, ...updated}));
        setTimeout(() => { setIsDrafting(false); setActiveTab('standings'); alert("팀 구성 및 일정이 완료되었습니다!"); }, 500);
      }
    };
  
    const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
    const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };
  
    const menuItems = [
      { id: 'dashboard', name: '대시보드', icon: '📊' },
      { id: 'roster', name: '로스터', icon: '👥' },
      { id: 'standings', name: '순위표', icon: '🏆' },
      { id: 'playoffs', name: '플레이오프', icon: '👑' },
      { id: 'finance', name: '재정', icon: '💰' },
      { id: 'meta', name: '메타 분석', icon: '🧠' },
      { id: 'schedule', name: '전체 일정', icon: '📅' },
      { id: 'team_schedule', name: '팀 일정', icon: '📆' },
      { id: 'stats', name: '리그 통계', icon: '📈' },
      { id: 'awards', name: '시즌 어워드', icon: '🎖️' },
      { id: 'foreign', name: '해외 리그', icon: '🌍' },
      { id: 'history', name: '역대 기록', icon: '📜' }, // [NEW] Added History Menu
    ];
    
    const myRecord = computedStandings[myTeam.id] || { w: 0, l: 0, diff: 0 };
    const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };
  
    
    
    const baronTotalWins = calculateGroupPoints(league, 'baron');
    const elderTotalWins = calculateGroupPoints(league, 'elder');
  
    
    // REPLACE the old "handleGenerateSuperWeek" with THIS:

    const handleGenerateSuperWeek = () => {
      const newMetaVersion = '16.02';
      
      if (league.metaVersion === newMetaVersion) {
          alert("이미 16.02 메타 패치가 적용되어 있습니다.");
          return;
      }

      // 1. Update Meta (Delegated to SeasonManager)
      const sourceList = (league.currentChampionList && league.currentChampionList.length > 0) 
          ? league.currentChampionList : championList;
      
      const newChampionList = updateChampionMeta(sourceList);
  
      // 2. Generate Schedule (Delegated to SeasonManager)
      const newMatches = generateSuperWeekMatches(league);
      
      // 3. Merge & Sort
      const cleanMatches = league.matches ? league.matches.filter(m => m.type !== 'tbd') : [];
      const updatedMatches = [...cleanMatches, ...newMatches].sort((a, b) => {
          const parse = (d) => parseFloat(d.split(' ')[0]);
          return parse(a.date) - parse(b.date);
      });
  
      // 4. Update State
      const newLeagueState = { 
          matches: updatedMatches,
          currentChampionList: newChampionList,
          metaVersion: newMetaVersion 
      };
  
      setLeague(prev => ({ ...prev, ...newLeagueState }));
      updateLeague(league.id, newLeagueState);
  
      alert(`🔥 16.02 메타 패치 및 슈퍼위크 업데이트 완료!`);
    };

    const handleGeneratePlayIn = () => {
      // 1. Calculate inputs
      const bWins = calculateGroupPoints(league, 'baron');
      const eWins = calculateGroupPoints(league, 'elder');

      // 2. Delegate logic to Manager
      const { newMatches, playInSeeds, seasonSummary } = createPlayInBracket(
          league, 
          computedStandings, 
          teams, 
          bWins, 
          eWins
      );

      // 3. Update State
      const updatedMatches = [...league.matches, ...newMatches];
      const updateData = { matches: updatedMatches, playInSeeds, seasonSummary };
      
      updateLeague(league.id, updateData); 
      setLeague(prev => ({ ...prev, ...updateData }));
      
      setShowPlayInBracket(true);
      alert('🛡️ 플레이-인 대진이 생성되었습니다! (1,2시드 2라운드 직행)');
  };
    
    const isRegularSeasonFinished = league.matches 
      ? league.matches.filter(m => m.type === 'regular').every(m => m.status === 'finished') 
      : false;
    
    const hasSuperWeekGenerated = league.matches
      ? league.matches.some(m => m.type === 'super')
      : false;
  
    const isSuperWeekFinished = league.matches
      ? league.matches.filter(m => m.type === 'super').length > 0 && league.matches.filter(m => m.type === 'super').every(m => m.status === 'finished')
      : false;
  
    const hasPlayInGenerated = league.matches
      ? league.matches.some(m => m.type === 'playin')
      : false;
      
      const isPlayInFinished = hasPlayInGenerated && league.matches.some(m => m.type === 'playin' && m.round === 3 && m.status === 'finished');
      
    const hasPlayoffsGenerated = league.matches
      ? league.matches.some(m => m.type === 'playoff')
      : false;
  
    const handleGeneratePlayoffs = () => {
      if (!isPlayInFinished || hasPlayoffsGenerated) return;
  
      const directPO = league.seasonSummary.poTeams;
      const playInR2Winners = league.matches
          .filter(m => m.type === 'playin' && m.date.includes('2.7') && m.status === 'finished')
          .map(m => teams.find(t => t.name === m.result.winner).id);
      const playInFinalWinner = league.matches
          .filter(m => m.type === 'playin' && m.date.includes('2.8') && m.status === 'finished')
          .map(m => teams.find(t => t.name === m.result.winner).id);
      
      const playInQualifiers = [...playInR2Winners, ...playInFinalWinner];
  
      const playInQualifiersWithOriginalSeed = playInQualifiers.map(id => {
          const originalSeed = league.playInSeeds.find(s => s.id === id);
          return { id, originalSeed: originalSeed ? originalSeed.seed : 99 };
      }).sort((a, b) => a.originalSeed - b.originalSeed);
  
      const playoffSeeds = [
          ...directPO,
          { id: playInQualifiersWithOriginalSeed[0].id, seed: 4 },
          { id: playInQualifiersWithOriginalSeed[1].id, seed: 5 },
          { id: playInQualifiersWithOriginalSeed[2].id, seed: 6 },
      ].sort((a, b) => a.seed - b.seed);
  
      const seed3Team = playoffSeeds.find(s => s.seed === 3);
      const playInTeamsForSelection = playoffSeeds.filter(s => s.seed >= 4);
  
      const generateR1Matches = (pickedTeam) => {
          const remainingTeams = playInTeamsForSelection.filter(t => t.id !== pickedTeam.id);
          const r1m1 = { id: Date.now() + 300, round: 1, match: 1, label: '1라운드', t1: seed3Team.id, t2: pickedTeam.id, date: '2.11 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: seed3Team.id };
          const r1m2 = { id: Date.now() + 301, round: 1, match: 2, label: '1라운드', t1: remainingTeams[0].id, t2: remainingTeams[1].id, date: '2.12 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' };
          
          if (Math.random() < 0.5) {
              [r1m1.date, r1m2.date] = [r1m2.date, r1m1.date];
          }
  
          const newMatches = [...league.matches, r1m1, r1m2];
          updateLeague(league.id, { matches: newMatches, playoffSeeds });
          setLeague(prev => ({ ...prev, matches: newMatches, playoffSeeds }));
          alert("👑 플레이오프 1라운드 대진이 완성되었습니다!");
          setOpponentChoice(null);
          setActiveTab('playoffs');
      };
  
      if (seed3Team.id === myTeam.id) {
          setOpponentChoice({
              type: 'playoff_r1',
              title: '플레이오프 1라운드 상대 선택',
              description: '플레이-인에서 올라온 팀 중 한 팀을 상대로 지명할 수 있습니다.',
              picker: teams.find(t => t.id === seed3Team.id),
              opponents: playInTeamsForSelection.map(s => teams.find(t => t.id === s.id)),
              onConfirm: (pickedTeam) => generateR1Matches(pickedTeam)
          });
      } else {
          const picked = playInTeamsForSelection.find(s => s.seed === 6);
          generateR1Matches(teams.find(t => t.id === picked.id));
      }
    };
  
    const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
    const isSeasonOver = grandFinal && grandFinal.status === 'finished';
  
    const parseDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return 0;
      const parts = dateStr.split(' ')[0].split('.');
      if (parts.length < 2) return 0;
      return parseFloat(parts[0]) * 100 + parseFloat(parts[1]);
    };
  
    let effectiveDate;
    if (isSeasonOver) {
      effectiveDate = '시즌 종료';
    } else if (nextGlobalMatch) {
      effectiveDate = nextGlobalMatch.date;
    } else if (hasDrafted) {
      const lastMatch = league.matches.filter(m => m.status === 'finished').sort((a,b) => parseDate(b.date) - parseDate(a.date))[0];
      if (isPlayInFinished) effectiveDate = "2.9 (월) 이후";
      else if (isSuperWeekFinished) effectiveDate = "2.2 (월) 이후";
      else if (isRegularSeasonFinished) effectiveDate = "1.26 (월) 이후";
      else effectiveDate = lastMatch ? `${lastMatch.date} 이후` : '대진 생성 대기 중';
    } else {
      effectiveDate = '2026 프리시즌';
    }
  
    const getTeamSeed = (teamId, matchType) => {
      const seedData = matchType === 'playin' ? league.playInSeeds : league.playoffSeeds;
      return seedData?.find(s => s.id === teamId)?.seed;
    };
    const formatTeamName = (teamId, matchType) => {
      const t = teams.find(x => x.id === teamId);
      if (!t) return 'TBD';
      
      let name = t.name;
      if ((matchType === 'playin' || matchType === 'playoff') && (league.playInSeeds || league.playoffSeeds)) {
        const s = getTeamSeed(teamId, matchType);
        if (s) {
          name = `${t.name} (${s}시드)`;
        }
      }
      return name;
    };
  
    return (
      <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
        
        {myMatchResult && (
          <DetailedMatchResultModal 
            result={myMatchResult.resultData} 
            teamA={myMatchResult.teamA}
            teamB={myMatchResult.teamB}
            onClose={() => setMyMatchResult(null)} 
          />
        )}
  
        {opponentChoice && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-4 lg:p-8 max-w-lg w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl lg:text-2xl font-black mb-2">{opponentChoice.title}</h2>
                  <p className="text-sm lg:text-base text-gray-600 mb-6">{opponentChoice.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                      {opponentChoice.opponents.map(opp => (
                          <button 
                              key={opp.id}
                              onClick={() => opponentChoice.onConfirm(opp)}
                              className="p-3 lg:p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer"
                          >
                              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-sm lg:text-lg" style={{backgroundColor:opp.colors.primary}}>{opp.name}</div>
                              <div className="font-bold text-sm lg:text-lg">{opp.fullName}</div>
                              <div className="text-xs bg-gray-100 px-3 py-1 rounded-full font-bold">
                                  {getTeamSeed(opp.id, opponentChoice.type.startsWith('playoff') ? 'playoff' : 'playin')} 시드
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
        )}

{showFinalStandings && <FinalStandingsModal league={league} onClose={() => setShowFinalStandings(false)} />}
  
{isLiveGameMode && liveMatchData && (
    <LiveGamePlayer 
        match={liveMatchData.match}
        teamA={liveMatchData.teamA}
        teamB={liveMatchData.teamB}
        // Pass the Manual Mode Flag
        isManualMode={liveMatchData.isManualMode} 
        simOptions={{
            currentChampionList: league.currentChampionList,
            difficulty: league.difficulty,
            playerTeamName: myTeam.name
        }}
        externalGlobalBans={[]} 
        onMatchComplete={handleLiveMatchComplete}
        onClose={() => setIsLiveGameMode(false)}
    />
  )}
  
        {isDrafting && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-2 lg:p-4">
            <div className="bg-white rounded-2xl p-4 lg:p-8 max-w-4xl w-full text-center shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col">
              <h2 className="text-2xl lg:text-3xl font-black mb-2">{isCaptain ? "팀 드래프트 진행" : "조 추첨 진행 중..."}</h2>
              {!isCaptain ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-gray-500">젠지와 한화생명이 팀을 고르고 있습니다...</p>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-center bg-gray-100 p-2 lg:p-4 rounded-lg mb-6">
                          <div className={`w-1/3 p-2 lg:p-3 rounded-lg ${draftTurn === (myTeam.id===1?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                              <span className="font-bold text-sm lg:text-lg block mb-1">GEN (Baron)</span>
                              <div className="flex flex-wrap gap-1 justify-center">{draftGroups.baron.map(id => <span key={id} className="text-[10px] lg:text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                          </div>
                          <div className="w-1/3 text-xl font-bold text-gray-400">VS</div>
                          <div className={`w-1/3 p-2 lg:p-3 rounded-lg ${draftTurn === (myTeam.id===2?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                              <span className="font-bold text-sm lg:text-lg block mb-1">HLE (Elder)</span>
                              <div className="flex flex-wrap gap-1 justify-center">{draftGroups.elder.map(id => <span key={id} className="text-[10px] lg:text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                          </div>
                      </div>
                      <div className="text-left mb-2 font-bold text-gray-700">{draftTurn === 'user' ? "👉 영입할 팀을 선택하세요!" : "🤖 상대가 고민 중입니다..."}</div>
                      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3 overflow-y-auto max-h-[300px] p-2">
                          {draftPool.map(t => (
                              <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'}
                                  className={`p-2 lg:p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 hover:shadow-md ${draftTurn === 'user' ? 'bg-white border-gray-200 hover:border-blue-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}>
                                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-xs" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                                  <div className="font-bold text-xs lg:text-sm truncate w-full">{t.fullName}</div>
                                  <div className="text-[10px] lg:text-xs bg-gray-100 px-2 py-1 rounded">전력 {t.power}</div>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
            </div>
          </div>
        )}
  
        {/* Mobile Toggle Button (Visible only on small screens) */}
        <button 
           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           className="lg:hidden absolute top-3 left-3 z-50 bg-gray-800 text-white p-2 rounded shadow-lg"
        >
           {isSidebarOpen ? '✖' : '☰'}
        </button>

        {/* Responsive Sidebar: Hidden on mobile unless toggled, Fixed on Desktop */}
        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative w-64 h-full bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-40 transition-transform duration-300 ease-in-out`}>
          <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3 mt-10 lg:mt-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
            <div><div className="text-white font-bold text-sm leading-tight">{myTeam.fullName}</div><div className="text-xs text-gray-400">GM 모드</div></div>
          </div>
          <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}><span>{item.icon}</span> {item.name}</button>
            ))}
          </div>
          <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
        </aside>
  
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
          {/* Overlay for mobile sidebar */}
          {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

        <header className="bg-white border-b min-h-14 flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 flex-shrink-0 overflow-x-auto">
          {/* Header Info - Hidden on very small screens, scrollable on others */}
          <div className="flex items-center gap-3 lg:gap-6 text-xs lg:text-sm pl-8 lg:pl-0 whitespace-nowrap">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {effectiveDate}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패 ({myRecord.diff > 0 ? `+${myRecord.diff}` : myRecord.diff})</div>
            <div className="hidden sm:flex h-4 w-px bg-gray-300"></div>
            <div className="hidden sm:flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">💰</span> {prizeMoney.toFixed(1)}억</div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-3 ml-4">
            {isSeasonOver && (
               <button 
               onClick={() => setShowFinalStandings(true)} 
               className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gray-900 hover:bg-black text-yellow-400 shadow-sm flex items-center gap-2 transition border-2 border-yellow-500 animate-pulse whitespace-nowrap"
             >
                 <span>🏆</span> <span className="hidden sm:inline">최종 순위</span>
             </button>
            )}

            {hasDrafted && isRegularSeasonFinished && (!hasSuperWeekGenerated || league.metaVersion !== '16.02') && (
                 <button 
                 onClick={handleGenerateSuperWeek} 
                 className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
               >
                   <span>🔥</span> <span className="hidden sm:inline">슈퍼위크</span>
               </button>
            )}

            {isSuperWeekFinished && !hasPlayInGenerated && (
                <button 
                onClick={handleGeneratePlayIn} 
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
              >
                  <span>🛡️</span> <span className="hidden sm:inline">플레이-인</span>
              </button>
            )} 

            {isPlayInFinished && !hasPlayoffsGenerated && (
                <button 
                onClick={handleGeneratePlayoffs} 
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
              >
                  <span>👑</span> <span className="hidden sm:inline">PO 대진</span>
              </button>
            )}
            
            {hasDrafted && nextGlobalMatch && !isMyNextMatch && 
             !(nextGlobalMatch.type === 'super' && league.metaVersion !== '16.02') && (
                <button 
                  onClick={handleProceedNextMatch} 
                  className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-pulse transition whitespace-nowrap"
                >
                    <span>⏩</span> <span className="hidden sm:inline">다음 경기 ({t1?.name} vs {t2?.name})</span><span className="sm:hidden">진행</span>
                </button>
            )}

            <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-3 lg:px-6 py-1.5 rounded-full font-bold text-xs lg:text-sm shadow-sm transition flex items-center gap-2 whitespace-nowrap ${hasDrafted ? 'bg-gray-100 text-gray-400 cursor-not-allowed hidden' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}`}>
                <span>▶</span> {hasDrafted ? "" : (isCaptain ? "팀 선정" : "조 추첨")}
            </button>
          </div>
        </header>

          <main className="flex-1 overflow-y-auto p-2 lg:p-6 scroll-smooth">
            <div className="max-w-7xl mx-auto">
                
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
                  {/* 대시보드 메인 카드 */}
                  <div className="col-span-1 lg:col-span-8 bg-white rounded-lg border shadow-sm p-4 lg:p-5 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl pointer-events-none">📅</div>
                     <h3 className="text-lg font-bold text-gray-800 mb-2">다음 경기 일정</h3>
                     <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 lg:p-6 border">
                        <div className="text-center w-1/3"><div className="text-lg lg:text-4xl font-black text-gray-800 mb-2 truncate">{t1 ? t1.name : '?'}</div></div>
                        <div className="text-center w-1/3 flex flex-col items-center">
                          <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-lg lg:text-3xl font-bold text-gray-300 my-1 lg:my-2">@</div>
                          {nextGlobalMatch ? (
                            <div className="mt-1 flex flex-col items-center">
                              <span className="text-xs lg:text-base font-black text-blue-600">{nextGlobalMatch.date}</span>
                              <span className="text-[10px] lg:text-sm font-bold text-gray-600">{nextGlobalMatch.time}</span>
                              <span className="mt-2 text-[10px] lg:text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                                  {nextGlobalMatch.label || nextGlobalMatch.format}
                              </span>
                              
                              {isMyNextMatch ? (
                                  <div className="flex flex-col gap-2 mt-3 w-full">
                                      <button 
                                        onClick={() => handleStartMyMatch('manual')} 
                                        className="w-full px-2 lg:px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs lg:text-base rounded-lg shadow-md transform transition hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                                      >
                                          <span>🎮</span> 경기 시작 (직접)
                                      </button>
                                      
                                      <button 
                                        onClick={() => handleStartMyMatch('auto')} 
                                        className="w-full px-2 lg:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs lg:text-base rounded-lg shadow-md transform transition hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                                      >
                                          <span>📺</span> 경기 시작 (AI)
                                      </button>
                                  </div>
                              ) : (
                                  <div className="mt-3 text-[10px] lg:text-sm font-bold text-gray-400 bg-white px-3 py-1 rounded border">
                                      상단바 [⏩] 버튼 클릭
                                  </div>
                              )}
                            </div>
                          ) : <div className="text-xs font-bold text-blue-600">{isSeasonOver ? '시즌 종료' : '대진 생성 대기 중'}</div>}
                        </div>
                        <div className="text-center w-1/3">
                            <div className="text-lg lg:text-4xl font-black text-gray-800 mb-2 truncate">{t2 ? t2.name : '?'}</div>
                        </div>
                     </div>
                  </div>
                  
                  <div className="col-span-1 lg:col-span-4 flex flex-col h-full max-h-[400px] lg:max-h-[500px]">
                     {hasDrafted ? (
                       <div className="bg-white rounded-lg border shadow-sm p-4 h-full overflow-y-auto flex flex-col">
                          
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="font-bold text-gray-800 text-sm">
                                  {hasPlayoffsGenerated ? '👑 플레이오프' : (hasPlayInGenerated ? '🛡️ 플레이-인' : '순위표')}
                              </h3>
                              {(hasPlayInGenerated && !hasPlayoffsGenerated) && (
                                  <button onClick={() => setShowPlayInBracket(!showPlayInBracket)} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 font-bold">
                                      {showPlayInBracket ? '순위표 보기' : '대진표 보기'}
                                  </button>
                              )}
                          </div>
  
                          {(hasPlayoffsGenerated || (hasPlayInGenerated && showPlayInBracket)) ? (
                              <div className="flex-1 space-y-3">
                                  {[...league.matches]
                                      .filter(m => m.type === (hasPlayoffsGenerated ? 'playoff' : 'playin'))
                                      .sort((a,b) => a.id - b.id)
                                      .map(m => (
                                      <div key={m.id} className="bg-gray-50 border rounded p-2 text-xs">
                                          <div className="font-bold text-gray-400 mb-1">{m.label || m.date}</div>
                                          <div className="flex justify-between items-center">
                                              <div className={`font-bold ${m.result?.winner === teams.find(t=>t.id===m.t1)?.name ? 'text-green-600' : 'text-gray-700'}`}>{formatTeamName(m.t1, m.type)}</div>
                                              <div className="text-gray-400 font-bold">{m.status === 'finished' ? m.result.score : 'vs'}</div>
                                              <div className={`font-bold ${m.result?.winner === teams.find(t=>t.id===m.t2)?.name ? 'text-green-600' : 'text-gray-700'}`}>{formatTeamName(m.t2, m.type)}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <>
                                  <div className="mb-2 text-center text-xs font-bold text-gray-500 bg-gray-100 py-1 rounded">
                                  그룹 대항전 총점: <span className="text-purple-600">Baron {baronTotalWins}</span> vs <span className="text-red-600">Elder {elderTotalWins}</span>
                                  </div>
                                  <div className="space-y-6">
                                      {[
                                          { id: 'baron', name: 'Baron Group', color: 'purple', icon: '🟣' },
                                          { id: 'elder', name: 'Elder Group', color: 'red', icon: '🔴' }
                                      ].map(group => (
                                          <div key={group.id}>
                                              <div className={`flex items-center gap-2 mb-2 border-b border-${group.color}-100 pb-2`}>
                                                  <span className="text-lg">{group.icon}</span>
                                                  <span className={`font-black text-sm text-${group.color}-700`}>{group.name}</span>
                                              </div>
                                              <table className="w-full text-xs min-w-max">
                                                  <thead className="bg-gray-50 text-gray-400">
                                                      <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left whitespace-nowrap">팀</th><th className="p-2 text-center w-12 whitespace-nowrap">W-L</th><th className="p-2 text-center w-10 whitespace-nowrap">득실</th></tr>
                                                  </thead>
                                                  <tbody>
                                                  {sortGroupByStandings(league.groups[group.id] || [], computedStandings).map((id, idx) => {
                                                          const t = teams.find(team => team.id === id);
                                                          const isMyTeam = myTeam.id === id;
                                                          const rec = computedStandings[id] || {w:0, l:0, diff:0};
                                                          
                                                          let statusBadge = null;
                                                          if (league.seasonSummary) {
                                                              const summary = league.seasonSummary;
                                                              const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                              const piInfo = summary.playInTeams.find(pit => pit.id === id);
                                                              
                                                              if (poInfo) statusBadge = <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1 font-bold whitespace-nowrap">PO {poInfo.seed}시드</span>;
                                                              else if (piInfo) statusBadge = <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1 font-bold whitespace-nowrap">PI {piInfo.seed}시드</span>;
                                                              else if (summary.eliminated === id) statusBadge = <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1 font-bold whitespace-nowrap">OUT</span>;
                                                          }
  
                                                          return (
                                                              <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 transition-colors ${isMyTeam ? `bg-${group.color}-50` : 'hover:bg-gray-50'}`}>
                                                                  <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                                                  <td className="p-2 font-bold flex items-center">
                                                                      <span className={`${isMyTeam ? 'text-blue-700' : 'text-gray-800'} hover:underline whitespace-nowrap`}>{t.fullName}</span>
                                                                      {statusBadge}
                                                                  </td>
                                                                  <td className="p-2 text-center whitespace-nowrap">{rec.w} - {rec.l}</td><td className="p-2 text-center text-gray-400 whitespace-nowrap">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                                              </tr>
                                                          );
                                                      })}
                                                  </tbody>
                                              </table>
                                          </div>
                                      ))}
                                  </div>
                              </>
                          )}
                       </div>
                     ) : (
                       <div className="bg-white rounded-lg border shadow-sm p-0 flex-1 flex flex-col">
                         <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span >순위표 (프리시즌)</span><span onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 cursor-pointer hover:underline">전체 보기</span></div>
                         <div className="flex-1 overflow-y-auto p-0">
                           <div className="p-4 text-center text-gray-400 text-xs">시즌 시작 전입니다.</div>
                         </div>
                       </div>
                     )}
                  </div>
  
                  <div className="col-span-1 lg:col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[300px] lg:min-h-[500px]">
                    <div className="p-3 lg:p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <div className="flex items-center gap-4"><div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-lg lg:text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                      <button onClick={()=>setActiveTab('roster')} className="text-xs lg:text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                    </div>
                    <div className="p-0 overflow-x-auto">
                      <table className="min-w-max w-full text-xs text-left border-collapse">
                          <thead className="bg-white text-gray-400 uppercase font-bold border-b">
                              <tr>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">라인</th>
                                  <th className="py-2 px-3 whitespace-nowrap">이름</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">OVR</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">나이</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">경력</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">소속</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">연봉</th>
                                  <th className="py-2 px-3 text-center whitespace-nowrap">POT</th>
                                  <th className="py-2 px-3 text-left whitespace-nowrap">계약</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {currentRoster.length > 0 ? currentRoster.map((p, i) => (
                                  <tr key={i} className="hover:bg-gray-50 transition">
                                      <td className="py-2 px-3 font-bold text-gray-400 text-center whitespace-nowrap">{p.포지션}</td>
                                      <td className="py-2 px-3 font-bold text-gray-800 whitespace-nowrap">{p.이름} <span className="text-gray-400 font-normal text-[10px] hidden lg:inline">({p.실명})</span> {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</td>
                                      <td className="py-2 px-3 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                      <td className="py-2 px-3 text-center text-gray-600 whitespace-nowrap">{p.나이 || '-'}</td>
                                      <td className="py-2 px-3 text-center text-gray-600 whitespace-nowrap">{p.경력 || '-'}</td>
                                      <td className="py-2 px-3 text-center text-gray-700 whitespace-nowrap">{p['팀 소속기간'] || '-'}</td>
                                      <td className="py-2 px-3 text-center text-gray-700 font-bold whitespace-nowrap">{p.연봉 || '-'}</td>
                                      <td className="py-2 px-3 text-center"><span className={`text-[10px] ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                      <td className="py-2 px-3 text-gray-500 font-medium whitespace-nowrap">{p.계약}</td>
                                  </tr>
                              )) : <tr><td colSpan="9" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}
                          </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
  
             {activeTab === 'standings' && (
                <StandingsTab 
                    league={league}
                    teams={teams}
                    myTeam={myTeam}
                    computedStandings={computedStandings}
                    setViewingTeamId={setViewingTeamId}
                    hasDrafted={hasDrafted}
                    baronTotalWins={baronTotalWins}
                    elderTotalWins={elderTotalWins}
                />
                      )}
              
              {activeTab === 'playoffs' && (
                <PlayoffTab 
                    league={league}
                    teams={teams}
                    hasPlayoffsGenerated={hasPlayoffsGenerated}
                    handleMatchClick={handleMatchClick}
                    formatTeamName={formatTeamName}
                />
            )}
  
              {activeTab === 'finance' && (
                <FinanceTab 
                    viewingTeam={viewingTeam}
                    finance={finance}
                    onPrevTeam={handlePrevTeam}
                    onNextTeam={handleNextTeam}
                />
            )}
  
                 {activeTab === 'roster' && (
                    <RosterTab 
                    viewingTeam={viewingTeam} 
                    roster={currentRoster} 
                    onPrevTeam={handlePrevTeam} 
                    onNextTeam={handleNextTeam} 
                    />
                      )}

{            activeTab === 'meta' && (
                <MetaTab 
                    league={league}
                    championList={championList}
                    metaRole={metaRole}
                    setMetaRole={setMetaRole}
                />
            )}

            {activeTab === 'stats' && (
                <StatsTab 
                    league={league}
                />
            )}
  
               {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
                <ScheduleTab 
                    activeTab={activeTab}
                    league={league}
                    teams={teams}
                    myTeam={myTeam}
                    hasDrafted={hasDrafted}
                    formatTeamName={formatTeamName}
                    onMatchClick={handleMatchClick} 
                />
            )} 

{activeTab === 'awards' && (
    <AwardsTab league={league} teams={teams} playerList={playerList} />
)}

{activeTab === 'foreign' && (
    <ForeignLeaguesTab />
)}

{/* [NEW] History Tab Render */}
{activeTab === 'history' && (
    <HistoryTab league={league} />
)}
  
            </div>
          </main>
        </div>
      </div>
    );
  }