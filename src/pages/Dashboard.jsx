// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teams, teamFinanceData } from '../data/teams';
import { championList, difficulties } from '../data/constants';
import { simulateMatch, getTeamRoster, generateSchedule, quickSimulateMatch } from '../engine/simEngine';
import LiveGamePlayer from '../components/LiveGamePlayer';
import DetailedMatchResultModal from '../components/DetailedMatchResultModal';
import playerList from '../data/players.json';
import { computeStandings, calculateFinalStandings, calculateGroupPoints, sortGroupByStandings, createPlayInBracket } from '../engine/BracketManager';
import { updateChampionMeta, generateSuperWeekMatches } from '../engine/SeasonManager';
import FinalStandingsModal from '../components/FinalStandingsModal';
import MatchupBox from '../components/MatchupBox';
import RosterTab from '../components/RosterTab';
import StandingsTab from '../components/StandingsTab';
import MetaTab from '../components/MetaTab';
import FinanceTab from '../components/FinanceTab';
import ScheduleTab from '../components/ScheduleTab';
import PlayoffTab from '../components/PlayoffTab';
import StatsTab from '../components/statsTab'; // NEW

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

  // 시뮬레이션 결과 모달 상태
  const [myMatchResult, setMyMatchResult] = useState(null);

  // 로컬 순위표 상태
  const [computedStandings, setComputedStandings] = useState({});

  // 플레이-인/플레이오프 상대 선택 모달 상태
  const [opponentChoice, setOpponentChoice] = useState(null); 
  const [showFinalStandings, setShowFinalStandings] = useState(false);

  // [MOVED UP] Define this helper before it is used in useEffect
  const recalculateStandings = (lg) => {
    // We now just ask our new "Manager" to do the math for us!
    const newStandings = computeStandings(lg);
    
    // Then we update the UI state
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

  // Prize money effect
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

  const handleMatchClick = (match) => {
    if (!match || match.status !== 'finished' || !match.result) return;
    
    // Helper to safely get ID
    const getID = (id) => (typeof id === 'object' ? id.id : Number(id));
    
    const t1Id = getID(match.t1);
    const t2Id = getID(match.t2);
    
    const teamA = teams.find(t => t.id === t1Id);
    const teamB = teams.find(t => t.id === t2Id);

    setMyMatchResult({
        resultData: match.result, 
        teamA: teamA,
        teamB: teamB
    });
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

  // ID Normalization Helper
  const safeId = (id) => (typeof id === 'object' ? id.id : Number(id));

  // Updated logic using safeId
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

  const checkAndGenerateNextPlayInRound = (matches) => {
    const r1Matches = matches.filter(m => m.type === 'playin' && m.round === 1);
    const r1Finished = r1Matches.length > 0 && r1Matches.every(m => m.status === 'finished');
    const r2Exists = matches.some(m => m.type === 'playin' && m.round === 2);

    if (r1Finished && !r2Exists) {
        const r1Winners = r1Matches.map(m => teams.find(t => t.name === m.result.winner));
        const playInSeeds = league.playInSeeds || []; 
        
        if (!playInSeeds || playInSeeds.length < 2) {
           console.warn("PlayIn Seeds missing, using fallback.");
        }

        const seed1 = teams.find(t => t.id === (playInSeeds[0]?.id || 0));
        const seed2 = teams.find(t => t.id === (playInSeeds[1]?.id || 0));
        
        if (!seed1 || !seed2) return;

        const winnersWithSeed = r1Winners.map(w => ({ ...w, seedIndex: playInSeeds.findIndex(s => s.id === w.id) }));
        winnersWithSeed.sort((a, b) => a.seedIndex - b.seedIndex);
        
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
        
        if (seed1.id !== myTeam.id) {
             const lowerSeedWinner = winnersWithSeed[1]; 
             const higherSeedWinner = winnersWithSeed[0];
             let pickedTeam;
             if (Math.random() < 0.65) pickedTeam = lowerSeedWinner; else pickedTeam = higherSeedWinner;
             const remainingTeam = (pickedTeam.id === lowerSeedWinner.id) ? higherSeedWinner : lowerSeedWinner;
             generatePlayInRound2(matches, seed1, seed2, pickedTeam, remainingTeam);
        }
    }

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

  const checkAndGenerateNextPlayoffRound = (currentMatches) => {
    if (!league.playoffSeeds) return;

    const getWinner = m => teams.find(t => t.name === m.result.winner).id;
    const getLoser = m => (m.t1 === getWinner(m) ? m.t2 : m.t1);

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
                { id: Date.now() + 400, round: 2, match: 1, label: '승자조 2R', t1: seed1, t2: pickedWinner.id, date: '2.13 (금)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
                { id: Date.now() + 401, round: 2, match: 2, label: '승자조 2R', t1: seed2, t2: remainingWinner, date: '2.13 (금)', time: '19:30', type: 'playoff', format: 'BO5', status: 'pending' },
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
            const r1m1Winner = getWinner(r1Matches.find(m => m.match === 1));
            const r1m2Winner = getWinner(r1Matches.find(m => m.match === 2));
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
        const r2wWinners = r2wMatches.map(m => getWinner(m));
        const r2wLosers = r2wMatches.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed);
        
        const r2lWinner = getWinner(r2lMatch);

        const newPlayoffMatches = [
            { id: Date.now() + 500, round: 3, match: 1, label: '승자조 결승', t1: r2wWinners[0], t2: r2wWinners[1], date: '2.18 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
            { id: Date.now() + 501, round: 2.2, match: 1, label: '패자조 2R', t1: r2wLosers[1].id, t2: r2lWinner, date: '2.15 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
        ];

        const allMatches = [...currentMatches, ...newPlayoffMatches];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 승자조 및 2라운드 패자조 경기가 생성되었습니다!");
        return;
    }

    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lExists = currentMatches.some(m => m.type === 'playoff' && m.round === 3.1);

    if (r2_2Match?.status === 'finished' && r3wMatch?.status === 'finished' && !r3lExists) {
        const r2wMatchesFinished = currentMatches.filter(m => m.round === 2 && m.status === 'finished');
        const r2wLosers = r2wMatchesFinished.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed);
        
        const highestSeedLoser = r2wLosers[0].id;
        const r2_2Winner = getWinner(r2_2Match);

        const newMatch = { id: Date.now() + 600, round: 3.1, match: 1, label: '패자조 3R', t1: highestSeedLoser, t2: r2_2Winner, date: '2.19 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 패자조 경기가 생성되었습니다!");
        return;
    }

    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);
    const r4Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 4);

    if (r3lMatch?.status === 'finished' && r3wMatch?.status === 'finished' && !r4Exists) {
        const r3wLoser = getLoser(r3wMatch);
        const r3lWinner = getWinner(r3lMatch);

        const newMatch = { id: Date.now() + 700, round: 4, match: 1, label: '결승 진출전', t1: r3wLoser, t2: r3lWinner, date: '2.21 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 결승 진출전이 생성되었습니다!");
        return;
    }

    const r4Match = currentMatches.find(m => m.type === 'playoff' && m.round === 4);
    const finalExists = currentMatches.some(m => m.type === 'playoff' && m.round === 5);

    if (r4Match?.status === 'finished' && r3wMatch?.status === 'finished' && !finalExists) {
        const r3wWinner = getWinner(r3wMatch);
        const r4Winner = getWinner(r4Match);

        const newMatch = { id: Date.now() + 800, round: 5, match: 1, label: '결승전', t1: r3wWinner, t2: r4Winner, date: '2.22 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
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

      const getID = (val) => (val && typeof val === 'object' && val.id) ? val.id : val;
      const myId = String(myTeam.id);
      
      const isPlayerMatch =
        String(getID(nextGlobalMatch.t1)) === myId ||
        String(getID(nextGlobalMatch.t2)) === myId;
  
      if (!isPlayerMatch) {
        const result = runSimulationForMatch(nextGlobalMatch, false);
  
        if (!result) throw new Error("Simulation returned null");
  
        let scoreStr = "2:0"; 
        if (result.scoreString) {
            scoreStr = result.scoreString;
        } else if (result.score) {
            const values = Object.values(result.score);
            if (values.length >= 2) scoreStr = `${values[0]}:${values[1]}`;
        }
  
        const finalResult = { 
            winner: result.winnerName, 
            score: scoreStr,          
            history: result.history    
        };
  
        const updatedMatches = league.matches.map(m => 
            m.id === nextGlobalMatch.id ? { ...m, status: 'finished', result: finalResult } : m
        );
  
        const updatedLeague = { ...league, matches: updatedMatches };
        
        updateLeague(league.id, updatedLeague);
        setLeague(updatedLeague);
        recalculateStandings(updatedLeague); 
  
        checkAndGenerateNextPlayInRound(updatedMatches);
        checkAndGenerateNextPlayoffRound(updatedMatches);
  
        return;
      }
  
      navigate(`/match/${nextGlobalMatch.id}`);
    } catch (err) {
      console.error("Next Match Error:", err);
      alert("경기 진행 중 오류 발생: " + err.message);
    }
  };

  const handleStartMyMatch = (mode = 'auto') => {
    try {
      if (!nextGlobalMatch) {
        alert("진행할 경기가 없습니다.");
        return;
      }
  
      const t1Id = typeof nextGlobalMatch.t1 === 'object' ? nextGlobalMatch.t1.id : Number(nextGlobalMatch.t1);
      const t2Id = typeof nextGlobalMatch.t2 === 'object' ? nextGlobalMatch.t2.id : Number(nextGlobalMatch.t2);
  
      const t1Obj = teams.find(t => Number(t.id) === t1Id);
      const t2Obj = teams.find(t => Number(t.id) === t2Id);
  
      if (!t1Obj || !t2Obj) {
        alert(`팀 데이터 오류! T1 ID: ${t1Id}, T2 ID: ${t2Id}`);
        return;
      }
  
      const t1Roster = getTeamRoster(t1Obj.name);
      const t2Roster = getTeamRoster(t2Obj.name);

      const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0) 
          ? league.currentChampionList 
          : championList;
    
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
    const updatedMatches = league.matches.map(m => {
        if (m.id === match.id) {
            return {
                ...m,
                status: 'finished',
                result: {
                    winner: resultData.winner,
                    score: resultData.scoreString,
                    history: resultData.history,
                    posPlayer: resultData.posPlayer
                }
            };
        }
        return m;
    });

    const updatedLeague = { ...league, matches: updatedMatches };
    updateLeague(league.id, updatedLeague);
    setLeague(updatedLeague);
    recalculateStandings(updatedLeague);

    checkAndGenerateNextPlayInRound(updatedMatches);
    checkAndGenerateNextPlayoffRound(updatedMatches);

    setIsLiveGameMode(false);
    setLiveMatchData(null);
    
    setTimeout(() => alert(`경기 종료! 승리: ${resultData.winner}`), 100);
  };

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
    { id: 'stats', name: '통계', icon: '📈' }, // NEW
  ];

  const myRecord = computedStandings[myTeam.id] || { w: 0, l: 0, diff: 0 };
  const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };

  const baronTotalWins = calculateGroupPoints(league, 'baron');
  const elderTotalWins = calculateGroupPoints(league, 'elder');

  const handleGenerateSuperWeek = () => {
    const newMetaVersion = '16.02';
    
    if (league.metaVersion === newMetaVersion) {
        alert("이미 16.02 메타 패치가 적용되어 있습니다.");
        return;
    }

    const sourceList = (league.currentChampionList && league.currentChampionList.length > 0) 
        ? league.currentChampionList : championList;
    
    const newChampionList = updateChampionMeta(sourceList);

    const newMatches = generateSuperWeekMatches(league);
    
    const cleanMatches = league.matches ? league.matches.filter(m => m.type !== 'tbd') : [];
    const updatedMatches = [...cleanMatches, ...newMatches].sort((a, b) => {
        const parse = (d) => parseFloat(d.split(' ')[0]);
        return parse(a.date) - parse(b.date);
    });

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
    const bWins = calculateGroupPoints(league, 'baron');
    const eWins = calculateGroupPoints(league, 'elder');

    const { newMatches, playInSeeds, seasonSummary } = createPlayInBracket(
        league, 
        computedStandings, 
        teams, 
        bWins, 
        eWins
    );

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

      {showFinalStandings && <FinalStandingsModal league={league} onClose={() => setShowFinalStandings(false)} />}

      {isLiveGameMode && liveMatchData && (
          <LiveGamePlayer 
              match={liveMatchData.match}
              teamA={liveMatchData.teamA}
              teamB={liveMatchData.teamB}
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
            <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}>{item.icon} {item.name}</button>
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
          {isSeasonOver && (
             <button 
             onClick={() => setShowFinalStandings(true)} 
             className="px-5 py-1.5 rounded-full font-bold text-sm bg-gray-900 hover:bg-black text-yellow-400 shadow-sm flex items-center gap-2 transition border-2 border-yellow-500 animate-pulse"
           >
               <span>🏆</span> 최종 순위 보기
           </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'dashboard' && (
          <div>
            {/* Dashboard main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="col-span-2 bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-xl">다음 경기</h3>
                  <div className="text-sm text-gray-500">{nextGlobalMatch ? `${nextGlobalMatch.date} ${nextGlobalMatch.time}` : '진행 대기중'}</div>
                </div>
                {nextGlobalMatch ? (
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <div className="text-2xl font-black">{teams.find(t => t.id === (typeof nextGlobalMatch.t1 === 'object' ? nextGlobalMatch.t1.id : nextGlobalMatch.t1))?.name || 'TBD'}</div>
                      <div className="text-sm text-gray-500">VS</div>
                      <div className="text-2xl font-black text-right">{teams.find(t => t.id === (typeof nextGlobalMatch.t2 === 'object' ? nextGlobalMatch.t2.id : nextGlobalMatch.t2))?.name || 'TBD'}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleProceedNextMatch()} className="px-4 py-2 bg-green-600 text-white rounded font-bold">AI 시뮬 실행</button>
                      <button onClick={() => handleStartMyMatch('manual')} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">수동으로 플레이</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">다음 경기가 없습니다.</div>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h4 className="font-black text-lg mb-2">팀 재정</h4>
                <div className="text-sm text-gray-600">총 지출: <span className="font-bold">{finance.total_expenditure}억</span></div>
                <div className="text-sm text-gray-600">샐러리캡 반영: <span className="font-bold">{finance.cap_expenditure}억</span></div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handlePrevTeam()} className="px-3 py-1 bg-gray-100 rounded">◀</button>
                  <button onClick={() => handleNextTeam()} className="px-3 py-1 bg-gray-100 rounded">▶</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <RosterTab viewingTeam={viewingTeam} roster={currentRoster} onPrevTeam={handlePrevTeam} onNextTeam={handleNextTeam} />
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
          <PlayoffTab league={league} teams={teams} hasPlayoffsGenerated={hasPlayoffsGenerated} handleMatchClick={handleMatchClick} formatTeamName={formatTeamName} />
        )}

        {activeTab === 'finance' && (
          <FinanceTab viewingTeam={viewingTeam} finance={finance} onPrevTeam={handlePrevTeam} onNextTeam={handleNextTeam} />
        )}

        {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
          <ScheduleTab activeTab={activeTab} league={league} teams={teams} myTeam={myTeam} hasDrafted={hasDrafted} formatTeamName={formatTeamName} onMatchClick={handleMatchClick} />
        )}

        {activeTab === 'meta' && (
          <MetaTab league={league} championList={championList} metaRole={metaRole} setMetaRole={setMetaRole} />
        )}

        {activeTab === 'stats' && (
          <StatsTab league={league} />
        )}
      </div>
      </div>
    </div>
  );
}