// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teams, teamFinanceData } from '../data/teams';
import { championList, difficulties } from '../data/constants';
import { simulateMatch, getTeamRoster, generateSchedule } from '../engine/simEngine';
import LiveGamePlayer from '../components/LiveGamePlayer';
import DetailedMatchResultModal from '../components/DetailedMatchResultModal';
import playerList from '../data/players.json';

// Helper functions (Paste getLeagues, updateLeague, etc here if they aren't used elsewhere)
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { 
    leagues[index] = { ...leagues[index], ...u }; 
    localStorage.setItem('lckgm_leagues', JSON.stringify(leagues));
    return leagues[index];
  }
  return null;
};
const getLeagueById = (id) => getLeagues().find(l => l.id === id);

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
  
    // 드래프트 상태
    const [isDrafting, setIsDrafting] = useState(false);
    const [draftPool, setDraftPool] = useState([]);
    const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
    const [draftTurn, setDraftTurn] = useState('user');
    const draftTimeoutRef = useRef(null);
  
    // 메타 분석 탭 상태
    const [metaRole, setMetaRole] = useState('TOP');
  
    // 시뮬레이션 결과 모달 상태 (내 경기용 상세 모달)
    const [myMatchResult, setMyMatchResult] = useState(null);
  
    // 로컬 순위표 상태 (버그 수정용: API 호출 대신 계산된 값 사용)
    const [computedStandings, setComputedStandings] = useState({});
  
    // 플레이-인/플레이오프 상대 선택 모달 상태
    const [opponentChoice, setOpponentChoice] = useState(null); // { type: 'playin' | 'playoff', ...data }

    const [showFinalStandings, setShowFinalStandings] = useState(false);
  
    useEffect(() => {
      const loadData = () => {
        const found = getLeagueById(leagueId);
        if (found) {
          // 데이터 무결성 검사 및 초기화
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

    useEffect(() => {
      if (isSeasonOver && league) {
        // Use the existing logic to calculate final ranks
        const standings = getFinalStandings();
        const myRankEntry = standings.find(s => s.team.id === myTeam.id);

        if (myRankEntry) {
          let reward = 0.1; // Default (4th - 10th)
          if (myRankEntry.rank === 1) reward = 0.5;
          else if (myRankEntry.rank === 2) reward = 0.25;
          else if (myRankEntry.rank === 3) reward = 0.2;

          setPrizeMoney(reward);
        }
      }
    }, [isSeasonOver]); // Only runs when season status changes
  
    // Fix 1: 순위표 재계산 함수 (전체 매치 기록 기반)
    // [수정 1] 순위표 계산 함수 (플레이오프/플레이인 제외 로직 강화)
    const recalculateStandings = (lg) => {
      const newStandings = {};
      
      // Initialize 0-0-0 for all teams
      teams.forEach(t => { newStandings[t.id] = { w: 0, l: 0, diff: 0 }; });
    
      if (lg.matches) {
          lg.matches.forEach(m => {
              // [CRITICAL FIX] Explicitly only count 'regular' and 'super' matches.
              if (m.type !== 'regular' && m.type !== 'super') return;
    
              if (m.status === 'finished') {
                  const winner = teams.find(t => t.name === m.result.winner);
                  
                  // Handle ID types safely
                  const t1Id = typeof m.t1 === 'object' ? m.t1.id : m.t1;
                  const t2Id = typeof m.t2 === 'object' ? m.t2.id : m.t2;
                  
                  if (!winner) return;
                  
                  const actualLoserId = (t1Id === winner.id) ? t2Id : t1Id;
                  
                  if (winner && actualLoserId) {
                      newStandings[winner.id].w += 1;
                      newStandings[actualLoserId].l += 1;
                      
                      if (m.result.score) {
                          const parts = m.result.score.split(':');
                          if (parts.length === 2) {
                              const s1 = parseInt(parts[0]);
                              const s2 = parseInt(parts[1]);
                              const diff = Math.abs(s1 - s2);
                              
                              newStandings[winner.id].diff += diff;
                              newStandings[actualLoserId].diff -= diff;
                          }
                      }
                  }
              }
          });
      }
      
      setComputedStandings(newStandings);
    };
  
    const handleMenuClick = (tabId) => {
      setActiveTab(tabId);
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
  
    // [FIX] ID Normalization Helper to safely compare IDs (String vs Number)
    const safeId = (id) => (typeof id === 'object' ? id.id : Number(id));
  
    // [FIX] Updated logic using safeId to prevent type mismatch errors
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
      recalculateStandings(updatedLeague); // 순위표 즉시 갱신
      
      checkAndGenerateNextPlayInRound(updatedMatches);
      checkAndGenerateNextPlayoffRound(updatedMatches);
    };
  
    const generatePlayInRound2 = (matches, seed1, seed2, pickedTeam, remainingTeam) => {
        const r2Matches = [
            { id: Date.now() + 100, t1: seed1.id, t2: pickedTeam.id, date: '2.7 (토)', time: '17:00', type: 'playin', format: 'BO3', status: 'pending', round: 2, label: '플레이-인 2라운드' },
            { id: Date.now() + 101, t1: seed2.id, t2: remainingTeam.id, date: '2.7 (토)', time: '19:30', type: 'playin', format: 'BO3', status: 'pending', round: 2, label: '플레이-인 2라운드' }
        ];
        
        const newMatches = [...matches, ...r2Matches].sort((a,b) => parseFloat(a.date.split(' ')[0]) - parseFloat(b.date.split(' ')[0]));
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("플레이-인 2라운드 대진이 완성되었습니다!");
        setOpponentChoice(null);
    };
  
    // [FIX] Robust Round Progression using 'round' ID instead of Date strings
    // [FIX] Robust Round Progression for Play-In (R1 -> R2 -> Final)
  // [REPLACE] Function: checkAndGenerateNextPlayInRound
  // Location: Inside Dashboard component, around line 1500
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
           // Fallback logic could be added here, but for now we rely on seeds being present
           // We will manually fetch seeds 1 and 2 from teams if possible, or just skip
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
        // Logic: If user is Seed 1, opponentChoice handles it. If user is NOT Seed 1, we auto-gen.
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
        const losers = r2Matches.map(m => {
           const winnerName = m.result.winner;
           const t1Id = typeof m.t1 === 'object' ? m.t1.id : m.t1;
           const t2Id = typeof m.t2 === 'object' ? m.t2.id : m.t2;
           const t1Obj = teams.find(t => t.id === t1Id);
           const t2Obj = teams.find(t => t.id === t2Id);
           return t1Obj.name === winnerName ? t2Obj : t1Obj;
        });
  
        const finalMatch = { id: Date.now() + 200, t1: losers[0].id, t2: losers[1].id, date: '2.8 (일)', time: '17:00', type: 'playin', format: 'BO5', status: 'pending', round: 3, label: '플레이-인 최종전', blueSidePriority: 'coin' };
        const newMatches = [...matches, finalMatch].sort((a,b) => parseFloat(a.date.split(' ')[0]) - parseFloat(b.date.split(' ')[0]));
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("🛡️ 플레이-인 최종전(2라운드 패자 대결) 대진이 완성되었습니다!");
    }
  };
  
  // [FIX] Robust Playoff Progression using 'round' ID
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
            
            const newPlayoffMatches = [
                // R2 Winners (Higher Seeds are t1 -> Blue Side)
                { id: Date.now() + 400, round: 2, match: 1, label: '승자조 2R', t1: seed1, t2: pickedWinner.id, date: '2.13 (금)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
                { id: Date.now() + 401, round: 2, match: 2, label: '승자조 2R', t1: seed2, t2: remainingWinner, date: '2.13 (금)', time: '19:30', type: 'playoff', format: 'BO5', status: 'pending' },
                // R2 Losers (Random priority for losers bracket R1)
                { id: Date.now() + 402, round: 2.1, match: 1, label: '패자조 1R', t1: r1Losers[0].id, t2: r1Losers[1].id, date: '2.14 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
            ];
            
            const allMatches = [...currentMatches, ...newPlayoffMatches];
            updateLeague(league.id, { matches: allMatches });
            setLeague(prev => ({ ...prev, matches: allMatches }));
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
            // If the winner of Match 1 was the lower seed (Seed 6), Seed 1 avoids them if possible? 
            // Default LCK logic: Seed 1 picks. AI picks random for now.
            const r1m1Seed3 = r1Matches.find(m => m.match === 1).t1;
            
            let pickedId;
            // Simple logic: Seed 1 picks the winner of the Seed 3 vs 6 match usually if 6 wins? 
            // Randomize for variety
            pickedId = Math.random() < 0.5 ? r1m1Winner : r1m2Winner;
            generateR2Matches(teams.find(t => t.id === pickedId));
        }
        return; 
    }
  
    // --- R2 -> R3 ---
    const r2wMatches = currentMatches.filter(m => m.type === 'playoff' && m.round === 2);
    const r2lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 2.1);
    const r2Finished = r2wMatches.length === 2 && r2wMatches.every(m => m.status === 'finished') && r2lMatch?.status === 'finished';
    const r3Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 3);
  
    if (r2Finished && !r3Exists) {
        const r2wWinners = r2wMatches.map(m => getWinner(m));
        const r2wLosers = r2wMatches.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed); // Sort losers by seed (Higher seed gets priority)
        
        const r2lWinner = getWinner(r2lMatch);
  
        const newPlayoffMatches = [
            // Winner Bracket Final (Coin flip for side usually, or higher seed priority logic can be added)
            { id: Date.now() + 500, round: 3, match: 1, label: '승자조 결승', t1: r2wWinners[0], t2: r2wWinners[1], date: '2.18 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
            // Loser Bracket R2 (Higher seed loser vs R1 loser winner)
            { id: Date.now() + 501, round: 2.2, match: 1, label: '패자조 2R', t1: r2wLosers[1].id, t2: r2lWinner, date: '2.15 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
        ];
  
        const allMatches = [...currentMatches, ...newPlayoffMatches];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 승자조 및 2라운드 패자조 경기가 생성되었습니다!");
        return;
    }
    
    // --- R2.2 & R3 -> R3 Loser ---
    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lExists = currentMatches.some(m => m.type === 'playoff' && m.round === 3.1);
  
    if (r2_2Match?.status === 'finished' && r3wMatch?.status === 'finished' && !r3lExists) {
        const r2wMatchesFinished = currentMatches.filter(m => m.round === 2 && m.status === 'finished');
        const r2wLosers = r2wMatchesFinished.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed); 
        
        // Highest seed loser from Winner bracket R2 waits here
        const highestSeedLoser = r2wLosers[0].id;
        const r2_2Winner = getWinner(r2_2Match);
  
        const newMatch = { id: Date.now() + 600, round: 3.1, match: 1, label: '패자조 3R', t1: highestSeedLoser, t2: r2_2Winner, date: '2.19 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 패자조 경기가 생성되었습니다!");
        return;
    }
  
    // --- R4 Qualifier (Loser Bracket Final) ---
    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);
    const r4Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 4);
  
    if (r3lMatch?.status === 'finished' && r3wMatch?.status === 'finished' && !r4Exists) {
        const r3wLoser = getLoser(r3wMatch); // Comes from Winner Final, so Higher seed
        const r3lWinner = getWinner(r3lMatch);
  
        const newMatch = { id: Date.now() + 700, round: 4, match: 1, label: '결승 진출전', t1: r3wLoser, t2: r3lWinner, date: '2.21 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 결승 진출전이 생성되었습니다!");
        return;
    }
  
    // --- Grand Final ---
    const r4Match = currentMatches.find(m => m.type === 'playoff' && m.round === 4);
    const finalExists = currentMatches.some(m => m.type === 'playoff' && m.round === 5);
  
    if (r4Match?.status === 'finished' && r3wMatch?.status === 'finished' && !finalExists) {
        const r3wWinner = getWinner(r3wMatch); // Winner Bracket Champion
        const r4Winner = getWinner(r4Match);   // Loser Bracket Champion
  
        const newMatch = { id: Date.now() + 800, round: 5, match: 1, label: '결승전', t1: r3wWinner, t2: r4Winner, date: '2.22 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("🏆 대망의 결승전이 생성되었습니다!");
        return;
    }
  };
  
    // [REPLACE] Function: runSimulationForMatch
    // Location: Inside Dashboard component, before handleProceedNextMatch
    // [FIX 2] Use simulateMatch for BO3/BO5 results (Set Score) instead of single set (Kill Score)
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
    
        if (!t1Obj || !t2Obj) {
          throw new Error(`Teams not found for Match ID: ${match.id}`);
        }
    
        const t1Roster = getTeamRoster(t1Obj.name);
        const t2Roster = getTeamRoster(t2Obj.name);
    
        const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0) 
            ? league.currentChampionList 
            : championList;
  
        const simOptions = {
          currentChampionList: safeChampionList,
          difficulty: isPlayerMatch ? league.difficulty : undefined,
          playerTeamName: isPlayerMatch ? myTeam.name : undefined
        };
        
        // Changed from simulateSet to simulateMatch to get Set Scores (2:0, 2:1)
        const format = match.format || 'BO3';
        const result = simulateMatch(
          { ...t1Obj, roster: t1Roster },
          { ...t2Obj, roster: t2Roster },
          format, 
          simOptions
        );
    
        if (!result) throw new Error("Simulation returned null result");
    
        // Result from simulateMatch already contains { scoreString: "2:0", winner: "Name" }
        return {
            winnerName: result.winner,
            scoreString: result.scoreString
        };
  
      } catch (err) {
        console.error("Simulation Error:", err);
        throw err; 
      }
    };
    
  // ==========================================
    // [수정됨] Dashboard 내부 로직 통합 (여기서부터 복사하세요)
    // ==========================================
  // [FIX] 1. Missing Function for Blue Button
  // [REPLACE FUNCTION handleProceedNextMatch]
  // [REPLACE] Function: handleProceedNextMatch inside Dashboard component
  // [FIX] Ensure Play-In and Playoff matches are processable via the Blue Button
  const handleProceedNextMatch = () => {
    try {
      if (!nextGlobalMatch) return;
  
      // [FIX] Use safe ID check for button logic
      const getID = (val) => (val && typeof val === 'object' && val.id) ? val.id : val;
      const myId = String(myTeam.id);
      
      const isPlayerMatch =
        String(getID(nextGlobalMatch.t1)) === myId ||
        String(getID(nextGlobalMatch.t2)) === myId;
  
      if (!isPlayerMatch) {
        // For Play-In/Playoffs, the object structure might differ slightly (e.g. format field)
        // but runSimulationForMatch handles ID resolution.
        const result = runSimulationForMatch(nextGlobalMatch, false);
  
        if (!result) throw new Error("Simulation returned null");
  
        // [FIX] Improved Score Parsing for various match formats
        let scoreStr = "2:0"; 
        if (result.scoreString) {
            scoreStr = result.scoreString;
        } else if (result.score) {
            // If score is an object { TeamA: '2', TeamB: '1' }
            const values = Object.values(result.score);
            if (values.length >= 2) scoreStr = `${values[0]}:${values[1]}`;
        }
  
        const finalResult = { 
            winner: result.winnerName, 
            score: scoreStr 
        };
  
        const updatedMatches = league.matches.map(m => 
            m.id === nextGlobalMatch.id ? { ...m, status: 'finished', result: finalResult } : m
        );
  
        const updatedLeague = { ...league, matches: updatedMatches };
        
        updateLeague(league.id, updatedLeague);
        setLeague(updatedLeague);
        recalculateStandings(updatedLeague); // Update standings immediately
  
        // [IMPORTANT] Trigger next round generation checks immediately after simulation
        checkAndGenerateNextPlayInRound(updatedMatches);
        checkAndGenerateNextPlayoffRound(updatedMatches);
  
        return;
      }
  
      // If it is player match, navigate to match view
      navigate(`/match/${nextGlobalMatch.id}`);
    } catch (err) {
      console.error("Next Match Error:", err);
      alert("경기 진행 중 오류 발생: " + err.message);
    }
  };
  
    // [1] 내 경기 시작하기 (안전장치 추가됨)
    // [1] 내 경기 시작하기 (안전장치 추가됨)
    // [FIX] 2. Robust Start Match Handler (Green Button)
    const handleStartMyMatch = () => {
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
    
        // 2. Fetch Rosters using the global function
        const t1Roster = getTeamRoster(t1Obj.name);
        const t2Roster = getTeamRoster(t2Obj.name);
  
        // 3. Check for Champion List validity
        const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0) 
            ? league.currentChampionList 
            : championList;
    
        // 4. Set Data for Live Modal
        setLiveMatchData({
          match: nextGlobalMatch,
          teamA: { ...t1Obj, roster: t1Roster },
          teamB: { ...t2Obj, roster: t2Roster },
          // Pass the safe list specifically for the live mode
          safeChampionList: safeChampionList 
        });
        
        setIsLiveGameMode(true);
    
      } catch (error) {
        console.error("경기 시작 오류:", error);
        alert(`경기 시작 실패: ${error.message}`);
      }
    };
  
    // [2] 경기 종료 처리 (이 함수가 없으면 흰 화면 뜸)
    const handleLiveMatchComplete = (match, resultData) => {
      // 1. 매치 결과 업데이트
      const updatedMatches = league.matches.map(m => {
          if (m.id === match.id) {
              return {
                  ...m,
                  status: 'finished',
                  result: {
                      winner: resultData.winner,
                      score: resultData.scoreString
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
  
      // 3. 다음 라운드 생성 체크 (플레이인/플레이오프)
      checkAndGenerateNextPlayInRound(updatedMatches);
      checkAndGenerateNextPlayoffRound(updatedMatches);
  
      // 4. 모달 닫기 및 데이터 초기화
      setIsLiveGameMode(false);
      setLiveMatchData(null);
      
      // 5. 알림
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
      { id: 'schedule', name: '일정', icon: '📅' },
      { id: 'team_schedule', name: '팀 일정', icon: '📅' },
      { id: 'meta', name: '메타', icon: '📈' }, 
    ];
    
    const myRecord = computedStandings[myTeam.id] || { w: 0, l: 0, diff: 0 };
    const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };
  
    const getSortedGroup = (groupIds) => {
      return groupIds.sort((a, b) => {
        const recA = computedStandings[a] || { w: 0, diff: 0 };
        const recB = computedStandings[b] || { w: 0, diff: 0 };
        if (recA.w !== recB.w) return recB.w - recA.w;
        return recB.diff - recA.diff;
      });
    };
  
    const calculateGroupScore = (groupType) => {
      if (!league.groups || !league.groups[groupType]) return 0;
      const groupIds = league.groups[groupType];
      
      return league.matches.filter(m => {
          if (m.status !== 'finished') return false;
          // [CRITICAL FIX] Ensure only Regular and Super matches count for Group Scores
          if (m.type !== 'regular' && m.type !== 'super') return false;
          
          const winnerTeam = teams.find(t => t.name === m.result.winner);
          if (!winnerTeam) return false;
          return groupIds.includes(winnerTeam.id);
      }).reduce((acc, m) => acc + (m.type === 'super' ? 2 : 1), 0);
    };
    
    const baronTotalWins = calculateGroupScore('baron');
    const elderTotalWins = calculateGroupScore('elder');
  
    const updateChampionMeta = (currentChamps) => {
      const probabilities = {
          1: { 1: 0.40, 2: 0.40, 3: 0.15, 4: 0.04, 5: 0.01 },
          2: { 1: 0.25, 2: 0.40, 3: 0.25, 4: 0.08, 5: 0.02 },
          3: { 1: 0.07, 2: 0.23, 3: 0.40, 4: 0.23, 5: 0.07 },
          4: { 1: 0.02, 2: 0.08, 3: 0.25, 4: 0.40, 5: 0.25 },
          5: { 1: 0.01, 2: 0.04, 3: 0.15, 4: 0.25, 5: 0.40 },
      };
  
      const getNewTier = (currentTier) => {
          const rand = Math.random();
          let cumulative = 0;
          const chances = probabilities[currentTier];
          for (const tier in chances) {
              cumulative += chances[tier];
              if (rand < cumulative) {
                  return parseInt(tier, 10);
              }
          }
          return currentTier; 
      };
  
      const newChampionList = currentChamps.map(champ => {
          let newTier = getNewTier(champ.tier);
          return { ...champ, tier: newTier };
      });
  
      return newChampionList;
    };
  
    const handleGenerateSuperWeek = () => {
      const newChampionList = updateChampionMeta(league.currentChampionList);
      const newMetaVersion = '16.02';
  
      const baronSorted = getSortedGroup([...league.groups.baron]);
      const elderSorted = getSortedGroup([...league.groups.elder]);
      let newMatches = [];
      const days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 
  
      let pairs = [];
      for(let i=0; i<5; i++) {
          pairs.push({ t1: baronSorted[i], t2: elderSorted[i], rank: i+1 });
      }
      pairs.sort(() => Math.random() - 0.5);
  
      const cleanMatches = league.matches.filter(m => m.type !== 'tbd');
  
      pairs.forEach((pair, idx) => {
          newMatches.push({
              id: Date.now() + idx,
              t1: pair.t1,
              t2: pair.t2,
              date: days[idx] || '2.1 (일)', 
              time: '17:00',
              type: 'super', 
              format: 'BO5', 
              status: 'pending'
          });
      });
  
      const updatedMatches = [...cleanMatches, ...newMatches];
      updatedMatches.sort((a, b) => {
          const dayA = parseFloat(a.date.split(' ')[0]);
          const dayB = parseFloat(b.date.split(' ')[0]);
          return dayA - dayB;
      });
  
      updateLeague(league.id, { 
          matches: updatedMatches,
          currentChampionList: newChampionList,
          metaVersion: newMetaVersion
      });
      setLeague(prev => ({ 
          ...prev, 
          matches: updatedMatches,
          currentChampionList: newChampionList,
          metaVersion: newMetaVersion
      }));
      alert(`🔥 슈퍼위크 일정이 생성되고, 메타가 16.02 패치로 변경되었습니다!`);
    };
  
    const handleGeneratePlayIn = () => {
        let isBaronWinner;
        if (baronTotalWins > elderTotalWins) {
          isBaronWinner = true;
        } else if (baronTotalWins < elderTotalWins) {
          isBaronWinner = false;
        } else {
          const baronDiffTotal = (league.groups?.baron || []).reduce((s, id) => s + ((computedStandings[id]?.diff) || 0), 0);
          const elderDiffTotal = (league.groups?.elder || []).reduce((s, id) => s + ((computedStandings[id]?.diff) || 0), 0);
  
          if (baronDiffTotal > elderDiffTotal) isBaronWinner = true;
          else if (baronDiffTotal < elderDiffTotal) isBaronWinner = false;
          else {
            const baronPower = (league.groups?.baron || []).reduce((s, id) => s + ((teams.find(t => t.id === id)?.power) || 0), 0);
            const elderPower = (league.groups?.elder || []).reduce((s, id) => s + ((teams.find(t => t.id === id)?.power) || 0), 0);
            if (baronPower > elderPower) isBaronWinner = true;
            else if (baronPower < elderPower) isBaronWinner = false;
            else isBaronWinner = Math.random() < 0.5;
          }
        }
        
        const baronSorted = getSortedGroup([...league.groups.baron]);
        const elderSorted = getSortedGroup([...league.groups.elder]);
  
        const seasonSummary = {
            winnerGroup: isBaronWinner ? 'Baron' : 'Elder',
            poTeams: [],
            playInTeams: [],
            eliminated: null
        };
  
        let playInTeams = [];
        
        if (isBaronWinner) {
            seasonSummary.poTeams.push({ id: baronSorted[0], seed: 1 });
            seasonSummary.poTeams.push({ id: baronSorted[1], seed: 2 });
            playInTeams.push(baronSorted[2], baronSorted[3], baronSorted[4]);
  
            seasonSummary.poTeams.push({ id: elderSorted[0], seed: 3 });
            playInTeams.push(elderSorted[1], elderSorted[2], elderSorted[3]);
            seasonSummary.eliminated = elderSorted[4];
        } else {
            seasonSummary.poTeams.push({ id: elderSorted[0], seed: 1 });
            seasonSummary.poTeams.push({ id: elderSorted[1], seed: 2 });
            playInTeams.push(elderSorted[2], elderSorted[3], elderSorted[4]);
  
            seasonSummary.poTeams.push({ id: baronSorted[0], seed: 3 });
            playInTeams.push(baronSorted[1], baronSorted[2], baronSorted[3]);
            seasonSummary.eliminated = baronSorted[4];
        }
  
        playInTeams.sort((a, b) => {
            const recA = computedStandings[a];
            const recB = computedStandings[b];
            if (recA.w !== recB.w) return recB.w - recA.w;
            if (recA.diff !== recB.diff) return recB.diff - recA.diff;
            return Math.random() - 0.5;
        });
  
        const seededTeams = playInTeams.map((tid, idx) => ({ id: tid, seed: idx + 1 }));
        seasonSummary.playInTeams = seededTeams;
        
        const seed3 = seededTeams[2].id;
        const seed6 = seededTeams[5].id;
        const seed4 = seededTeams[3].id;
        const seed5 = seededTeams[4].id;
  
        const newMatches = [
            { id: Date.now() + 1, t1: seed3, t2: seed6, date: '2.6 (금)', time: '17:00', type: 'playin', format: 'BO3', status: 'pending', round: 1, label: '플레이-인 1라운드' },
            { id: Date.now() + 2, t1: seed4, t2: seed5, date: '2.6 (금)', time: '19:30', type: 'playin', format: 'BO3', status: 'pending', round: 1, label: '플레이-인 1라운드' }
        ];
  
        const updatedMatches = [...league.matches, ...newMatches];
        
        updateLeague(league.id, { matches: updatedMatches, playInSeeds: seededTeams, seasonSummary }); 
        setLeague(prev => ({ ...prev, matches: updatedMatches, playInSeeds: seededTeams, seasonSummary }));
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
  
    const MatchupBox = ({ match, showScore = true }) => {
      if (!match || (!match.t1 && !match.t2)) {
          return <div className="h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-sm w-full">TBD</div>;
      }
      const t1 = teams.find(t => t.id === match.t1);
      const t2 = teams.find(t => t.id === match.t2);
      const winnerId = match.status === 'finished' ? teams.find(t => t.name === match.result.winner)?.id : null;
  
      const team1Name = t1 ? formatTeamName(t1.id, match.type) : 'TBD';
      const team2Name = t2 ? formatTeamName(t2.id, match.type) : 'TBD';

      // --- FINAL STANDINGS LOGIC ---
  
      return (
          <div className={`bg-white border-2 rounded-lg shadow-sm w-full ${match.status === 'pending' ? 'border-gray-300' : 'border-gray-400'}`}>
              <div className={`flex justify-between items-center p-2 rounded-t-md ${winnerId === t1?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                  <span className={`font-bold text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team1Name}</span>
                  {showScore && <span className={`font-black text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' ? match.result.score.split(':')[0] : ''}</span>}
              </div>
              <div className={`flex justify-between items-center p-2 rounded-b-md ${winnerId === t2?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                  <span className={`font-bold text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team2Name}</span>
                  {showScore && <span className={`font-black text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' ? match.result.score.split(':')[1] : ''}</span>}
              </div>
          </div>
      );
    };
  
    // ==========================================
  // --- FINAL STANDINGS LOGIC (Paste in the gap) ---
  const getFinalStandings = () => {
    if (!isSeasonOver) return [];
    
    // Helper: Handle String vs Number ID mismatch
    const safeId = (id) => (id && typeof id === 'object' ? id.id : Number(id));

    const getLoserId = (m) => {
        if (!m || m.status !== 'finished' || !m.result) return null;
        const winnerName = m.result.winner;
        
        // Safely get IDs
        const t1Id = safeId(m.t1);
        const t2Id = safeId(m.t2);
        
        // Find team object to check name
        const t1Obj = teams.find(t => safeId(t.id) === t1Id);
        if (!t1Obj) return t2Id; // Safety fallback

        return t1Obj.name === winnerName ? t2Id : t1Id;
    };

    const getWinnerId = (m) => {
        if (!m || m.status !== 'finished') return null;
        return teams.find(t => t.name === m.result.winner)?.id;
    };

    const findMatch = (type, round) => league.matches.find(m => m.type === type && m.round === round);
    
    // --- Logic to find IDs for each rank ---
    const finalMatch = findMatch('playoff', 5);
    const winnerId = getWinnerId(finalMatch);
    const runnerUpId = getLoserId(finalMatch);

    const r4Match = findMatch('playoff', 4);
    const thirdId = getLoserId(r4Match);

    const r3_1Match = findMatch('playoff', 3.1);
    const fourthId = getLoserId(r3_1Match);

    const r2_2Match = findMatch('playoff', 2.2);
    const fifthId = getLoserId(r2_2Match);

    const r2_1Match = findMatch('playoff', 2.1);
    const sixthId = getLoserId(r2_1Match);

    const piFinalMatch = findMatch('playin', 3);
    const seventhId = getLoserId(piFinalMatch);

    // 8th & 9th: Play-In Round 1 Losers
    const piR1Matches = league.matches.filter(m => m.type === 'playin' && m.round === 1);
    const piR1Losers = piR1Matches.map(m => getLoserId(m)).filter(id => id !== null);

    // Sort 8th/9th by Play-In Seed
    piR1Losers.sort((a, b) => {
        const seedA = getTeamSeed(a, 'playin') || 99;
        const seedB = getTeamSeed(b, 'playin') || 99;
        return seedA - seedB;
    });

    // 10th: Group Stage Eliminated
    const tenthId = league.seasonSummary?.eliminated;

    const rankIds = [
        winnerId, runnerUpId, thirdId, fourthId, fifthId, sixthId, seventhId, 
        piR1Losers[0], piR1Losers[1], tenthId
    ];

    // --- CRASH PREVENTION MAPPING ---
    return rankIds.map((id, index) => {
        if (!id) return null;
        // Use safeId to find the team ensuring Number vs Number comparison
        const t = teams.find(team => safeId(team.id) === safeId(id));
        
        if (!t) return null; // If team not found, skip (Prevents "undefined" crash)
        return { rank: index + 1, team: t };
    }).filter(item => item !== null);
  };

  const FinalStandingsModal = () => {
    // Wrap in try-catch to prevent white screen if data is bad
    try {
        const standings = getFinalStandings();
        
        return (
            <div className="absolute inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
                    <div className="bg-gray-900 p-6 text-center relative">
                        <h2 className="text-3xl font-black text-yellow-400">🏆 2026 LCK CUP FINAL STANDINGS</h2>
                        <button 
                            onClick={() => setShowFinalStandings(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-white font-bold"
                        >
                            ✕ 닫기
                        </button>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[70vh]">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b">
                                <tr>
                                    <th className="p-4 text-center w-20">순위</th>
                                    <th className="p-4">팀</th>
                                    <th className="p-4 text-right">상금 (확정)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {standings.length > 0 ? standings.map((item) => {
                                    // Determine Prize Money
                                    let prizeText = '0.1억';
                                    if (item.rank === 1) prizeText = '0.5억';
                                    else if (item.rank === 2) prizeText = '0.25억';
                                    else if (item.rank === 3) prizeText = '0.2억';

                                    return (
                                        <tr key={item.team.id} className={`${item.rank === 1 ? 'bg-yellow-50' : 'bg-white'}`}>
                                            <td className="p-4 text-center">
                                                {item.rank === 1 ? <span className="text-2xl">🥇</span> : 
                                                 item.rank === 2 ? <span className="text-2xl">🥈</span> : 
                                                 item.rank === 3 ? <span className="text-2xl">🥉</span> : 
                                                 <span className="font-bold text-gray-500 text-lg">{item.rank}위</span>}
                                            </td>
                                            <td className="p-4 flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-lg" 
                                                     style={{backgroundColor: item.team.colors?.primary || '#333'}}>
                                                    {item.team.name}
                                                </div>
                                                <div>
                                                    <div className="font-black text-xl text-gray-800 flex items-center gap-2">
                                                        {item.team.fullName}
                                                        {/* FST 진출 Badge for Top 2 */}
                                                        {item.rank <= 2 && (
                                                            <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm tracking-wider">
                                                                FST 진출
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.rank === 1 && <div className="text-xs font-bold text-yellow-600 bg-yellow-100 inline-block px-2 py-0.5 rounded mt-1">CHAMPION</div>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-bold text-gray-600">
                                                {prizeText}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan="3" className="p-8 text-center text-gray-500">순위 데이터 계산 중 오류가 발생했습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 text-center border-t">
                        <button onClick={() => setShowFinalStandings(false)} className="px-6 py-2 bg-gray-800 text-white font-bold rounded hover:bg-gray-700">확인</button>
                    </div>
                </div>
            </div>
        );
    } catch (err) {
        console.error(err);
        return null; 
    }
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
              <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl">
                  <h2 className="text-2xl font-black mb-2">{opponentChoice.title}</h2>
                  <p className="text-gray-600 mb-6">{opponentChoice.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                      {opponentChoice.opponents.map(opp => (
                          <button 
                              key={opp.id}
                              onClick={() => opponentChoice.onConfirm(opp)}
                              className="p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer"
                          >
                              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-lg" style={{backgroundColor:opp.colors.primary}}>{opp.name}</div>
                              <div className="font-bold text-lg">{opp.fullName}</div>
                              <div className="text-sm bg-gray-100 px-3 py-1 rounded-full font-bold">
                                  {getTeamSeed(opp.id, opponentChoice.type.startsWith('playoff') ? 'playoff' : 'playin')} 시드
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
        )}

{showFinalStandings && <FinalStandingsModal />}
  
  {isLiveGameMode && liveMatchData && (
    <LiveGamePlayer 
        match={liveMatchData.match}
        teamA={liveMatchData.teamA}
        teamB={liveMatchData.teamB}
        simOptions={{
            currentChampionList: league.currentChampionList,
            difficulty: league.difficulty,
            playerTeamName: myTeam.name
        }}
        // [FIX] Removed undefined 'globalBanList'. 
        // LiveGamePlayer manages its own global bans internally for the BO3/BO5 series.
        externalGlobalBans={[]} 
        onMatchComplete={handleLiveMatchComplete}
        onClose={() => setIsLiveGameMode(false)}
    />
  )}
  
        {isDrafting && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col">
              <h2 className="text-3xl font-black mb-2">{isCaptain ? "팀 드래프트 진행" : "조 추첨 진행 중..."}</h2>
              {!isCaptain ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-gray-500">젠지와 한화생명이 팀을 고르고 있습니다...</p>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg mb-6">
                          <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===1?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                              <span className="font-bold text-lg block mb-1">GEN (Baron)</span>
                              <div className="flex flex-wrap gap-1 justify-center">{draftGroups.baron.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                          </div>
                          <div className="w-1/3 text-xl font-bold text-gray-400">VS</div>
                          <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===2?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                              <span className="font-bold text-lg block mb-1">HLE (Elder)</span>
                              <div className="flex flex-wrap gap-1 justify-center">{draftGroups.elder.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                          </div>
                      </div>
                      <div className="text-left mb-2 font-bold text-gray-700">{draftTurn === 'user' ? "👉 영입할 팀을 선택하세요!" : "🤖 상대가 고민 중입니다..."}</div>
                      <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[300px] p-2">
                          {draftPool.map(t => (
                              <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'}
                                  className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 hover:shadow-md ${draftTurn === 'user' ? 'bg-white border-gray-200 hover:border-blue-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}>
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                                  <div className="font-bold text-sm">{t.fullName}</div>
                                  <div className="text-xs bg-gray-100 px-2 py-1 rounded">전력 {t.power}</div>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
            </div>
          </div>
        )}
  
        <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-20">
          <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
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
  
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {effectiveDate}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패 ({myRecord.diff > 0 ? `+${myRecord.diff}` : myRecord.diff})</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">💰</span> 상금: {prizeMoney.toFixed(1)}억</div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* [FIXED] Final Standings Button */}
            {isSeasonOver && (
               <button 
               onClick={() => setShowFinalStandings(true)} 
               className="px-5 py-1.5 rounded-full font-bold text-sm bg-gray-900 hover:bg-black text-yellow-400 shadow-sm flex items-center gap-2 transition border-2 border-yellow-500 animate-pulse"
             >
                 <span>🏆</span> 최종 순위 보기
             </button>
            )}

            {hasDrafted && isRegularSeasonFinished && !hasSuperWeekGenerated && (
                 <button 
                 onClick={handleGenerateSuperWeek} 
                 className="px-5 py-1.5 rounded-full font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
               >
                   <span>🔥</span> 슈퍼위크 및 16.02 패치 확인
               </button>
            )}

            {isSuperWeekFinished && !hasPlayInGenerated && (
                <button 
                onClick={handleGeneratePlayIn} 
                className="px-5 py-1.5 rounded-full font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
              >
                  <span>🛡️</span> 플레이-인 진출팀 확정
              </button>
            )} 

            {isPlayInFinished && !hasPlayoffsGenerated && (
                <button 
                onClick={handleGeneratePlayoffs} 
                className="px-5 py-1.5 rounded-full font-bold text-sm bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
              >
                  <span>👑</span> 플레이오프 대진 생성
              </button>
            )}
            
            {hasDrafted && nextGlobalMatch && !isMyNextMatch && (
                <button 
                  onClick={handleProceedNextMatch} 
                  className="px-5 py-1.5 rounded-full font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-pulse transition"
                >
                    <span>⏩</span> 다음 경기 진행 ({t1?.name} vs {t2?.name})
                </button>
            )}

            <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2 ${hasDrafted ? 'bg-gray-100 text-gray-400 cursor-not-allowed hidden' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}`}>
                <span>▶</span> {hasDrafted ? "" : (isCaptain ? "LCK 컵 팀 선정하기" : "LCK 컵 조 확인하기")}
            </button>
          </div>
        </header>

          <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <div className="max-w-7xl mx-auto">
                
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-12 gap-6">
                  {/* 대시보드 메인 카드 */}
                  <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-5 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">📅</div>
                     <h3 className="text-lg font-bold text-gray-800 mb-2">다음 경기 일정</h3>
                     <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 border">
                        <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{t1 ? t1.name : '?'}</div></div>
                        <div className="text-center w-1/3 flex flex-col items-center">
                          <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div>
                          {nextGlobalMatch ? (
                            <div className="mt-1 flex flex-col items-center">
                              <span className="text-base font-black text-blue-600">{nextGlobalMatch.date}</span>
                              <span className="text-sm font-bold text-gray-600">{nextGlobalMatch.time}</span>
                              <span className="mt-2 text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm">
                                  {nextGlobalMatch.label || nextGlobalMatch.format}
                              </span>
                              
                              {isMyNextMatch ? (
                                  <button onClick={handleStartMyMatch} className="mt-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105 animate-bounce">
                                      ⚔️ 경기 시작 (직접 플레이)
                                  </button>
                              ) : (
                                  <div className="mt-3 text-sm font-bold text-gray-400 bg-white px-3 py-1 rounded border">
                                      상단바의 [⏩ 다음 경기 진행]을 눌러주세요
                                  </div>
                              )}
  
                            </div>
                          ) : <div className="text-xs font-bold text-blue-600">{isSeasonOver ? '시즌 종료' : '대진 생성 대기 중'}</div>}
                        </div>
                        <div className="text-center w-1/3">
                            <div className="text-4xl font-black text-gray-800 mb-2">{t2 ? t2.name : '?'}</div>
                        </div>
                     </div>
                  </div>
                  
                  {/* --- 대시보드 우측 (순위표 또는 대진표) --- */}
                  <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[500px]">
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
                                              <table className="w-full text-xs">
                                                  <thead className="bg-gray-50 text-gray-400">
                                                      <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center w-12">W-L</th><th className="p-2 text-center w-10">득실</th></tr>
                                                  </thead>
                                                  <tbody>
                                                      {getSortedGroup(league.groups[group.id] || []).map((id, idx) => {
                                                          const t = teams.find(team => team.id === id);
                                                          const isMyTeam = myTeam.id === id;
                                                          const rec = computedStandings[id] || {w:0, l:0, diff:0};
                                                          
                                                          let statusBadge = null;
                                                          if (league.seasonSummary) {
                                                              const summary = league.seasonSummary;
                                                              const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                              const piInfo = summary.playInTeams.find(pit => pit.id === id);
  
                                                              if (poInfo) statusBadge = <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1 font-bold">PO {poInfo.seed}시드</span>;
                                                              else if (piInfo) statusBadge = <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1 font-bold">PI {piInfo.seed}시드</span>;
                                                              else if (summary.eliminated === id) statusBadge = <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1 font-bold">OUT</span>;
                                                          }
  
                                                          return (
                                                              <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 transition-colors ${isMyTeam ? `bg-${group.color}-50` : 'hover:bg-gray-50'}`}>
                                                                  <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                                                  <td className="p-2 font-bold flex items-center">
                                                                      <span className={`${isMyTeam ? 'text-blue-700' : 'text-gray-800'} hover:underline`}>{t.fullName}</span>
                                                                      {statusBadge}
                                                                  </td>
                                                                  <td className="p-2 text-center">{rec.w} - {rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
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
  
                  <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
                    <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                      <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                    </div>
                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-xs table-fixed text-left">
                          <thead className="bg-white text-gray-400 uppercase font-bold border-b">
                              <tr>
                                  <th className="py-2 px-1 w-[8%] text-center">라인</th>
                                  <th className="py-2 px-1 w-[20%]">이름</th>
                                  <th className="py-2 px-1 w-[8%] text-center">OVR</th>
                                  <th className="py-2 px-1 w-[6%] text-center">나이</th>
                                  <th className="py-2 px-1 w-[8%] text-center">경력</th>
                                  <th className="py-2 px-1 w-[10%] text-center">소속</th>
                                  <th className="py-2 px-1 w-[12%] text-center">연봉</th>
                                  <th className="py-2 px-1 w-[10%] text-center">POT</th>
                                  <th className="py-2 px-1 w-[18%] text-left">계약</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {currentRoster.length > 0 ? currentRoster.map((p, i) => (
                                  <tr key={i} className="hover:bg-gray-50 transition">
                                      <td className="py-2 px-1 font-bold text-gray-400 text-center">{p.포지션}</td>
                                      <td className="py-2 px-1 font-bold text-gray-800 truncate">{p.이름} <span className="text-gray-400 font-normal text-[10px] hidden lg:inline">({p.실명})</span> {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</td>
                                      <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                      <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                      <td className="py-2 px-1 text-center"><span className={`text-[10px] ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                      <td className="py-2 px-1 text-gray-500 font-medium truncate">{p.계약}</td>
                                  </tr>
                              )) : <tr><td colSpan="9" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}
                          </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
  
              {activeTab === 'standings' && (
                 <div className="flex flex-col gap-6">
                   <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">🏆 2026 LCK 컵 순위표</h2>
                   {hasDrafted ? (
                      <div className="flex flex-col gap-4">
                          <div className="bg-gray-800 text-white rounded-lg p-4 text-center font-bold text-lg shadow-sm">
                             🔥 그룹 대항전 스코어: <span className="text-purple-400 text-2xl mx-2">{baronTotalWins}</span> (Baron) vs <span className="text-red-400 text-2xl mx-2">{elderTotalWins}</span> (Elder)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {[
                                  { id: 'baron', name: 'Baron Group', color: 'purple' },
                                  { id: 'elder', name: 'Elder Group', color: 'red' }
                              ].map(group => (
                                  <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                      <div className={`p-4 bg-${group.color}-50 border-b border-${group.color}-100 flex items-center gap-2`}>
                                          <h3 className={`font-black text-lg text-${group.color}-900`}>{group.name}</h3>
                                      </div>
                                      <table className="w-full text-sm">
                                          <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                          <tr>
                                              <th className="py-3 px-4 text-center">순위</th>
                                              <th className="py-3 px-4 text-left">팀</th>
                                              <th className="py-3 px-4 text-center">승</th>
                                              <th className="py-3 px-4 text-center">패</th>
                                              <th className="py-3 px-4 text-center">득실</th>
                                          </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                          {getSortedGroup(league.groups[group.id]).map((id, idx) => {
                                              const t = teams.find(team => team.id === id);
                                              const isMyTeam = myTeam.id === id;
                                              const rec = computedStandings[id] || {w:0, l:0, diff:0};
                                              
                                              let statusBadge = null;
                                              if (league.seasonSummary) {
                                                  const summary = league.seasonSummary;
                                                  const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                  const piInfo = summary.playInTeams.find(pit => pit.id === id);
  
                                                  if (poInfo) statusBadge = <span className="text-xs bg-yellow-100 text-yellow-700 px-2 rounded ml-2 font-bold">PO {poInfo.seed}시드</span>;
                                                  else if (piInfo) statusBadge = <span className="text-xs bg-indigo-100 text-indigo-700 px-2 rounded ml-2 font-bold">PI {piInfo.seed}시드</span>;
                                                  else if (summary.eliminated === id) statusBadge = <span className="text-xs bg-gray-200 text-gray-500 px-2 rounded ml-2 font-bold">탈락</span>;
                                              }
  
                                              return (
                                              <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? `bg-${group.color}-50` : ''}`}>
                                                  <td className="py-3 px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                                  <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-2">
                                                      <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                                                      {t.fullName}
                                                      {statusBadge}
                                                  </td>
                                                  <td className="py-3 px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                                  <td className="py-3 px-4 text-center font-bold text-red-600">{rec.l}</td>
                                                  <td className="py-3 px-4 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                              </tr>
                                              )
                                          })}
                                          </tbody>
                                      </table>
                                  </div>
                              ))}
                          </div>
                      </div>
                   ) : (
                      <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-500">
                          아직 시즌이 시작되지 않았습니다. 조 추첨을 완료해주세요.
                      </div>
                   )}
                 </div>
              )}
              
              {activeTab === 'playoffs' && (
                  <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
                      <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">👑 2026 LCK 컵 플레이오프</h2>
                      {hasPlayoffsGenerated ? (() => {
                          const poMatches = league.matches.filter(m => m.type === 'playoff');
                          const getWinner = m => m && m.status === 'finished' ? teams.find(t => t.name === m.result.winner)?.id : null;
                          const getLoser = m => {
                              if (!m || m.status !== 'finished') return null;
                              const winnerId = getWinner(m);
                              return m.t1 === winnerId ? m.t2 : m.t1;
                          };
  
                          const findMatch = (round, match) => poMatches.find(m => m.round === round && m.match === match);
                          
                          const r1m1 = findMatch(1, 1);
                          const r1m2 = findMatch(1, 2);
                          
                          const r2m1_actual = findMatch(2, 1);
                          const r2m2_actual = findMatch(2, 2);
                          
                          const r2lm1_actual = findMatch(2.1, 1);
                          const r2lm2_actual = findMatch(2.2, 1);
                          
                          const r3m1_actual = findMatch(3, 1);
                          const r3lm1_actual = findMatch(3.1, 1);
  
                          const r4m1_actual = findMatch(4, 1);
                          const final_actual = findMatch(5, 1);
  
                          const BracketColumn = ({ title, children, className }) => (
                            <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
                              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
                              <div className="w-full flex flex-col items-center">
                                {children}
                              </div>
                            </div>
                          );
                          
                          return (
                              <div className="flex-1 overflow-x-auto pb-8">
                                  <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                                      {/* --- 승자조 --- */}
                                      <div className="relative border-b-2 border-dashed pb-16">
                                          <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                                          <div className="flex justify-between items-center mt-8">
                                              <BracketColumn title="1라운드">
                                                  <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                                      <MatchupBox match={r1m1} />
                                                      <MatchupBox match={r1m2} />
                                                  </div>
                                              </BracketColumn>
                                              <BracketColumn title="승자조 2R">
                                                  <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                                      <MatchupBox match={r2m1_actual || { t1: league.playoffSeeds.find(s => s.seed === 1)?.id, t2: getWinner(r1m1), status: 'pending', type: 'playoff' }} />
                                                      <MatchupBox match={r2m2_actual || { t1: league.playoffSeeds.find(s => s.seed === 2)?.id, t2: getWinner(r1m2), status: 'pending', type: 'playoff' }} />
                                                  </div>
                                              </BracketColumn>
                                              <BracketColumn title="승자조 결승">
                                                  <MatchupBox match={r3m1_actual || { t1: getWinner(r2m1_actual), t2: getWinner(r2m2_actual), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                              <BracketColumn title="결승전">
                                                  <MatchupBox match={final_actual || { t1: getWinner(r3m1_actual), t2: getWinner(r4m1_actual), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                          </div>
                                      </div>
  
                                      {/* --- 패자조 --- */}
                                      <div className="relative pt-8">
                                          <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
                                          <div className="flex justify-start items-center space-x-24 mt-8">
                                              <BracketColumn title="패자조 1R">
                                                  <MatchupBox match={r2lm1_actual || { t1: getLoser(r1m1), t2: getLoser(r1m2), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                              <BracketColumn title="패자조 2R">
                                                  <MatchupBox match={r2lm2_actual || { t1: [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds.find(s=>s.id===b)?.seed || 99) - (league.playoffSeeds.find(s=>s.id===a)?.seed || 99))[0], t2: getWinner(r2lm1_actual), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                              <BracketColumn title="패자조 3R">
                                                  <MatchupBox match={r3lm1_actual || { t1: [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds.find(s=>s.id===a)?.seed || 99) - (league.playoffSeeds.find(s=>s.id===b)?.seed || 99))[0], t2: getWinner(r2lm2_actual), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                              <BracketColumn title="결승 진출전">
                                                  <MatchupBox match={r4m1_actual || { t1: getLoser(r3m1_actual), t2: getWinner(r3lm1_actual), status: 'pending', type: 'playoff' }} />
                                              </BracketColumn>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })() : (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                              <div className="text-4xl mb-4">🛡️</div>
                              <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                              <p className="mt-2">정규 시즌과 플레이-인을 모두 마친 후 대진이 생성됩니다.</p>
                          </div>
                      )}
                  </div>
              )}
  
              {/* 재정 탭 */}
              {activeTab === 'finance' && (
                <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                  {/* [FIX 3] Added Navigation Header for Finance Tab */}
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4">
                      <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                      <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-lg" style={{backgroundColor: viewingTeam.colors.primary}}>
                              {viewingTeam.name}
                          </div>
                          <div>
                              <h2 className="text-2xl font-black text-gray-900">{viewingTeam.fullName}</h2>
                              <p className="text-sm font-bold text-gray-500">재정 및 샐러리캡 현황</p>
                          </div>
                      </div>
                      <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                    </div>
                  </div>
  
                  <div className="p-8">
                      <div className="grid grid-cols-2 gap-8 mb-8">
                          <div className="bg-gray-50 p-6 rounded-xl border">
                              <h3 className="text-lg font-bold text-gray-700 mb-4">💰 지출 현황 (단위: 억)</h3>
                              <div className="flex items-end gap-8 h-64">
                                  {/* Total Spend */}
                                  <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                      <span className="font-bold text-blue-600 text-xl">{finance.total_expenditure}억</span>
                                      <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                                      <span className="font-bold text-gray-600 text-xs">총 지출</span>
                                  </div>
                                  {/* Cap Spend */}
                                  <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                      <span className="font-bold text-purple-600 text-xl">{finance.cap_expenditure}억</span>
                                      <div className="w-full bg-purple-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                                      <span className="font-bold text-gray-600 text-xs">샐러리캡 반영</span>
                                  </div>
                                  
                                  <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end relative group">
                                      {/* Markers */}
                                      <div className="absolute w-full border-t-2 border-dashed border-red-600 z-10" style={{bottom: '66.6%'}}></div>
                                      <div className="absolute right-0 text-[10px] text-red-700 font-bold bg-white px-1 border border-red-200 rounded -mb-3 z-20" style={{bottom: '66.6%'}}>100억 (3차)</div>
  
                                      <div className="absolute w-full border-t-2 border-dashed border-orange-500 z-10" style={{bottom: '53.3%'}}></div>
                                      <div className="absolute right-0 text-[10px] text-orange-600 font-bold bg-white px-1 border border-orange-200 rounded -mb-3 z-20" style={{bottom: '53.3%'}}>80억 (2차)</div>
                                      
                                      <div className="absolute w-full border-t-2 border-dashed border-green-600 z-10" style={{bottom: '26.6%'}}></div>
                                      <div className="absolute right-0 text-[10px] text-green-700 font-bold bg-white px-1 border border-green-200 rounded -mb-3 z-20" style={{bottom: '26.6%'}}>40억 (1차)</div>
  
                                      <div className="w-full bg-gray-200 rounded-t-lg relative overflow-hidden h-full opacity-50">
                                          <div className="absolute bottom-0 w-full bg-green-100 h-[26.6%]"></div>
                                          <div className="absolute bottom-[26.6%] w-full bg-orange-50 h-[26.7%]"></div>
                                          <div className="absolute bottom-[53.3%] w-full bg-red-50 h-[13.3%]"></div>
                                          <div className="absolute bottom-[66.6%] w-full bg-red-200 h-[33.4%]"></div>
                                      </div>
                                      <span className="font-bold text-gray-600 text-xs">규정 상한선</span>
                                  </div>
                              </div>
                          </div>
                          <div className="bg-gray-50 p-6 rounded-xl border flex flex-col justify-center items-center">
                              <h3 className="text-lg font-bold text-gray-700 mb-2">💸 사치세 (Luxury Tax)</h3>
                              <div className="text-5xl font-black text-red-600 my-4">{finance.luxury_tax > 0 ? `${finance.luxury_tax}억` : '없음'}</div>
                              <div className="text-sm text-gray-500 text-center">
                                  {finance.luxury_tax > 0 ? (
                                      finance.cap_expenditure >= 80 
                                      ? <span>상한선(80억) 초과!<br/>기본 10억 + 초과분({(finance.cap_expenditure - 80).toFixed(1)}억)의 50% 부과</span>
                                      : <span>균형 지출 구간(40~80억) 초과<br/>초과분({(finance.cap_expenditure - 40).toFixed(1)}억)의 25% 부과</span>
                                  ) : (
                                      <span className="text-green-600 font-bold">건전한 재정 상태입니다.</span>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
                </div>
              )}
  
              {activeTab === 'roster' && (
                <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4">
                      <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                      <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">상세 로스터 및 계약 현황</p></div></div>
                      <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                    </div>
                    <div className="text-right"><div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div></div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left table-fixed">
                          <thead className="bg-white text-gray-500 uppercase font-bold border-b">
                              <tr>
                                  <th className="py-2 px-2 bg-gray-50 w-[12%]">정보</th>
                                  <th className="py-2 px-1 text-center w-[5%]">OVR</th>
                                  <th className="py-2 px-1 text-center w-[5%]">나이</th>
                                  <th className="py-2 px-1 text-center w-[5%]">경력</th>
                                  <th className="py-2 px-1 text-center w-[6%]">소속</th>
                                  <th className="py-2 px-1 text-center w-[8%]">연봉</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 border-l w-[6%]">라인</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">무력</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">한타</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">성장</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">안정</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">운영</th>
                                  <th className="py-2 px-1 text-center bg-gray-50 border-l text-purple-600 w-[6%]">POT</th>
                                  <th className="py-2 px-2 text-left bg-gray-50 border-l w-[12%]">계약 정보</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {currentRoster.map((p, i) => (
                                  <tr key={i} className="hover:bg-blue-50/30 transition group">
                                      <td className="py-2 px-2 bg-white group-hover:bg-blue-50/30">
                                          <div className="flex items-center gap-2">
                                              <span className="font-bold text-gray-400 w-6">{p.포지션}</span>
                                              <div className="overflow-hidden">
                                                  <div className="font-bold text-gray-900 truncate">{p.이름} {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</div>
                                                  <div className="text-[10px] text-gray-400 truncate">{p.특성}</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                      <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                      <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                      <td className="py-2 px-1 text-center border-l font-medium text-gray-600">{p.상세?.라인전 || '-'}</td>
                                      <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.무력 || '-'}</td>
                                      <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.한타 || '-'}</td>
                                      <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.성장 || '-'}</td>
                                      <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.안정성 || '-'}</td>
                                      <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.운영 || '-'}</td>
                                      <td className="py-2 px-1 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                      <td className="py-2 px-2 border-l"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold block truncate">{p.계약}</span></td>
                                  </tr>
                              ))} 
                          </tbody>
                      </table>
                  </div>
                </div>
              )}
  
              {activeTab === 'meta' && (
                <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                      <span className="text-purple-600">📈</span> {league.metaVersion || '16.01'} 패치 메타
                    </h2>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                        <button
                          key={role}
                          onClick={() => setMetaRole(role)}
                          className={`px-4 py-2 rounded-md text-sm font-bold transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
  
                  <div className="grid grid-cols-1 gap-4">
                    {(league.currentChampionList || championList)
                      .filter(c => c.role === metaRole)
                      .sort((a, b) => a.tier - b.tier) // 티어 순으로 정렬
                      .map((champ, idx) => (
                        <div key={champ.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition group">
                          <div className="flex items-center gap-4 w-1/4">
                            <span className={`text-2xl font-black w-10 text-center ${champ.tier === 1 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                            <div>
                              <div className="font-bold text-lg text-gray-800">{champ.name}</div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {champ.tier} 티어
                              </span>
                            </div>
                          </div>
                            
                          <div className="flex-1 px-8">
                            <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                              <span>초반 {champ.stats.early}</span>
                              <span>중반 {champ.stats.mid}</span>
                              <span>후반 {champ.stats.late}</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                              <div className="bg-green-400 h-full" style={{width: `${champ.stats.early * 10}%`}} />
                              <div className="bg-yellow-400 h-full" style={{width: `${champ.stats.mid * 10}%`}} />
                              <div className="bg-red-400 h-full" style={{width: `${champ.stats.late * 10}%`}} />
                            </div>
                          </div>
  
                          <div className="w-1/3 text-right">
                            <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wide">Counter Picks</div>
                            <div className="text-sm font-medium text-gray-700">{champ.counters.join(', ')}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
  
              {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
                <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                  <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
                  </h2>
                  {hasDrafted ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                      {league.matches
                        .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                        .map((m, i) => {
                        const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                        const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                        const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                        const isFinished = m.status === 'finished';
                        
                        const t1Name = formatTeamName(m.t1, m.type);
                        const t2Name = formatTeamName(m.t2, m.type);
                        
  
                        return (
                          <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between text-xs font-bold text-gray-500">
                              <span>{m.date} {m.time}</span>
                              <span className={`font-bold ${m.type === 'playoff' ? 'text-yellow-600' : (m.type === 'super' ? 'text-purple-600' : (m.type === 'playin' ? 'text-indigo-600' : 'text-gray-500'))}`}>
                                  {m.label || (m.type === 'super' ? '🔥 슈퍼위크' : '정규시즌')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="flex flex-col items-center w-1/3">
                                  <span className={`font-bold ${isMyMatch && myTeam.id === m.t1 ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                  {isFinished && m.result.winner === t1.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                              </div>
                              <div className="text-center font-bold">
                                  {isFinished ? (
                                      <span className="text-xl text-gray-800">{m.result.score}</span>
                                  ) : (
                                      <span className="text-gray-400">VS</span>
                                  )}
                              </div>
                              <div className="flex flex-col items-center w-1/3">
                                  <span className={`font-bold ${isMyMatch && myTeam.id === m.t2 ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                  {isFinished && m.result.winner === t2.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><div className="text-4xl mb-4">🗳️</div><div className="text-xl font-bold">일정이 생성되지 않았습니다</div><p className="mt-2">먼저 조 추첨을 진행해주세요.</p></div>
                  )}
                </div>
              )}
  
            </div>
          </main>
        </div>
      </div>
    );
  }