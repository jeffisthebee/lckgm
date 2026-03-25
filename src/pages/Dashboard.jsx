import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teams, teamFinanceData } from '../data/teams';
import { championList, difficulties, TEAM_COLORS } from '../data/constants';
import { simulateMatch, getTeamRoster, generateSchedule, quickSimulateMatch } from '../engine/simEngine';
import { getFullTeamRoster } from '../engine/rosterLogic';
import LiveGamePlayer from '../components/LiveGamePlayer';
import DetailedMatchResultModal from '../components/DetailedMatchResultModal';
import playerList from '../data/players.json';
import { computeStandings, calculateFinalStandings, calculateGroupPoints, sortGroupByStandings, createPlayInBracket, createPlayInRound2Matches, createPlayInFinalMatch, createPlayoffRound2Matches, createPlayoffRound3Matches, createPlayoffLoserRound3Match, createPlayoffQualifierMatch, createPlayoffFinalMatch, createFSTGroupWave2A, createFSTGroupWave2B, createFSTGroupWave3A, createFSTGroupWave3B, createFSTPlayoffs, createFSTFinals } from '../engine/BracketManager';
import { updateChampionMeta, generateSuperWeekMatches, initFSTTournament } from '../engine/SeasonManager';
import FSTTournamentTab from '../components/FSTTournamentTab';
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
import { 
    generateLPLRegularSchedule, generateLECRegularSchedule,
    generateLCSRegularSchedule, generateLCPRegularSchedule, generateCBLOLRegularSchedule,
    generateLCSPlayoffs, generateLCKSplit1Schedule, rescheduleLCKSplit1
} from '../engine/scheduleLogic';
import AwardsTab from '../components/AwardsTab';
import HistoryTab from '../components/HistoryTab'; 
import { computeAwards, computePlayoffAwards } from '../engine/statsManager';
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';

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
    const [saveMessage, setSaveMessage] = useState(''); // For save confirmation toast
  
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
    // FST player match — pending mode choice (manual vs auto)
    const [fstMatchPending, setFstMatchPending] = useState(null);

    // Define this helper before it is used in useEffect
    const recalculateStandings = (lg) => {
      const newStandings = computeStandings(lg);
      setComputedStandings(newStandings);
    };
  
    useEffect(() => {
      const loadData = async () => {
        const found = await getLeagueById(leagueId);
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

    // Check Season Status Helper
    // LCK: grand final finished — identified by label NOT containing '진출전'.
    // BracketManager may assign round:5 to both the qualifier (결승 진출전) and the final (결승전),
    // so we must use the label to tell them apart.
    const grandFinalMatch = league?.matches?.find(m =>
        m.type === 'playoff' &&
        !String(m.label || '').includes('진출') &&
        (m.round === 5 || String(m.label || '').includes('결승전') || String(m.label || '').toUpperCase().includes('FINAL'))
    );
    const _myLgForSeason = league?.myLeague || 'LCK';
    const isSeasonOver = (() => {
      if (_myLgForSeason === 'LCK') return !!(grandFinalMatch && grandFinalMatch.status === 'finished');
      const fMatches = league?.foreignMatches?.[_myLgForSeason] || [];
      if (!Array.isArray(fMatches) || fMatches.length === 0) return false;
      const isExplicitFinal = (m) => {
        if (!m || m.type !== 'playoff') return false;
        const id = String(m.id || '');
        const label = String(m.label || m.roundName || '').trim().toUpperCase();
        const round = Number(m.round || 0);
        if (_myLgForSeason === 'LEC' && id === 'lec_po_final') return true;
        if (_myLgForSeason === 'LPL' && id === 'lpl_po14') return true;
        if (_myLgForSeason === 'LCS' && id === 'lcs_po8') return true;
        if (_myLgForSeason === 'CBLOL' && id === 'cblol_po10') return true;
        if (_myLgForSeason === 'LCP' && id.startsWith('lcp_') && round === 4) return true;
        if (round === 5) return true;
        // Use exact matches only — '결승' alone would match '결승 진출전' (qualifier), '결승전' is the actual grand final
        if (label === '결승전' || label === 'GRAND FINAL') return true;
        return false;
      };
      const finalMatch = fMatches.find(isExplicitFinal);
      return !!(finalMatch && finalMatch.status === 'finished');
    })();

    // ── [FOREIGN] Auto-draft LCK groups and generate LCK schedule (all pending)
    // Uses the same power-based draft as the real LCK mode:
    // GEN (id:1) = Baron captain, HLE (id:2) = Elder captain, rest drafted by power.
    const lckAutoRunRef = useRef(false);
    useEffect(() => {
        if (!league) return;
        const myLg = league.myLeague || 'LCK';
        if (myLg === 'LCK') return;
        if (lckAutoRunRef.current) return;
        if ((league.matches || []).length > 0) return; // Already set up
        lckAutoRunRef.current = true;

        // Power-based pick (same as pickComputerTeam)
        const pickByPower = (available) => {
            const sorted = [...available].sort((a, b) => b.power - a.power);
            const top = sorted[0];
            let chance = 0.5;
            if (top.power >= 84) chance = 0.90;
            else if (top.power >= 80) chance = 0.70;
            if (Math.random() < chance) return top;
            const others = available.filter(t => t.id !== top.id);
            return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : top;
        };

        // GEN=1 → Baron, HLE=2 → Elder, draft the remaining 8 by power alternating
        let pool = teams.filter(t => t.id !== 1 && t.id !== 2);
        let baron = [1];
        let elder = [2];
        let turn = 0; // 0 = baron picks, 1 = elder picks
        while (pool.length > 0) {
            const picked = pickByPower(pool);
            pool = pool.filter(t => t.id !== picked.id);
            if (turn === 0) baron.push(picked.id);
            else elder.push(picked.id);
            turn = 1 - turn;
        }
        const groups = { baron, elder };

        // Generate schedule with all matches PENDING — ScheduleTab sims them date by date
        const pendingMatches = generateSchedule(baron, elder);

        const updates = { groups, matches: pendingMatches };
        updateLeague(league.id, updates);
        setLeague(prev => ({ ...prev, ...updates }));
        recalculateStandings({ ...league, ...updates });
    }, [league?.id, league?.myLeague]);

    // ── [LCS] On load: advance Swiss rounds and playoff bracket if TBD slots exist ──
    // This catches the case where the user reloads and the stored state still has
    // TBD team slots — without this, nextGlobalMatch returns null and no buttons show.
    const lcsOnLoadRef = useRef(false);
    useEffect(() => {
        if (!league) return;
        if ((league.myLeague || 'LCK') !== 'LCS') return;
        if (lcsOnLoadRef.current) return;

        const foreignMatches = league.foreignMatches?.['LCS'] || [];
        if (foreignMatches.length === 0) return;

        const isTBD = (v) => !v || String(v) === 'TBD' || String(v) === 'null' || String(v) === 'undefined';
        const hasTBDSwiss = foreignMatches.some(m => m.type === 'regular' && (m.swissRound === 2 || m.swissRound === 3) && (isTBD(m.t1) || isTBD(m.t2)));
        const hasTBDPlayoff = foreignMatches.some(m => (m.type === 'playoff' || m.type === 'playin') && (isTBD(m.t1) || isTBD(m.t2)));
        const missingPlayoffs = foreignMatches.filter(m => m.type === 'regular').every(m => m.status === 'finished') &&
                                !foreignMatches.some(m => m.type === 'playoff' || m.type === 'playin');

        if (!hasTBDSwiss && !hasTBDPlayoff && !missingPlayoffs) return;
        lcsOnLoadRef.current = true;

        const lgTeams = FOREIGN_LEAGUES['LCS'] || [];
        let updatedMatches = foreignMatches;
        let lcsPoSeeds = null;

        // Advance Swiss rounds first
        if (hasTBDSwiss) {
            const { matches: swissAdv, changed } = advanceLCSSwissRounds(updatedMatches, lgTeams);
            if (changed) updatedMatches = swissAdv;
        }

        // Then build/advance playoff bracket
        if (hasTBDPlayoff || missingPlayoffs) {
            const { matches: poAdv, seeds: poSeeds, changed: poChanged } = advanceLCSPlayoffBracket(updatedMatches);
            if (poChanged) {
                updatedMatches = poAdv;
                lcsPoSeeds = poSeeds;
            }
        }

        if (updatedMatches !== foreignMatches) {
            const updatedLeague = {
                ...league,
                foreignMatches: { ...league.foreignMatches, LCS: updatedMatches },
                ...(lcsPoSeeds ? { foreignPlayoffSeeds: { ...(league.foreignPlayoffSeeds || {}), LCS: lcsPoSeeds } } : {}),
            };
            updateLeague(league.id, updatedLeague);
            setLeague(updatedLeague);
        }
    }, [league?.id, league?.foreignMatches?.LCS?.length]);
    // Only sims LCK 'regular' matches dated BEFORE the user's next foreign match.
    // This means LCK progresses in sync with the user's league, so by the time
    // the user finishes their own regular season, LCK's is also done → 16.02 fires.
    useEffect(() => {
        if (!league) return;
        const myLg = league.myLeague || 'LCK';
        if (myLg === 'LCK') return;

        const regularMatches = (league.matches || []).filter(m => m.type === 'regular');
        if (regularMatches.length === 0) return;
        if (regularMatches.every(m => m.status === 'finished')) return; // already done

        // Gate: only sim LCK matches before the user's next foreign game
        const myLeagueMatches = league.foreignMatches?.[myLg] || [];
        const myPending = [...myLeagueMatches]
            .filter(m => m.status === 'pending')
            .sort((a, b) => {
                const parse = (m) => {
                    const [mo, d] = (m.date || '').split(' ')[0].split('.').map(Number);
                    const [h, mi] = (m.time || '0:00').split(':').map(Number);
                    return (mo || 0) * 10000000 + (d || 0) * 100000 + (h || 0) * 100 + (mi || 0);
                };
                return parse(a) - parse(b);
            });

        // If user hasn't started their season yet, don't sim anything
        if (myPending.length === 0 && myLeagueMatches.length === 0) return;

        const gate = myPending.length > 0 ? myPending[0] : { date: '99.99', time: '23:59' };

        const compareDates = (m, g) => {
            const parse = (x) => {
                const [mo, d] = (x.date || '').split(' ')[0].split('.').map(Number);
                const [h, mi] = (x.time || '0:00').split(':').map(Number);
                return (mo || 0) * 10000000 + (d || 0) * 100000 + (h || 0) * 100 + (mi || 0);
            };
            return parse(m) - parse(g);
        };

        const simable = regularMatches.filter(m =>
            m.status === 'pending' &&
            m.t1 && m.t2 &&
            String(m.t1) !== 'TBD' && String(m.t2) !== 'TBD' &&
            compareDates(m, gate) < 0
        );
        if (simable.length === 0) return;

        let didUpdate = false;
        const newMatches = league.matches.map(m => {
            if (m.type !== 'regular' || m.status !== 'pending') return m; // regular only
            if (!m.t1 || !m.t2 || String(m.t1) === 'TBD' || String(m.t2) === 'TBD') return m;
            if (compareDates(m, gate) >= 0) return m;

            const getId = v => typeof v === 'object' ? Number(v?.id) : Number(v);
            const t1Obj = teams.find(t => t.id === getId(m.t1));
            const t2Obj = teams.find(t => t.id === getId(m.t2));
            if (!t1Obj || !t2Obj) return m;

            try {
                const t1 = { ...t1Obj, roster: getFullTeamRoster(t1Obj.name) };
                const t2 = { ...t2Obj, roster: getFullTeamRoster(t2Obj.name) };
                const sim = quickSimulateMatch(t1, t2, m.format || 'BO3');
                const score = typeof sim.scoreString === 'string' ? sim.scoreString
                    : typeof sim.score === 'object'
                        ? `${Math.max(sim.score.A ?? 0, sim.score.B ?? 0)}-${Math.min(sim.score.A ?? 0, sim.score.B ?? 0)}`
                        : '2-0';
                didUpdate = true;
                return {
                    ...m, status: 'finished',
                    result: {
                        winner: sim.winner?.name || sim.winner,
                        score,
                        history: (sim.history || []).map(s => ({ ...s, logs: [] }))
                    }
                };
            } catch (e) {
                const t1Wins = (t1Obj.power || 80) + (Math.random() * 10 - 5) >=
                               (t2Obj.power || 80) + (Math.random() * 10 - 5);
                didUpdate = true;
                return {
                    ...m, status: 'finished',
                    result: { winner: t1Wins ? t1Obj.name : t2Obj.name, score: '2-0', history: [] }
                };
            }
        });

        if (didUpdate) {
            const updates = { matches: newMatches };
            updateLeague(league.id, updates);
            setLeague(prev => ({ ...prev, ...updates }));
            recalculateStandings({ ...league, matches: newMatches });
        }
    }, [league?.foreignMatches?.[league?.myLeague]?.filter(m => m.status === 'finished').length, league?.matches?.length, league?.myLeague]);

    // ── [FOREIGN] Background LCK bracket generator ───────────────────────────
    // After super week is simmed, auto-generates LCK play-in → playoff brackets
    // so the LCK schedule tab shows results as the user plays through their season.
    useEffect(() => {
        if (!league?.matches) return;
        if ((league.myLeague || 'LCK') === 'LCK') return;

        const allMatches = league.matches;
        const regularDone = allMatches.filter(m => m.type === 'regular').every(m => m.status === 'finished');
        const superMatches = allMatches.filter(m => m.type === 'super');
        const superDone = superMatches.length > 0 && superMatches.every(m => m.status === 'finished');
        if (!regularDone || !superDone) return;

        const hasPlayin = allMatches.some(m => m.type === 'playin');
        const hasPlayoff = allMatches.some(m => m.type === 'playoff');

        if (!hasPlayin) {
            // Generate play-in bracket
            const tempLeague = { ...league, matches: allMatches };
            const standings = computeStandings(tempLeague);
            const bWins = allMatches.filter(m => {
                if ((m.type !== 'regular' && m.type !== 'super') || m.status !== 'finished') return false;
                const wt = teams.find(t => t.name === m.result?.winner);
                return wt && (league.groups?.baron || []).includes(wt.id);
            }).length;
            const eWins = allMatches.filter(m => {
                if ((m.type !== 'regular' && m.type !== 'super') || m.status !== 'finished') return false;
                const wt = teams.find(t => t.name === m.result?.winner);
                return wt && (league.groups?.elder || []).includes(wt.id);
            }).length;

            try {
                const { newMatches: piMatches, playInSeeds, seasonSummary } = createPlayInBracket(tempLeague, standings, teams, bWins, eWins);
                const updates = { matches: [...allMatches, ...piMatches], playInSeeds, seasonSummary }; // Fix: correctly append PlayIn!
                updateLeague(league.id, updates);
                setLeague(prev => ({ ...prev, ...updates }));
            } catch (e) { console.error('[LCK BG] Play-in bracket failed:', e); }
            return;
        }

        // After play-in exists, auto-generate next play-in rounds + full playoffs progression.
        // This prevents "only appears after refresh" issues for foreign players viewing LCK.
        let currentMatches = allMatches;
        let didUpdate = false;
        const patchLeague = (partial) => {
          didUpdate = true;
          const next = { ...league, ...partial };
          updateLeague(league.id, partial);
          setLeague(prev => ({ ...prev, ...partial }));
          // keep local ref in sync for sequential generation
          if (partial.matches) currentMatches = partial.matches;
        };

        // 1) Ensure play-in rounds 2 and 3 are generated as soon as prerequisites finish.
        try {
          const playinMatches = currentMatches.filter(m => m.type === 'playin');
          const r1 = playinMatches.filter(m => m.round === 1);
          const r2Exists = playinMatches.some(m => m.round === 2);
          const r3Exists = playinMatches.some(m => m.round === 3);

          const r1Finished = r1.length > 0 && r1.every(m => m.status === 'finished');
          if (r1Finished && !r2Exists) {
            const playInSeeds = league.playInSeeds || [];
            const seed1 = teams.find(t => t.id === (playInSeeds[0]?.id || 0));
            const seed2 = teams.find(t => t.id === (playInSeeds[1]?.id || 0));
            if (seed1 && seed2) {
              const r1Winners = r1
                .map(m => teams.find(t => t.name === m.result?.winner))
                .filter(Boolean);
              const winnersWithSeed = r1Winners.map(w => ({ ...w, seedIndex: playInSeeds.findIndex(s => s.id === w.id) }));
              winnersWithSeed.sort((a, b) => a.seedIndex - b.seedIndex);
              if (winnersWithSeed.length >= 2) {
                const lowerSeedWinner = winnersWithSeed[1];
                const higherSeedWinner = winnersWithSeed[0];
                const pickedTeam = (Math.random() < 0.65) ? lowerSeedWinner : higherSeedWinner;
                const remainingTeam = (pickedTeam.id === lowerSeedWinner.id) ? higherSeedWinner : lowerSeedWinner;
                const newMatches = createPlayInRound2Matches(currentMatches, seed1, seed2, pickedTeam, remainingTeam);
                patchLeague({ matches: newMatches });
              }
            }
          }

          const r2 = playinMatches.filter(m => m.round === 2);
          const r2Finished = r2.length > 0 && r2.every(m => m.status === 'finished');
          if (r2Finished && !r3Exists) {
            const newMatches = createPlayInFinalMatch(currentMatches, teams);
            patchLeague({ matches: newMatches });
          }
        } catch (e) {
          console.error('[LCK BG] Play-in next-round generation failed:', e);
        }

        // 2) Generate playoffs once play-in Final is finished.
        if (!hasPlayoff) {
            const playinMatches = currentMatches.filter(m => m.type === 'playin');
            const r3 = playinMatches.filter(m => m.round === 3);
            if (r3.length === 0 || !r3.every(m => m.status === 'finished')) return;

            const directPO = league.seasonSummary?.poTeams || [];

            // ONLY collect winners from rounds 2 and 3 — NOT round 1.
            // Round 1 winners who then LOST round 2 are eliminated and must not get a playoff spot.
            // The old code iterated ALL play-in matches chronologically, so R1 winners appeared
            // first and .slice(0,3) picked them over the actual R2/R3 qualifiers (e.g. DNS who
            // won R1 then lost R2 still occupied a slot, displacing the real R3 winner).
            const r2Winners = playinMatches
                .filter(m => m.round === 2 && m.status === 'finished')
                .map(m => teams.find(t => t.name === m.result?.winner))
                .filter(Boolean)
                .filter(w => !directPO.some(d => d.id === w.id));

            const r3Winners = playinMatches
                .filter(m => m.round === 3 && m.status === 'finished')
                .map(m => teams.find(t => t.name === m.result?.winner))
                .filter(Boolean)
                .filter(w => !directPO.some(d => d.id === w.id));

            const playInQualifiers = [...r2Winners, ...r3Winners]
                .filter((w, i, arr) => arr.findIndex(a => a.id === w.id) === i) // deduplicate
                .slice(0, 3)
                .map((t, i) => {
                    const orig = league.playInSeeds?.find(s => s.id === t.id);
                    return { id: t.id, seed: 4 + i, originalSeed: orig?.seed || 99 };
                });

            const playoffSeeds = [...directPO, ...playInQualifiers].sort((a, b) => a.seed - b.seed);
            if (playoffSeeds.length < 6) return;

            const seed3 = playoffSeeds.find(s => s.seed === 3);
            const playInPO = playoffSeeds.filter(s => s.seed >= 4);
            if (!seed3 || playInPO.length < 3) return;

            const pickedSeed = playInPO[playInPO.length - 1];
            const remaining = playInPO.filter(s => s.id !== pickedSeed.id);
            const r1m1 = { id: Date.now() + 300, round: 1, match: 1, label: '1라운드', t1: seed3.id, t2: pickedSeed.id, date: '2.11 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
            const r1m2 = { id: Date.now() + 301, round: 1, match: 2, label: '1라운드', t1: remaining[0]?.id, t2: remaining[1]?.id, date: '2.12 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
            const newMatches = [...currentMatches, r1m1, r1m2];
            patchLeague({ matches: newMatches, playoffSeeds });
            return;
        }

        // 3) If playoffs exist, generate subsequent rounds automatically as series finish.
        try {
          const playoffSeeds = league.playoffSeeds || [];
          if (playoffSeeds.length === 0) return;

          const getWinnerId = (m) => teams.find(t => t.name === m.result?.winner)?.id;
          const getLoserId = (m) => {
            const wId = getWinnerId(m);
            if (!wId) return null;
            return (m.t1 === wId) ? m.t2 : m.t1;
          };

          const r1 = currentMatches.filter(m => m.type === 'playoff' && m.round === 1);
          const r2Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 2);
          const r1Finished = r1.length === 2 && r1.every(m => m.status === 'finished');
          if (r1Finished && !r2Exists) {
            const r1Winners = r1.map(m => ({ id: getWinnerId(m), fromMatch: m.match })).filter(w => !!w.id);
            const r1Losers = r1.map(m => ({ id: getLoserId(m), fromMatch: m.match })).filter(l => !!l.id);
            const seed1 = playoffSeeds.find(s => s.seed === 1)?.id;
            const seed2 = playoffSeeds.find(s => s.seed === 2)?.id;
            if (seed1 && seed2 && r1Winners.length === 2 && r1Losers.length === 2) {
              const pickedWinner = r1Winners[Math.floor(Math.random() * r1Winners.length)];
              const remainingWinner = r1Winners.find(w => w.id !== pickedWinner.id)?.id;
              const newMatches = createPlayoffRound2Matches(currentMatches, seed1, seed2, pickedWinner.id, remainingWinner, r1Losers[0].id, r1Losers[1].id);
              patchLeague({ matches: newMatches });
              return;
            }
          }

          const r2w = currentMatches.filter(m => m.type === 'playoff' && m.round === 2);
          const r2l = currentMatches.find(m => m.type === 'playoff' && m.round === 2.1);
          const r3Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 3);
          const r2Finished = r2w.length === 2 && r2w.every(m => m.status === 'finished') && r2l?.status === 'finished';
          if (r2Finished && !r3Exists) {
            const newMatches = createPlayoffRound3Matches(currentMatches, playoffSeeds, teams);
            patchLeague({ matches: newMatches });
            return;
          }

          const r2_2 = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
          const r3w = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
          const r3lExists = currentMatches.some(m => m.type === 'playoff' && m.round === 3.1);
          if (r2_2?.status === 'finished' && r3w?.status === 'finished' && !r3lExists) {
            const newMatches = createPlayoffLoserRound3Match(currentMatches, playoffSeeds, teams);
            patchLeague({ matches: newMatches });
            return;
          }

          const isQualifierMatchBg = (m) =>
              m.type === 'playoff' &&
              (String(m.label || '').includes('진출') || m.round === 4);
          const r3l = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);
          const r4Exists = currentMatches.some(isQualifierMatchBg);
          if (r3l?.status === 'finished' && r3w?.status === 'finished' && !r4Exists) {
            const newMatches = createPlayoffQualifierMatch(currentMatches, teams);
            patchLeague({ matches: newMatches });
            return;
          }

          const r4 = currentMatches.find(isQualifierMatchBg);
          const finalExists = currentMatches.some(m =>
              m.type === 'playoff' &&
              !String(m.label || '').includes('진출') &&
              (m.round === 5 || String(m.label || '').includes('결승전') || String(m.label || '').toUpperCase().includes('FINAL'))
          );
          if (r4?.status === 'finished' && r3w?.status === 'finished' && !finalExists) {
            const newMatches = createPlayoffFinalMatch(currentMatches, teams);
            patchLeague({ matches: newMatches });
            return;
          }
        } catch (e) {
          console.error('[LCK BG] Playoff next-round generation failed:', e);
        }
    }, [
        league?.matches?.filter(m => m.status === 'finished').length,
        league?.myLeague
    ]);
    const hasFST = !!league?.fst;
    const isFSTReady = isSeasonOver && !hasFST;
    
    // Check if FST data is corrupted/incomplete
    const hasFSTError = hasFST && (!league.fst.teams || league.fst.teams.length === 0 || !league.fst.matches || league.fst.matches.length === 0);

    // FST: next pending FST match (isMyNextFSTMatch computed after myTeam is defined, below)
    const nextFSTMatch = hasFST
      ? [...(league.fst.matches || [])]
          .filter(m => m.status === 'pending' && m.t1 && m.t2)
          .sort((a, b) => {
            const parseDateTime = (m) => {
              const [month, day] = (m.date || '').split(' ')[0].split('.').map(Number);
              const [h, min] = (m.time || '0:00').split(':').map(Number);
              return (month || 0) * 10000000 + (day || 0) * 100000 + (h || 0) * 100 + (min || 0);
            };
            return parseDateTime(a) - parseDateTime(b);
          })[0] || null
      : null;
    const nextFSTMatchT1 = nextFSTMatch ? (league.fst?.teams || []).find(t => t.fstId === nextFSTMatch.t1) : null;
    const nextFSTMatchT2 = nextFSTMatch ? (league.fst?.teams || []).find(t => t.fstId === nextFSTMatch.t2) : null;
    
    // Check if History is already saved
    const isSavedInHistory = league?.history?.some(
        h => h.year === (league.year || 2026) && h.seasonName === (league.seasonName || 'LCK CUP')
    );

    // FST completion + save checks
    const isFSTOver = hasFST && !!(league.fst?.matches || []).find(m => m.fstRound === 'Finals' && m.status === 'finished');
    const isFSTSavedInHistory = !!(league?.foreignHistory?.FST?.length > 0);

    // Effect: Calculate Prize Money Safely
    useEffect(() => {
      if (!league || !league.matches) return;

      if (isSeasonOver) {
        const getID = (id) => (typeof id === 'object' ? id.id : Number(id));
        const getWinnerId = (m) => teams.find(t => t.name === m.result.winner)?.id;
        const getLoserId = (m) => {
            const wId = getWinnerId(m);
            const t1Id = getID(m.t1);
            const t2Id = getID(m.t2);
            return t1Id === wId ? t2Id : t1Id;
        };

        const winnerId = getID(getWinnerId(grandFinalMatch));
        const runnerUpId = getID(getLoserId(grandFinalMatch));
        const r4Match = league.matches.find(m =>
            m.type === 'playoff' &&
            (String(m.label || '').includes('진출') || m.round === 4)
        );
        const thirdId = getID(getLoserId(r4Match));
        
        // Use ID from league state directly
        const myId = getID(league.team.id);

        let earned = 0.1; 
        if (myId === winnerId) earned = 0.5;
        else if (myId === runnerUpId) earned = 0.25;
        else if (myId === thirdId) earned = 0.2;

        // FST prize money (added on top of LCK prize)
        if (isFSTOver && league.fst) {
          const FST_PRIZES = [6, 4, 3, 2, 1, 1, 1, 1];
          const fstMatches = league.fst.matches || [];
          const fstTeams   = league.fst.teams   || [];
          const myName     = league.team?.name;

          const fstFindM = (round) => fstMatches.find(m => m.fstRound === round);
          const fstGetW  = (m) => {
            if (!m?.result?.winner) return null;
            return fstTeams.find(t => t.name === m.result.winner)?.name || m.result.winner;
          };
          const fstGetL  = (m) => {
            if (!m?.result?.winner) return null;
            const wName   = fstGetW(m);
            const wId     = fstTeams.find(t => t.name === wName)?.fstId;
            const loserId = wId
              ? (m.t1 === wId ? m.t2 : m.t1)
              : (fstTeams.find(t => t.fstId === m.t1)?.name === wName ? m.t2 : m.t1);
            return fstTeams.find(t => t.fstId === loserId)?.name;
          };
          const fstGetWonSets = (m, teamName) => {
            if (!m?.result?.score) return 0;
            const parts = String(m.result.score).split(/[-:]/).map(Number);
            if (parts.length !== 2) return 0;
            return fstGetW(m) === teamName ? Math.max(parts[0], parts[1]) : Math.min(parts[0], parts[1]);
          };

          const finals = fstFindM('Finals');
          const pg1 = fstFindM('PG1'); const pg2 = fstFindM('PG2');
          const gg9 = fstFindM('GG9'); const gg10 = fstFindM('GG10');
          const gg7 = fstFindM('GG7'); const gg8 = fstFindM('GG8');

          const fstRanks = [];
          const addFR = (n) => { if (n && !fstRanks.includes(n)) fstRanks.push(n); };
          addFR(fstGetW(finals));
          addFR(fstGetL(finals));
          [pg1, pg2]
            .map(m => { const l = fstGetL(m); return l ? { name: l, s: fstGetWonSets(m, l) } : null; })
            .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => addFR(t.name));
          [gg9, gg10]
            .map(m => { const l = fstGetL(m); return l ? { name: l, s: fstGetWonSets(m, l) } : null; })
            .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => addFR(t.name));
          [gg7, gg8]
            .map(m => { const l = fstGetL(m); return l ? { name: l, s: fstGetWonSets(m, l) } : null; })
            .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => addFR(t.name));

          const myFSTRank = fstRanks.indexOf(myName);
          if (myFSTRank >= 0) earned += FST_PRIZES[myFSTRank] || 0;
        }

        setPrizeMoney(earned);
      }
    }, [league, isSeasonOver, isFSTOver]);

    // [NEW] Manual Archive Function
    // In src/pages/Dashboard.jsx

    // [FIX] Manual Archive Function - Now saves Playoff Awards too!
    // [FIXED] Manual Archive Function
    // [FIXED] Manual Archive Function - Now saves LCK AND Foreign Leagues!
    // ── Helper: compute LEC regular-season standing order from raw matches ──────
    const computeLECRegularStandings = (fMatches, fTeams) => {
    const st = {};
    fTeams.forEach(t => st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], team: t });

    fMatches.filter(m => m.type === 'regular' && m.status === 'finished').forEach(m => {
        const winner = m.result?.winner;
        const t1 = fTeams.find(t => t.name === m.t1 || String(t.id) === String(m.t1))?.name || m.t1;
        const t2 = fTeams.find(t => t.name === m.t2 || String(t.id) === String(m.t2))?.name || m.t2;
        const loser = winner === t1 ? t2 : t1;
        let diff = 0;
        if (m.result?.score) {
            const pts = String(m.result.score).split(/[-:]/).map(Number);
            if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) diff = Math.abs(pts[0] - pts[1]);
        }
        if (st[winner]) { st[winner].w++; st[winner].diff += diff; st[winner].defeatedOpponents.push(loser); if (!st[winner].h2h[loser]) st[winner].h2h[loser] = { w: 0, l: 0 }; st[winner].h2h[loser].w += 1; }
        if (st[loser]) { st[loser].l++; st[loser].diff -= diff; if (!st[loser].h2h[winner]) st[loser].h2h[winner] = { w: 0, l: 0 }; st[loser].h2h[winner].l += 1; }
    });

    const tiedGroups = {};
    Object.values(st).forEach(rec => { const key = `${rec.w}_${rec.diff}`; if (!tiedGroups[key]) tiedGroups[key] = []; tiedGroups[key].push(rec.team.name); });

    return Object.values(st).sort((a, b) => {
        if (b.w !== a.w) return b.w - a.w;
        if (b.diff !== a.diff) return b.diff - a.diff;
        const tieKey = `${a.w}_${a.diff}`;
        if ((tiedGroups[tieKey]?.length || 0) === 2) { const aW = a.h2h[b.team.name]?.w || 0; const bW = b.h2h[a.team.name]?.w || 0; if (aW !== bW) return bW - aW; }
        let sovA = 0, sovB = 0;
        a.defeatedOpponents.forEach(o => { sovA += (st[o]?.w || 0); });
        b.defeatedOpponents.forEach(o => { sovB += (st[o]?.w || 0); });
        return sovB - sovA;
    }).map(r => r.team.name);
};

// ── Helper: reapply LEC 12-team scale to already-computed awards ────────────
    const LEC_ARCHIVE_SCALE = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 0];
    const reapplyLECScale = (data, fMatches, standingsNames, forPlayoffs) => {
    if (!data) return data;
    const rankPtsMap = {};
    (standingsNames || []).forEach((name, idx) => { if (name) rankPtsMap[name] = idx < LEC_ARCHIVE_SCALE.length ? LEC_ARCHIVE_SCALE[idx] : 0; });
    const safeArr = v => Array.isArray(v) ? v : [];
    const normalizeRole = (r) => { if (!r) return 'UNKNOWN'; const up = String(r).toUpperCase(); if (['JGL','정글','JUNGLE'].includes(up)) return 'JGL'; if (['SUP','서포터','SUPP','SPT'].includes(up)) return 'SUP'; if (['ADC','원거리','BOT','BOTTOM','AD'].includes(up)) return 'ADC'; if (['MID','미드'].includes(up)) return 'MID'; if (['TOP','탑'].includes(up)) return 'TOP'; return up; };
    const players = {};
    const targetMatches = (fMatches || []).filter(m => { if (m.status !== 'finished') return false; return forPlayoffs ? m.type === 'playoff' : (m.type === 'regular' || m.type === 'super'); });
    for (const match of targetMatches) {
        for (const set of safeArr(match.result?.history)) {
            const pogObj = set.pogPlayer; const pogName = typeof pogObj === 'string' ? pogObj.trim() : (pogObj?.playerName || '').trim();
            if (pogName) { if (!players[pogName]) players[pogName] = { games: 0, totalScore: 0, pog: 0, role: null, team: null }; players[pogName].pog++; }
            const allPicks = [...safeArr(set.picks?.A), ...safeArr(set.picks?.B)];
            for (const p of allPicks) {
                if (!p?.playerName) continue;
                const name = p.playerName;
                if (!players[name]) players[name] = { games: 0, totalScore: 0, pog: 0, role: null, team: null };
                const k = p.stats?.kills ?? p.k ?? 0; const d = p.stats?.deaths ?? p.d ?? 0; const a = p.stats?.assists ?? p.a ?? 0; const gold = p.currentGold ?? 0;
                const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5); let setScore = 65 + kda + (gold / 1500);
                const role1 = p.role || p.playerData?.포지션 || 'MID';
                if (['SUP', '서포터'].includes(role1)) setScore += Math.max(10 - (d * 1.5), 2);
                if (['JGL', '정글'].includes(role1))   setScore += Math.max(6 - d, 0);
                if (['TOP', '탑'].includes(role1))     setScore += Math.max(4 - d, 0);
                players[name].games++; players[name].totalScore += setScore;
                if (!players[name].role) players[name].role = p.role || p.playerData?.포지션;
                if (!players[name].team) players[name].team = p.playerData?.팀 || p.playerData?.team;
            }
        }
    }
    const pogLeaderName = data.pogLeader?.playerName || null;
    const finalsMvpName = data.finalsMvp?.playerName || null;
    const scored = Object.entries(players).filter(([, d]) => d.games > 0).map(([name, d]) => {
        const teamName = d.team || ''; const rankPoints = rankPtsMap[teamName] ?? 0; const avgScore = d.totalScore / d.games; const pogCount = d.pog;
        const isPogLeader = name === pogLeaderName; const isFinalsMvp = name === finalsMvpName;
        const finalScore = rankPoints + (pogCount * 10) + avgScore + (isFinalsMvp ? 20 : 0) + (isPogLeader ? 20 : 0);
        return { playerName: name, role: normalizeRole(d.role), team: teamName, teamObj: { name: teamName }, rankPoints, avgScore, pogCount, isPogLeader, isFinalsMvp, mvpBonus: 0, finalScore };
    }).sort((a, b) => b.finalScore - a.finalScore);
    const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const allProTeams = { 1: {}, 2: {}, 3: {} }; const usedByRole = {}; ROLES.forEach(r => { usedByRole[r] = []; });
    for (const tier of [1, 2, 3]) { for (const role of ROLES) { const eligible = scored.filter(p => p.role === role && !usedByRole[role].includes(p.playerName)); if (eligible[0]) { allProTeams[tier][role] = eligible[0]; usedByRole[role].push(eligible[0].playerName); } } }
    return { ...data, seasonMvp: scored[0] || null, pogLeader: scored.find(p => p.isPogLeader) || null, finalsMvp: scored.find(p => p.isFinalsMvp) || null, allProTeams };
};

    const handleManualArchive = () => {
  if (!league) return;

  const currentYear = league.year || 2026;
  const currentSeasonName = league.seasonName || 'LCK CUP';
  const _isMyLeagueForeign = (league.myLeague || 'LCK') !== 'LCK';

  console.log("Archiving Season & Foreign Leagues...");
  
  // --- 1. LCK ARCHIVE --- (skip for foreign players who have no LCK groups/playoffs)
  const hasLCKGroups = !!(league.groups?.baron?.length > 0);
  const hasLCKPlayoffs = !!(league.matches?.some(m => m.type === 'playoff' && m.status === 'finished'));

  const finalStandings = (hasLCKGroups && hasLCKPlayoffs) ? calculateFinalStandings(league) : [];
  const regularAwards = hasLCKGroups ? computeAwards(league, teams) : { seasonMvp: null, allProTeams: {}, pogLeader: null };
  const playoffAwards = (hasLCKGroups && hasLCKPlayoffs) ? computePlayoffAwards(league, teams) : { finalsMvp: null, pogLeader: null, allProTeams: {} };
  
  const seasonSnapshot = {
      year: currentYear,
      seasonName: currentSeasonName,
      champion: finalStandings[0]?.team, 
      runnerUp: finalStandings[1]?.team,
      finalStandings: finalStandings,
      groupStandings: hasLCKGroups ? {
          baron: sortGroupByStandings(league.groups.baron, computedStandings).map(id => ({
              teamName: teams.find(t=>t.id===id).name,
              w: computedStandings[id]?.w || 0,
              l: computedStandings[id]?.l || 0,
              diff: computedStandings[id]?.diff || 0
          })),
          elder: sortGroupByStandings(league.groups.elder, computedStandings).map(id => ({
              teamName: teams.find(t=>t.id===id).name,
              w: computedStandings[id]?.w || 0,
              l: computedStandings[id]?.l || 0,
              diff: computedStandings[id]?.diff || 0
          }))
      } : { baron: [], elder: [] },
      awards: {
        regular: {
            mvp: regularAwards.seasonMvp, 
            allPro: regularAwards.allProTeams, 
            pogLeader: regularAwards.pogLeader
        },
        playoff: {
            finalsMvp: playoffAwards.finalsMvp,  
            playoffMvp: playoffAwards.pogLeader, 
            allPro: playoffAwards.allProTeams    
        }
    }
  };

  const history = league.history || [];
  const cleanHistory = history.filter(h => !(h.year === currentYear && h.seasonName === currentSeasonName));
  const newHistory = [...cleanHistory, seasonSnapshot];
  
  // --- 2. FOREIGN LEAGUES ARCHIVE ---
  const newForeignHistory = { ...(league.foreignHistory || { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] }) };

  ['LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].forEach(lgName => {
      const fMatches = league.foreignMatches?.[lgName] || [];
      
      if (fMatches.length > 0) {
          const fTeams = FOREIGN_LEAGUES[lgName] || [];
          const isLEC = lgName === 'LEC';

          // For LEC: build pseudo-league with correct regularStandings + scale
          let pseudoLeague;
          if (isLEC) {
              const regularStandingsNames = computeLECRegularStandings(fMatches, fTeams);
              pseudoLeague = {
                  matches: fMatches,
                  regularStandings: regularStandingsNames,
                  finalStandings: regularStandingsNames, // fallback; reapplyLECScale overrides
                  customRankPointScale: LEC_ARCHIVE_SCALE,
              };
          } else {
              pseudoLeague = { matches: fMatches };
          }

          let fRegAwards = computeAwards(pseudoLeague, fTeams);
          let fPlayoffAwards = computePlayoffAwards(pseudoLeague, fTeams);

          // For LEC: re-score using the 12-team scale with correct standings order
          if (isLEC) {
              const regStandings = pseudoLeague.regularStandings;
              // Compute playoff final standings order for playoff awards
              const getLoserById = (id) => { const m = fMatches.find(x => x.id === id); if (!m || !m.result?.winner) return null; const t1 = fTeams.find(t => t.name === m.t1 || String(t.id) === String(m.t1))?.name || m.t1; const t2 = fTeams.find(t => t.name === m.t2 || String(t.id) === String(m.t2))?.name || m.t2; return m.result.winner === t1 ? t2 : t1; };
              const getWinnerById = (id) => fMatches.find(x => x.id === id)?.result?.winner || null;
              const poStandings = [];
              const addPO = (n) => { if (n && !poStandings.includes(n)) poStandings.push(n); };
              addPO(getWinnerById('lec_po_final')); addPO(getLoserById('lec_po_final')); addPO(getLoserById('lec_po_r4')); addPO(getLoserById('lec_po_lbsf'));
              [getLoserById('lec_po_lb2g1'), getLoserById('lec_po_lb2g2')].filter(Boolean).forEach(n => addPO(n));
              [getLoserById('lec_po_lb1g1'), getLoserById('lec_po_lb1g2')].filter(Boolean).forEach(n => addPO(n));
              regStandings.filter(n => !poStandings.includes(n)).forEach(n => addPO(n));
              const finalPoStandings = poStandings.length > 0 ? poStandings : regStandings;

              fRegAwards = reapplyLECScale(fRegAwards, fMatches, regStandings, false);
              fPlayoffAwards = reapplyLECScale(fPlayoffAwards, fMatches, finalPoStandings, true);
          }

          const fSnapshot = {
              year: currentYear,
              seasonName: '스플릿 1',
              matches: fMatches,
              awards: {
                  regular: {
                      mvp: fRegAwards.seasonMvp,
                      allPro: fRegAwards.allProTeams,
                      pogLeader: fRegAwards.pogLeader
                  },
                  playoff: {
                      finalsMvp: fPlayoffAwards.finalsMvp,
                      playoffMvp: fPlayoffAwards.pogLeader,
                      allPro: fPlayoffAwards.allProTeams
                  }
              }
          };

          const currentFHist = newForeignHistory[lgName] || [];
          const cleanFHist = currentFHist.filter(h => !(h.year === currentYear && h.seasonName === '스플릿 1'));
          newForeignHistory[lgName] = [...cleanFHist, fSnapshot];
      }
  });

  // --- 3. FST ARCHIVE ---
  if (isFSTOver) {
    const fstMatches = league.fst?.matches || [];
    const fstTeams   = league.fst?.teams   || [];

    // ── helpers scoped to FST teams ──────────────────────────────────────────
    const fstFindM = (round) => fstMatches.find(m => m.fstRound === round);
    const fstGetW  = (m) => {
      if (!m?.result?.winner) return null;
      return fstTeams.find(t => t.name === m.result.winner)?.name || m.result.winner;
    };
    const fstGetL  = (m) => {
      if (!m?.result?.winner) return null;
      const wName = fstGetW(m);
      const wId   = fstTeams.find(t => t.name === wName)?.fstId;
      const loserId = wId ? (m.t1 === wId ? m.t2 : m.t1) : (fstTeams.find(t => t.fstId === m.t1)?.name === wName ? m.t2 : m.t1);
      return fstTeams.find(t => t.fstId === loserId)?.name;
    };
    const fstGetWonSets = (m, teamName) => {
      if (!m?.result?.score) return 0;
      const parts = String(m.result.score).split(/[-:]/).map(Number);
      if (parts.length !== 2) return 0;
      return fstGetW(m) === teamName ? Math.max(parts[0], parts[1]) : Math.min(parts[0], parts[1]);
    };

    const pg1 = fstFindM('PG1'); const pg2 = fstFindM('PG2');
    const finals = fstFindM('Finals');
    const gg7 = fstFindM('GG7'); const gg8 = fstFindM('GG8');
    const gg9 = fstFindM('GG9'); const gg10 = fstFindM('GG10');
    const gg5 = fstFindM('GG5'); const gg6 = fstFindM('GG6');

    // ── Playoff placement (same fixed logic as AwardsTab) ────────────────────
    const fstPlayoffRanks = [];
    const fstAddP = (n) => { if (n && !fstPlayoffRanks.includes(n)) fstPlayoffRanks.push(n); };

    fstAddP(fstGetW(finals));
    fstAddP(fstGetL(finals));

    const l_pg1 = fstGetL(pg1); const l_pg2 = fstGetL(pg2);
    [l_pg1 ? { name: l_pg1, s: fstGetWonSets(pg1, l_pg1) } : null,
     l_pg2 ? { name: l_pg2, s: fstGetWonSets(pg2, l_pg2) } : null]
      .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => fstAddP(t.name));

    const l_gg9 = fstGetL(gg9); const l_gg10 = fstGetL(gg10);
    [l_gg9  ? { name: l_gg9,  s: fstGetWonSets(gg9,  l_gg9)  } : null,
     l_gg10 ? { name: l_gg10, s: fstGetWonSets(gg10, l_gg10) } : null]
      .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => fstAddP(t.name));

    const l_gg7 = fstGetL(gg7); const l_gg8 = fstGetL(gg8);
    [l_gg7 ? { name: l_gg7, s: fstGetWonSets(gg7, l_gg7) } : null,
     l_gg8 ? { name: l_gg8, s: fstGetWonSets(gg8, l_gg8) } : null]
      .filter(Boolean).sort((a, b) => b.s - a.s).forEach(t => fstAddP(t.name));

    // Fallback: group stage participants not yet placed
    [fstGetW(gg5), fstGetW(gg6), fstGetW(gg9), fstGetW(gg10),
     fstGetL(gg9), fstGetL(gg10), fstGetL(gg7), fstGetL(gg8)]
      .forEach(n => fstAddP(n));

    // ── Group-stage standings order ──────────────────────────────────────────
    const fstGroupRanks = [
      fstGetW(gg5), fstGetW(gg6),
      fstGetW(gg9), fstGetW(gg10),
      fstGetL(gg9), fstGetL(gg10),
      fstGetL(gg7), fstGetL(gg8)
    ].filter(Boolean);

    // ── Award computation helper ─────────────────────────────────────────────
    const buildFSTAwards = (scale, standingsNames, forPlayoffs) => {
      const rankPtsMap = {};
      standingsNames.forEach((name, idx) => { if (name) rankPtsMap[name] = idx < scale.length ? scale[idx] : 0; });
      const safeArr = v => Array.isArray(v) ? v : [];
      const normalizeRole = (r) => {
        if (!r) return 'UNKNOWN'; const up = String(r).toUpperCase();
        if (['JGL','정글','JUNGLE'].includes(up)) return 'JGL';
        if (['SUP','서포터','SUPP','SPT'].includes(up)) return 'SUP';
        if (['ADC','원거리','BOT','BOTTOM','AD'].includes(up)) return 'ADC';
        if (['MID','미드'].includes(up)) return 'MID';
        if (['TOP','탑'].includes(up)) return 'TOP';
        return up;
      };
      const players = {};
      const targetMatches = fstMatches.filter(m => {
        if (m.status !== 'finished') return false;
        if (forPlayoffs) return ['PG1', 'PG2', 'Finals'].includes(m.fstRound);
        return m.fstRound?.startsWith('GG');
      });
      for (const match of targetMatches) {
        for (const set of safeArr(match.result?.history)) {
          const pogObj = set.pogPlayer;
          const pogName = typeof pogObj === 'string' ? pogObj.trim() : (pogObj?.playerName || '').trim();
          if (pogName) { if (!players[pogName]) players[pogName] = { games: 0, totalScore: 0, pog: 0, role: null, team: null }; players[pogName].pog++; }
          const allPicks = [...safeArr(set.picks?.A), ...safeArr(set.picks?.B)];
          for (const p of allPicks) {
            if (!p?.playerName) continue;
            const name = p.playerName;
            if (!players[name]) players[name] = { games: 0, totalScore: 0, pog: 0, role: null, team: null };
            const k = p.stats?.kills ?? p.k ?? 0;
            const d = p.stats?.deaths ?? p.d ?? 0;
            const a = p.stats?.assists ?? p.a ?? 0;
            const gold = p.currentGold ?? 0;
            const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5);
            let setScore = 65 + kda + (gold / 1500);
            const role2 = p.role || p.playerData?.포지션 || 'MID';
            if (['SUP', '서포터'].includes(role2)) setScore += Math.max(10 - (d * 1.5), 2);
            if (['JGL', '정글'].includes(role2))   setScore += Math.max(6 - d, 0);
            if (['TOP', '탑'].includes(role2))     setScore += Math.max(4 - d, 0);
            players[name].games++;
            players[name].totalScore += setScore;
            if (!players[name].role) players[name].role = p.role || p.playerData?.포지션;
            if (!players[name].team) players[name].team = p.playerData?.팀 || p.playerData?.team;
          }
        }
      }
      // POG leader
      let maxPog = 0; let pogLeaderName = null;
      Object.entries(players).forEach(([name, d]) => {
        if (d.pog > maxPog || (d.pog === maxPog && maxPog > 0 && d.totalScore > (players[pogLeaderName]?.totalScore || 0))) {
          maxPog = d.pog; pogLeaderName = name;
        }
      });
      // Finals MVP (for playoffs)
      let finalsMvpName = null;
      if (forPlayoffs && finals?.result?.history && finals?.result?.winner) {
        const winName = finals.result.winner?.trim().toLowerCase();
        const posScores = {};
        safeArr(finals.result.history).forEach(game => {
          const picksA = game.picks?.A || [];
          const picksB = game.picks?.B || [];
          const teamAName = picksA[0]?.playerData?.팀?.trim().toLowerCase();
          const teamBName = picksB[0]?.playerData?.팀?.trim().toLowerCase();
          const aMatch = teamAName && winName && (teamAName === winName || teamAName.includes(winName) || winName.includes(teamAName));
          const bMatch = teamBName && winName && (teamBName === winName || teamBName.includes(winName) || winName.includes(teamBName));
          const targetPicks = (aMatch && !bMatch) ? picksA : (bMatch && !aMatch) ? picksB : (aMatch && bMatch) ? picksA : null;
          if (!targetPicks) return;
          targetPicks.forEach(p => {
            if (!p?.playerName) return;
            if (!posScores[p.playerName]) posScores[p.playerName] = 0;
            const k = p.stats?.kills ?? p.k ?? 0; const d = p.stats?.deaths ?? p.d ?? 0; const a = p.stats?.assists ?? p.a ?? 0; const gold = p.currentGold ?? 0;
            const kda3 = (k * 3 + a * 0.25) / Math.max(d, 1.5); let posScore = 65 + kda3 + (gold / 1500);
            const role3 = p.role || p.playerData?.포지션 || 'MID';
            if (['SUP', '서포터'].includes(role3)) posScore += Math.max(10 - (d * 1.5), 2);
            if (['JGL', '정글'].includes(role3))   posScore += Math.max(6 - d, 0);
            if (['TOP', '탑'].includes(role3))     posScore += Math.max(4 - d, 0);
            posScores[p.playerName] += posScore;
          });
        });
        const posSorted = Object.entries(posScores).sort((a, b) => b[1] - a[1]);
        if (posSorted.length > 0) finalsMvpName = posSorted[0][0];
      }
      const scored = Object.entries(players).filter(([, d]) => d.games > 0).map(([name, d]) => {
        const teamName = d.team || ''; const rankPoints = rankPtsMap[teamName] ?? 0;
        const avgScore = d.totalScore / d.games; const pogCount = d.pog;
        const isPogLeader = name === pogLeaderName; const isFinalsMvp = name === finalsMvpName;
        const finalScore = rankPoints + (pogCount * 10) + avgScore + (isFinalsMvp ? 20 : 0) + (isPogLeader ? 20 : 0);
        return { playerName: name, role: normalizeRole(d.role), team: teamName, teamObj: { name: teamName }, rankPoints, avgScore, pogCount, isPogLeader, isFinalsMvp, mvpBonus: 0, finalScore };
      }).sort((a, b) => b.finalScore - a.finalScore);
      const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
      const allProTeams = { 1: {}, 2: {}, 3: {} }; const usedByRole = {};
      ROLES.forEach(r => { usedByRole[r] = []; });
      for (const tier of [1, 2, 3]) { for (const role of ROLES) { const eligible = scored.filter(p => p.role === role && !usedByRole[role].includes(p.playerName)); if (eligible[0]) { allProTeams[tier][role] = eligible[0]; usedByRole[role].push(eligible[0].playerName); } } }
      return { seasonMvp: scored[0] || null, pogLeader: scored.find(p => p.isPogLeader) || null, finalsMvp: scored.find(p => p.isFinalsMvp) || null, allProTeams };
    };

    const FST_GROUP_SCALE_ARCHIVE   = [100, 100, 80, 80, 60, 60, 40, 40];
    const FST_PLAYOFF_SCALE_ARCHIVE = [100, 80, 60, 50, 40, 30, 20, 10];

    const fstGroupAwards   = buildFSTAwards(FST_GROUP_SCALE_ARCHIVE,   fstGroupRanks,   false);
    const fstPlayoffAwards = buildFSTAwards(FST_PLAYOFF_SCALE_ARCHIVE, fstPlayoffRanks, true);

    const fstSnapshot = {
      year:        currentYear,
      seasonName:  'FST World Tournament',
      champion:    { name: fstGetW(finals) },
      matches:     fstMatches,
      fstTeams:    fstTeams,
      finalStandings: fstPlayoffRanks.map((name, i) => ({
        rank: i + 1,
        team: fstTeams.find(t => t.name === name) || { name }
      })),
      groupStandings: fstGroupRanks.map((name, i) => ({
        rank: i + 1,
        team: fstTeams.find(t => t.name === name) || { name }
      })),
      awards: {
        regular: {
          mvp:       fstGroupAwards.seasonMvp,
          allPro:    fstGroupAwards.allProTeams,
          pogLeader: fstGroupAwards.pogLeader
        },
        playoff: {
          finalsMvp:  fstPlayoffAwards.finalsMvp,
          playoffMvp: fstPlayoffAwards.pogLeader,
          allPro:     fstPlayoffAwards.allProTeams
        }
      }
    };

    newForeignHistory.FST = [fstSnapshot]; // one record per FST (single world tournament)
  }

  // --- 4. SAVE TO DB ---
  const updatedLeague = { 
      ...league, 
      history: newHistory,
      foreignHistory: newForeignHistory
  };
  
  setLeague(updatedLeague);
  updateLeague(league.id, updatedLeague);
  
  // Show toast notification instead of alert()
  setSaveMessage('✅ 시즌 기록 저장 완료! (LCK, 해외 리그, FST 데이터 통합 저장됨)');
  setTimeout(() => setSaveMessage(''), 4000);
};

    // AUTO-ARCHIVE: runs silently only when season just finished and not yet saved
    // We use a ref to prevent re-triggering after manual save updates league state
    const autoArchiveRanRef = useRef(false);
    const autoArchiveFSTRanRef = useRef(false);
    useEffect(() => {
        if (!league || !league.matches) return;
        if (autoArchiveRanRef.current) return;
        if (isSeasonOver && !isSavedInHistory) {
            autoArchiveRanRef.current = true;
            handleManualArchive();
        }
    }, [isSeasonOver, isSavedInHistory]);

    // Auto-archive FST when the Finals match finishes and hasn't been saved yet
    useEffect(() => {
        if (!league) return;
        if (autoArchiveFSTRanRef.current) return;
        if (isFSTOver && !isFSTSavedInHistory) {
            autoArchiveFSTRanRef.current = true;
            handleManualArchive();
        }
    }, [isFSTOver, isFSTSavedInHistory]);

    // ── 16.02 PATCH HANDLER ──────────────────────────────────────────────────
    // LCK players: auto-fires when all regular matches finish (same as before).
    // Foreign players: button appears when LCK regular season is done → click to apply.
    const meta1602Ref = useRef(false);

    // ── LCK Playoff bracket team-fill ────────────────────────────────────────
    // Runs after every match finishes. Recomputes ALL bracket team slots from
    // first principles (seed assignments + actual results) and writes any slot
    // that is wrong OR empty — handles both TBD and BracketManager mis-fills.
    useEffect(() => {
        if (!league?.matches) return;
        if ((league.myLeague || 'LCK') !== 'LCK') return;

        const po = league.matches.filter(m => m.type === 'playoff');
        if (po.length === 0) return;

        const seeds = league.playoffSeeds || [];
        const sid = (n) => seeds.find(s => s.seed === n)?.id ?? null;
        const s1 = sid(1), s2 = sid(2), s3 = sid(3), s4 = sid(4);

        const isTBD = (v) => !v || String(v) === 'TBD' || String(v) === 'null' || String(v) === 'undefined';

        // ── Identify each match by its known participants, not by match-field ──
        const r1All = po.filter(m => m.round === 1);
        const r1m1 = r1All.find(m => [String(m.t1),String(m.t2)].includes(String(s3))) || r1All[0] || null;
        const r1m2 = r1All.find(m => [String(m.t1),String(m.t2)].includes(String(s4))) || r1All[1] || null;

        const r2All = po.filter(m => m.round === 2);
        const r2m1 = r2All.find(m => [String(m.t1),String(m.t2)].includes(String(s1))) || r2All[0] || null;
        const r2m2 = r2All.find(m => [String(m.t1),String(m.t2)].includes(String(s2))) || r2All[1] || null;

        const r2lm1 = po.find(m => Number(m.round) === 2.1) || null;
        const r2lm2 = po.find(m => Number(m.round) === 2.2) || null;
        const r3m1  = po.find(m => m.round === 3)   || null;
        const r3lm1 = po.find(m => Number(m.round) === 3.1) || null;
        // qualifier may be stored as round:4 (correct) or round:5 (BracketManager bug)
        const r4m1  = po.find(m => m.round === 4) ||
                      po.find(m => m.round === 5 && String(m.label||'').includes('진출')) || null;
        const r5m1  = po.find(m => m.round === 5 && !String(m.label||'').includes('진출')) || null;

        // ── Winner/loser resolvers ──────────────────────────────────────────
        const getW = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const wName = m.result.winner;
            const t1t = teams.find(t => String(t.id) === String(m.t1));
            const t2t = teams.find(t => String(t.id) === String(m.t2));
            if (t1t?.name === wName) return m.t1;
            if (t2t?.name === wName) return m.t2;
            const byName = teams.find(t => t.name === wName);
            return byName ? byName.id : null;
        };
        const getL = (m) => {
            const w = getW(m);
            if (!w || !m) return null;
            return String(m.t1) === String(w) ? m.t2 : m.t1;
        };

        // Higher-seed (lower seed number) loser of R2 upper → better team, gets bye to 3.1
        // Lower-seed  (higher seed number) loser of R2 upper → worse team, must play through 2.2
        const r2Losers = (() => {
            const lA = getL(r2m1), lB = getL(r2m2);
            const items = [lA, lB].filter(Boolean);
            if (items.length < 2) return { better: items[0] || null, worse: items[0] || null };
            const sA = seeds.find(s => String(s.id) === String(items[0]))?.seed ?? 99;
            const sB = seeds.find(s => String(s.id) === String(items[1]))?.seed ?? 99;
            return sA <= sB
                ? { better: items[0], worse: items[1] }
                : { better: items[1], worse: items[0] };
        })();

        // Expected teams for each bracket slot.
        // worse loser (higher seed #) → 2.2, better loser (lower seed #) → 3.1 bye.
        const expected = {
            '2.1': [getL(r1m1),         getL(r1m2)],
            '2.2': [r2Losers.worse,      getW(r2lm1)],
            '3':   [getW(r2m1),          getW(r2m2)],
            '3.1': [r2Losers.better,     getW(r2lm2)],
            '4':   [getL(r3m1),          getW(r3lm1)],
            '5':   [getW(r3m1),          getW(r4m1)],
        };

        let changed = false;
        const updatedMatches = league.matches.map(m => {
            if (m.type !== 'playoff') return m;

            // Normalize qualifier round if BracketManager stored it as round:5 with '진출' label
            let base = m;
            if (m.round === 5 && String(m.label||'').includes('진출')) {
                base = { ...m, round: 4, label: '결승 진출전' };
                changed = true;
            }

            const key = String(base.round);
            const exp = expected[key];
            if (!exp) return base;

            const [expT1, expT2] = exp;
            let t1 = base.t1, t2 = base.t2;
            // Overwrite if expected is known AND current is wrong/empty
            if (expT1 && (isTBD(t1) || String(t1) !== String(expT1))) { t1 = expT1; changed = true; }
            if (expT2 && (isTBD(t2) || String(t2) !== String(expT2))) { t2 = expT2; changed = true; }
            if (t1 === base.t1 && t2 === base.t2 && base === m) return m;
            return { ...base, t1, t2 };
        });

        if (!changed) return;
        updateLeague(league.id, { matches: updatedMatches });
        setLeague(prev => ({ ...prev, matches: updatedMatches }));
    }, [
        league?.matches?.filter(m => m.status === 'finished').length,
        league?.matches?.length,
        league?.myLeague
    ]);
    useEffect(() => {
        if (!league || !league.matches) return;
        if ((league.myLeague || 'LCK') !== 'LCK') return; // foreign: button handles it
        if (meta1602Ref.current) return;
        if (league.metaVersion === '16.02' || league.metaVersion === '16.03') return;

        const regularMatches = league.matches.filter(m => m.type === 'regular');
        if (regularMatches.length === 0) return;
        if (!regularMatches.every(m => m.status === 'finished')) return;

        meta1602Ref.current = true;
        const sourceList = (league.currentChampionList?.length > 0) ? league.currentChampionList : championList;
        const newChampionList = updateChampionMeta(sourceList);
        const superMatches = generateSuperWeekMatches(league);
        const cleanMatches = league.matches.filter(m => m.type !== 'tbd');
        const updatedMatches = [...cleanMatches, ...superMatches].sort((a, b) =>
            (parseFloat((a.date || '').split(' ')[0]) || 0) - (parseFloat((b.date || '').split(' ')[0]) || 0)
        );
        const updates = { matches: updatedMatches, currentChampionList: newChampionList, metaVersion: '16.02' };
        setLeague(prev => ({ ...prev, ...updates }));
        updateLeague(league.id, updates);
    }, [league?.matches?.length, league?.metaVersion]);

    // Handler for the foreign player's manual 16.02 button
    // Also generates LCK super week so the LCK background sim can continue past regular season
    const handleForeignMeta1602 = () => {
        const sourceList = (league.currentChampionList?.length > 0) ? league.currentChampionList : championList;
        const newChampionList = updateChampionMeta(sourceList);
        // Generate LCK super week so ScheduleTab can sim it in the background
        const superMatches = generateSuperWeekMatches(league);
        const cleanMatches = (league.matches || []).filter(m => m.type !== 'tbd');
        const updatedMatches = [...cleanMatches, ...superMatches].sort((a, b) =>
            (parseFloat((a.date || '').split(' ')[0]) || 0) - (parseFloat((b.date || '').split(' ')[0]) || 0)
        );
        const updates = { matches: updatedMatches, currentChampionList: newChampionList, metaVersion: '16.02' };
        setLeague(prev => ({ ...prev, ...updates }));
        updateLeague(league.id, updates);
    };

    // ── LEC Playoff Seed Picking ──────────────────────────────────────────────
    // Seeds 1, 2, 3 each pick their opponent from seeds 5-8 in order.
    // If the player IS one of those seeds, show the opponentChoice modal.
    // CPU seeds use 80% rule (pick weakest available).
    const handleLECPlayoffStart = () => {
        if (myLeague !== 'LEC') return;
        const foreignTeamsList = FOREIGN_LEAGUES['LEC'] || [];
        const lecMatches = league.foreignMatches?.['LEC'] || [];

        // Build standings from regular season
        const st = {};
        foreignTeamsList.forEach(t => { st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], id: t.id || t.name, name: t.name }; });
        lecMatches.filter(m => m.type === 'regular' && m.status === 'finished').forEach(m => {
            const w = m.result?.winner;
            const t1n = foreignTeamsList.find(t => t.name === m.t1 || t.id === m.t1)?.name || m.t1;
            const t2n = foreignTeamsList.find(t => t.name === m.t2 || t.id === m.t2)?.name || m.t2;
            const l = w === t1n ? t2n : t1n;
            if (st[w]) { st[w].w++; st[w].defeatedOpponents.push(l); if (!st[w].h2h[l]) st[w].h2h[l] = { w: 0, l: 0 }; st[w].h2h[l].w++; }
            if (st[l]) { st[l].l++; if (!st[l].h2h[w]) st[l].h2h[w] = { w: 0, l: 0 }; st[l].h2h[w].l++; }
        });
        const sorted = Object.values(st).sort((a, b) => b.w - a.w || b.diff - a.diff);
        const seeds = sorted.map((t, i) => ({ ...t, seed: i + 1 }));

        // Save seeds
        const seedUpdates = { foreignPlayoffSeeds: { ...(league.foreignPlayoffSeeds || {}), LEC: seeds } };
        updateLeague(league.id, seedUpdates);
        setLeague(prev => ({ ...prev, ...seedUpdates }));

        const getSeedObj = (n) => seeds.find(s => s.seed === n);
        const getTeamObj = (seedObj) => {
            if (!seedObj) return null;
            const t = foreignTeamsList.find(x => x.name === seedObj.name || x.id === seedObj.id);
            return t ? { ...t, colors: { primary: TEAM_COLORS[t.name] || TEAM_COLORS['DEFAULT'], secondary: '#fff' } } : null;
        };

        const mySeed = seeds.find(s => s.name === myTeam.name || s.id === myTeam.id)?.seed;
        const pickerSeeds = [1, 2, 3]; // seeds that pick opponents
        const available = [5, 6, 7, 8]; // seeds available to be picked

        // CPU auto-pick: 80% picks weakest (highest seed number)
        const cpuPick = (pool) => {
            const sorted = [...pool].sort((a, b) => b - a);
            return Math.random() < 0.80 ? sorted[0] : (sorted[1] || sorted[0]);
        };

        // Build the bracket picks for seeds 1,2,3,4
        const buildBracket = (picks) => {
          // Higher seed must always be Blue side (t1).
          // In LEC playoffs: smaller seed number = higher seed.
          const asToken = (seedNum) => getSeedObj(seedNum)?.id || getSeedObj(seedNum)?.name;
          const seedMatch = (higherSeedNum, lowerSeedNum) => ({
            t1: asToken(higherSeedNum),
            t2: asToken(lowerSeedNum),
            blueSidePriority: asToken(higherSeedNum),
          });
          
          const dates = ['2.17 (화)', '2.17 (화)', '2.18 (수)', '2.18 (수)'];
          const times = ['00:45', '02:30', '00:45', '02:30'];
          
          // Seeded side assignment (higher seed = t1)
          const match1 = seedMatch(1, picks[1]);
          const match2 = seedMatch(2, picks[2]);
          const match3 = seedMatch(3, picks[3]);
          const match4 = seedMatch(4, picks[4]);
          
          const ub1 = [
              { id: 'lec_po_ub1g1', label: '1라운드 승자조', t1: match1.t1, t2: match1.t2, blueSidePriority: match1.blueSidePriority, date: dates[0], time: times[0], type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 1 },
              { id: 'lec_po_ub1g2', label: '1라운드 승자조', t1: match2.t1, t2: match2.t2, blueSidePriority: match2.blueSidePriority, date: dates[1], time: times[1], type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 2 },
              { id: 'lec_po_ub1g3', label: '1라운드 승자조', t1: match3.t1, t2: match3.t2, blueSidePriority: match3.blueSidePriority, date: dates[2], time: times[2], type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 3 },
              { id: 'lec_po_ub1g4', label: '1라운드 승자조', t1: match4.t1, t2: match4.t2, blueSidePriority: match4.blueSidePriority, date: dates[3], time: times[3], type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 4 },
          ];
          
          const rest = [
              { id: 'lec_po_ub2g1', label: '2라운드 승자조', t1: null, t2: null, date: '2.21 (토)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 2, match: 1 },
              { id: 'lec_po_ub2g2', label: '2라운드 승자조', t1: null, t2: null, date: '2.21 (토)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 2, match: 2 },
              { id: 'lec_po_lb1g1', label: '1라운드 패자조', t1: null, t2: null, date: '2.22 (일)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 1.1, match: 1 },
              { id: 'lec_po_lb1g2', label: '1라운드 패자조', t1: null, t2: null, date: '2.22 (일)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 1.1, match: 2 },
              { id: 'lec_po_lb2g1', label: '2라운드 패자조', t1: null, t2: null, date: '2.23 (월)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 2.1, match: 1 },
              { id: 'lec_po_lb2g2', label: '2라운드 패자조', t1: null, t2: null, date: '2.23 (월)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 2.1, match: 2 },
              { id: 'lec_po_ubf',   label: '3라운드 승자조', t1: null, t2: null, date: '2.24 (화)', time: '00:45', type: 'playoff', format: 'BO5', status: 'pending', round: 3, match: 1 },
              { id: 'lec_po_lbsf',  label: '3라운드 패자조', t1: null, t2: null, date: '2.28 (토)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 3.1, match: 1 },
              { id: 'lec_po_r4',    label: '4라운드',         t1: null, t2: null, date: '3.1 (일)',  time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 4, match: 1 },
              { id: 'lec_po_final', label: '결승전',           t1: null, t2: null, date: '3.2 (월)',  time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 5, match: 1 },
          ];
          
          const allPlayoffs = [...ub1, ...rest];
          const updatedMatches = [...lecMatches, ...allPlayoffs];
          const updates = {
              foreignMatches: { ...league.foreignMatches, LEC: updatedMatches },
              foreignPlayoffSeeds: { ...(league.foreignPlayoffSeeds || {}), LEC: seeds }
          };
          
          updateLeague(league.id, updates);
          setLeague(prev => ({ ...prev, ...updates }));
          setOpponentChoice(null);
      };

        // Sequential pick logic — seeds 1,2,3 pick in order, seed 4 gets what's left
        const doPicks = (remaining, pickerIdx, currentPicks) => {
            const pickerSeed = pickerSeeds[pickerIdx];
            if (pickerIdx >= pickerSeeds.length) {
                currentPicks[4] = remaining[0];
                buildBracket(currentPicks);
                return;
            }

            const isPlayerPicker = mySeed === pickerSeed;
            if (isPlayerPicker) {
                const oppTeams = remaining.map(n => getTeamObj(getSeedObj(n))).filter(Boolean);
                setOpponentChoice({
                    title: `🏆 LEC 플레이오프 — ${pickerSeed}시드 상대 선택`,
                    description: `${pickerSeed}시드로서 1라운드 상대를 선택하세요.`,
                    type: 'lec_seed_pick',
                    opponents: oppTeams.map(t => ({ ...t, _seed: seeds.find(s => s.name === t.name)?.seed })),
                    onConfirm: (picked) => {
                        const pickedSeedNum = seeds.find(s => s.name === picked.name || s.id === picked.id)?.seed;
                        const newRemaining = remaining.filter(n => n !== pickedSeedNum);
                        const newPicks = { ...currentPicks, [pickerSeed]: pickedSeedNum };
                        doPicks(newRemaining, pickerIdx + 1, newPicks);
                    }
                });
            } else {
                const picked = cpuPick(remaining);
                const newRemaining = remaining.filter(n => n !== picked);
                const newPicks = { ...currentPicks, [pickerSeed]: picked };
                doPicks(newRemaining, pickerIdx + 1, newPicks);
            }
        };

        doPicks([...available], 0, {});
    };

  
  // [CRITICAL FIX] handleMatchClick now injects round info for old saves
  // [CRITICAL FIX] Global Team Finder for the Modal!
 // [CRITICAL FIX] Omni-Search Team Finder with ROSTER INJECTION for the Modal!
 const findGlobalTeamForModal = (teamIdentifier) => {
  if (!teamIdentifier) return { name: 'Unknown', roster: [] };
  
  const searchStr = String(teamIdentifier).trim().toUpperCase();
  let found = null;

  // 1. Search FST (NEW FIX)
  if (league?.fst?.teams) {
      found = league.fst.teams.find(t => 
          String(t.fstId).toUpperCase() === searchStr || 
          String(t.name).toUpperCase() === searchStr
      );
  }

  // 2. Search LCK
  if (!found) {
      found = teams.find(t => String(t.id).toUpperCase() === searchStr || t.name.toUpperCase() === searchStr);
  }
  
  // 2. Search Foreign Leagues
  if (!found) {
      const allForeign = Object.values(FOREIGN_LEAGUES).flat();
      found = allForeign.find(t => 
          (t.id && String(t.id).toUpperCase() === searchStr) || 
          (t.name && t.name.toUpperCase() === searchStr) ||
          (t.fullName && t.fullName.toUpperCase() === searchStr)
      );
  }

  const baseTeam = found || { name: String(teamIdentifier), colors: { primary: '#333' } };

  // 3. Inject Roster so DetailedMatchResultModal never throws a White Screen!
  let r = [];
  if (baseTeam.name) {
      // Try LCK roster logic first
      r = getFullTeamRoster(baseTeam.name);
      
      // If empty, search foreign players
      if (!r || r.length < 5) {
          const allForeignPlayers = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);
          const foreignRoster = allForeignPlayers.filter(p => p.팀 === baseTeam.name || p.team === baseTeam.name || p.Team === baseTeam.name);
          
          const requiredRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
          r = requiredRoles.map(role => {
              const existing = foreignRoster.find(p => String(p.포지션 || p.role).toUpperCase() === role);
              if (existing) {
                  return { 
                      ...existing, 
                      이름: existing.한글명 || existing.이름 || existing.playerName || `${baseTeam.name} ${role}`, 
                      종합: existing.종합 || existing.ovr || 80 
                  };
              }
              return { 이름: `${baseTeam.name} ${role}`, 포지션: role, 종합: 80 };
          });
      }
  }

  return { ...baseTeam, roster: r };
};

const handleMatchClick = (match) => {
  if (!match || match.status !== 'finished' || !match.result) return;
  
  // Safely parse ID or String
  const getID = (id) => (typeof id === 'object' ? id.id : id);
  const t1Id = getID(match.t1);
  const t2Id = getID(match.t2);
  
  // Use the new Roster Injector!
  const teamA = findGlobalTeamForModal(t1Id);
  const teamB = findGlobalTeamForModal(t2Id);
  
  setMyMatchResult({
      resultData: {
          ...match.result,
          type: match.type, // Fix: Tell the modal EXACTLY what type of match this is
          // Fix: Never pass round '5' to the modal if it is NOT a playoff match, preventing false Finals MVPs.
          round: match.type === 'playoff' ? match.round : undefined, 
          roundIndex: match.roundIndex,
          roundName: match.label || match.roundName || match.fstRound ||
              ((match.type === 'playoff' && !String(match.label || '').includes('진출') &&
                (match.round === 5 || String(match.label || '').includes('결승전'))) ? 'Grand Final' : undefined),
          matchId: match.id,
          fstRound: match.fstRound
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

    // ── Foreign league mode ──────────────────────────────────────────────────
    const myLeague = (() => {
        if (league.myLeague) return league.myLeague;
        // Fallback: detect from team name — LCK teams have numeric ids
        const teamId = league.team?.id;
        const teamName = league.team?.name;
        if (typeof teamId === 'number' && teamId >= 1 && teamId <= 10) return 'LCK';
        // Search foreign leagues
        for (const [lgKey, lgTeams] of Object.entries(FOREIGN_LEAGUES)) {
            if (lgTeams.some(t => t.name === teamName || t.id === teamId)) return lgKey;
        }
        return 'LCK';
    })();
    const isMyLeagueForeign = myLeague !== 'LCK';

    // Detect when LEC user needs to pick seeds (regular done, no playoffs yet)
    const lecPlayoffPickNeeded = isMyLeagueForeign && myLeague === 'LEC' &&
        (() => {
            const lecMs = league.foreignMatches?.['LEC'] || [];
            const regularDone = lecMs.filter(m => m.type === 'regular').length > 0 &&
                                lecMs.filter(m => m.type === 'regular').every(m => m.status === 'finished');
            const noPlayoffs = !lecMs.some(m => m.type === 'playoff');
            return regularDone && noPlayoffs;
        })();

    // ── myTeam: LCK uses numeric ID, foreign uses name string ───────────────
    const myTeam = (() => {
      if (!isMyLeagueForeign) {
        return teams.find(t => String(t.id) === String(league.team.id)) || league.team;
      }
      const foreignTeamsList = FOREIGN_LEAGUES[myLeague] || [];
      const found = foreignTeamsList.find(t => t.name === league.team.name || t.id === league.team.id);
      if (found) {
        return { ...found, colors: { primary: TEAM_COLORS[found.name] || TEAM_COLORS['DEFAULT'], secondary: '#fff' } };
      }
      // Fallback: use saved team object (already has colors from TeamSelection)
      return league.team;
    })();

    // ── viewingTeam: for foreign players just use myTeam ────────────────────
    const viewingTeam = (() => {
      if (!isMyLeagueForeign) {
        return teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
      }
      return myTeam;
    })();

    // ── currentRoster: LCK = players.json, foreign = FOREIGN_PLAYERS ────────
    const currentRoster = (() => {
      if (!isMyLeagueForeign) {
        return (playerList || []).filter(p => p.팀 === viewingTeam.name);
      }
      const allForeignPlayers = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);
      return allForeignPlayers.filter(p => p.팀 === viewingTeam.name || p.team === viewingTeam.name);
    })();

    // ── Draft: LCK-only concept; foreign players always skip it ─────────────
    const isCaptain = !isMyLeagueForeign && (myTeam.id === 1 || myTeam.id === 2);
    const hasDrafted = isMyLeagueForeign ? true : (league.groups && league.groups.baron && league.groups.baron.length > 0);

    // ── nextGlobalMatch: scan the user's own league matches ─────────────────
    const parseDateTime = (m) => {
      const [month, day] = (m.date || '').split(' ')[0].split('.').map(Number);
      const [h, min] = (m.time || '0:00').split(':').map(Number);
      return (month || 0) * 10000000 + (day || 0) * 100000 + (h || 0) * 100 + (min || 0);
    };

    const nextGlobalMatch = (() => {
      const matchPool = isMyLeagueForeign
        ? (league.foreignMatches?.[myLeague] || [])
        : (league.matches || []);
      return [...matchPool]
        .filter(m => m.status === 'pending' && m.t1 && m.t2 &&
          String(m.t1) !== 'null' && String(m.t2) !== 'null' &&
          String(m.t1) !== 'TBD' && String(m.t2) !== 'TBD')
        .sort((a, b) => parseDateTime(a) - parseDateTime(b))[0] || null;
    })();

    // ID Normalization Helper to safely compare IDs (LCK)
    const safeId = (id) => (typeof id === 'object' ? id.id : Number(id));

    // ── isMyNextMatch: numeric for LCK, name-string for foreign ─────────────
    const isMyNextMatch = nextGlobalMatch
      ? isMyLeagueForeign
        ? (nextGlobalMatch.t1 === myTeam.name || nextGlobalMatch.t2 === myTeam.name ||
           nextGlobalMatch.t1 === myTeam.id   || nextGlobalMatch.t2 === myTeam.id)
        : (safeId(nextGlobalMatch.t1) === safeId(myTeam.id) || safeId(nextGlobalMatch.t2) === safeId(myTeam.id))
      : false;

    // ── t1/t2 for next-match display in header button ────────────────────────
    const t1 = nextGlobalMatch
      ? isMyLeagueForeign
        ? (FOREIGN_LEAGUES[myLeague] || []).find(t => t.name === nextGlobalMatch.t1 || t.id === nextGlobalMatch.t1)
        : teams.find(t => t.id === safeId(nextGlobalMatch.t1))
      : null;
    const t2 = nextGlobalMatch
      ? isMyLeagueForeign
        ? (FOREIGN_LEAGUES[myLeague] || []).find(t => t.name === nextGlobalMatch.t2 || t.id === nextGlobalMatch.t2)
        : teams.find(t => t.id === safeId(nextGlobalMatch.t2))
      : null;

    // isMyNextFSTMatch MUST be here — after myTeam is defined
    const isMyNextFSTMatch = nextFSTMatch
      ? (nextFSTMatchT1?.name === myTeam?.name || nextFSTMatchT2?.name === myTeam?.name)
      : false;

    
  
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
          
          let newMatches = createPlayoffRound2Matches(
              currentMatches,
              seed1,
              seed2,
              pickedWinner.id,
              remainingWinner,
              r1Losers[0].id,
              r1Losers[1].id
          );
          
          // Safeguard: createPlayoffRound2Matches sometimes omits the 패자조 2라운드 (round 2.1) match.
          // Without it, r2Finished is never true, so ALL downstream rounds (3, 2.2, 3.1, 4, 5)
          // are never generated either. Manually add it here if missing.
          if (!newMatches.some(m => m.type === 'playoff' && Number(m.round) === 2.1)) {
              newMatches = [...newMatches, {
                  id: Date.now() + 550,
                  round: 2.1,
                  match: 1,
                  label: '패자조 2라운드',
                  t1: r1Losers[0].id,
                  t2: r1Losers[1].id,
                  date: '2.18 (화)',
                  time: '17:00',
                  type: 'playoff',
                  format: 'BO5',
                  status: 'pending'
              }];
          }
          
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
  const r2lMatch = currentMatches.find(m => m.type === 'playoff' && Number(m.round) === 2.1);
  const r2Finished = r2wMatches.length === 2 && r2wMatches.every(m => m.status === 'finished') && r2lMatch?.status === 'finished';
  const r3Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 3);

  if (r2Finished && !r3Exists) {
      let newMatches = createPlayoffRound3Matches(currentMatches, league.playoffSeeds, teams);

      // Always correct the 2.2 and 3.1 team assignments regardless of what BracketManager set.
      // createPlayoffRound3Matches sometimes swaps r2HigherLoser and r2LowerLoser between slots.
      // r2LowerLoser  = higher seed number (worse team)  → must play through 2.2
      // r2HigherLoser = lower  seed number (better team) → gets bye directly to 3.1
      (() => {
          const getWId = (m) => {
              if (!m || m.status !== 'finished' || !m.result?.winner) return null;
              const w = m.result.winner;
              const t1t = teams.find(t => String(t.id) === String(m.t1));
              const t2t = teams.find(t => String(t.id) === String(m.t2));
              if (t1t?.name === w) return m.t1;
              if (t2t?.name === w) return m.t2;
              return teams.find(t => t.name === w)?.id ?? null;
          };
          const getLId = (m) => {
              const w = getWId(m);
              if (!w || !m) return null;
              return String(m.t1) === String(w) ? m.t2 : m.t1;
          };

          const seedsList = league.playoffSeeds || [];
          const getSeedNum = (id) => seedsList.find(s => String(s.id) === String(id))?.seed ?? 99;

          // Identify the two R2 upper matches
          const r2uMs = newMatches.filter(m => m.type === 'playoff' && m.round === 2);
          const lossers = r2uMs.map(m => getLId(m)).filter(Boolean);
          if (lossers.length < 2) return; // R2 not fully resolved yet

          // Sort by seed: lossers[0] = better seeded (lower seed number), lossers[1] = worse
          lossers.sort((a, b) => getSeedNum(a) - getSeedNum(b));
          const betterLoser = lossers[0]; // goes to 3.1 (bye)
          const worseLoser  = lossers[1]; // goes to 2.2 (must play again)

          const r2lMs = newMatches.find(m => m.type === 'playoff' && Number(m.round) === 2.1);
          const r2lWinner = getWId(r2lMs); // winner of 패자조 1라운드

          // Fix or create round 2.2 (패자조 2라운드): worseLoser vs r2lWinner
          const m22Idx = newMatches.findIndex(m => m.type === 'playoff' && Number(m.round) === 2.2);
          if (m22Idx >= 0) {
              newMatches = newMatches.map((m, i) =>
                  i === m22Idx ? { ...m, t1: worseLoser, t2: r2lWinner || m.t2 } : m
              );
          } else {
              newMatches = [...newMatches, {
                  id: Date.now() + 560,
                  round: 2.2, match: 1, label: '패자조 2라운드',
                  t1: worseLoser, t2: r2lWinner || 'TBD',
                  date: '2.20 (목)', time: '17:00',
                  type: 'playoff', format: 'BO5', status: 'pending'
              }];
          }

          // Fix or create round 3.1 (패자조 3라운드): betterLoser vs winner-of-2.2 (TBD for now)
          const m31Idx = newMatches.findIndex(m => m.type === 'playoff' && Number(m.round) === 3.1);
          if (m31Idx >= 0) {
              newMatches = newMatches.map((m, i) =>
                  i === m31Idx ? { ...m, t1: betterLoser } : m
              );
          }
          // (3.1 creation is handled by createPlayoffLoserRound3Match later)
      })();

      updateLeague(league.id, { matches: newMatches });
      setLeague(prev => ({ ...prev, matches: newMatches }));
      alert("👑 플레이오프 3라운드 승자조 및 2라운드 패자조 경기가 생성되었습니다!");
      return;
  }
    
    // --- R3L + R4 + Final: identify matches by seed/round, not by label ------
    // The qualifier (결승 진출전) is whichever playoff match sits between r3.1 and
    // the grand final — we find it by exclusion from all other known rounds.
    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && Number(m.round) === 2.2);
    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lExists = currentMatches.some(m => m.type === 'playoff' && Number(m.round) === 3.1);

    if (r2_2Match?.status === 'finished' && r3wMatch?.status === 'finished' && !r3lExists) {
        let newMatches = createPlayoffLoserRound3Match(currentMatches, league.playoffSeeds, teams);

        // Safeguard: ensure round 3.1 (패자조 3라운드) was actually created.
        if (!newMatches.some(m => m.type === 'playoff' && Number(m.round) === 3.1)) {
            const getWId = (m) => teams.find(t => t.name === m?.result?.winner)?.id ?? null;
            const getLId = (m) => { const w = getWId(m); if (!w || !m) return null; const t1r = typeof m.t1 === 'object' ? m.t1?.id : m.t1; const t2r = typeof m.t2 === 'object' ? m.t2?.id : m.t2; return String(t1r) === String(w) ? t2r : t1r; };
            const r3Loser = r3wMatch ? getLId(r3wMatch) : null;
            const r22Winner = r2_2Match ? getWId(r2_2Match) : null;
            newMatches = [...newMatches, {
                id: Date.now() + 570,
                round: 3.1, match: 1, label: '패자조 3라운드',
                t1: r3Loser || 'TBD', t2: r22Winner || 'TBD',
                date: '2.24 (월)', time: '17:00',
                type: 'playoff', format: 'BO5', status: 'pending'
            }];
        }

        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("👑 플레이오프 3라운드 패자조 경기가 생성되었습니다!");
        return;
    }

    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && Number(m.round) === 3.1);

    // Qualifier: round 4 OR (round 5 + '진출' label) OR the only playoff match
    // whose round is not in {1,2,2.1,2.2,3,3.1} and is not yet the grand final.
    const knownRounds = new Set([1, 2, 2.1, 2.2, 3, 3.1]);
    const isQualifier = (m) =>
        m.type === 'playoff' && (
            m.round === 4 ||
            (m.round === 5 && String(m.label || '').includes('진출')) ||
            (!knownRounds.has(m.round) && m.round !== 5)
        );
    const r4Exists = currentMatches.some(isQualifier);

    if (r3lMatch?.status === 'finished' && r3wMatch?.status === 'finished' && !r4Exists) {
        const rawMatches = createPlayoffQualifierMatch(currentMatches, teams);
        // Normalize: force round:4 + label on the newly added match
        const existingIds = new Set(currentMatches.map(m => m.id));
        const newMatches = rawMatches.map(m =>
            m.type === 'playoff' && !existingIds.has(m.id)
                ? { ...m, round: 4, label: '결승 진출전' }
                : m
        );
        updateLeague(league.id, { matches: newMatches });
        setLeague(prev => ({ ...prev, matches: newMatches }));
        alert("👑 플레이오프 결승 진출전이 생성되었습니다!");
        return;
    }

    // Grand final: any round-5 match that is NOT the qualifier
    const r4Match = currentMatches.find(isQualifier);
    const finalExists = currentMatches.some(
        m => m.type === 'playoff' && m.round === 5 && !String(m.label || '').includes('진출')
    );

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

    // ── [FOREIGN] Bracket advancement (no-refresh) ──────────────────────────
    // ScheduleTab can advance foreign playoff brackets when that tab is open,
    // but the Dashboard "next match" needs the bracket to advance immediately
    // after a match finishes (otherwise the next round appears only after refresh).
    const advanceForeignBracketIfNeeded = (leagueObj, leagueName) => {
      if (!leagueObj || !leagueName) return { league: leagueObj, didUpdate: false };
      if (leagueName !== 'LEC') return { league: leagueObj, didUpdate: false };

      const lecTeams = FOREIGN_LEAGUES['LEC'] || [];
      const lecSeeds = leagueObj.foreignPlayoffSeeds?.LEC || [];
      const matches = [...(leagueObj.foreignMatches?.[leagueName] || [])];
      if (matches.length === 0) return { league: leagueObj, didUpdate: false };

      const findM = (id) => matches.find(m => m.id === id);
      const resolveName = (token) => {
        if (!token || token === 'TBD' || token === 'null' || token === 'undefined') return null;
        const t = lecTeams.find(x => x.name === token || x.id === token);
        return t?.name || String(token);
      };
      const getWinner = (m) => (m && m.status === 'finished' && m.result?.winner) ? resolveName(m.result.winner) : null;
      const getLoser = (m) => {
        if (!m || m.status !== 'finished' || !m.result?.winner) return null;
        const w = resolveName(m.result.winner);
        const t1 = resolveName(m.t1);
        const t2 = resolveName(m.t2);
        if (!w || !t1 || !t2) return null;
        if (w === t1) return t2;
        if (w === t2) return t1;
        return null;
      };
      const needsTeam = (token) => !token || String(token) === 'TBD' || String(token) === 'null' || String(token) === 'undefined';
      const getSeedNum = (token) => {
        if (!token) return null;
        const s = String(token).trim().toUpperCase();
        const found = lecSeeds.find(x => {
          const id = (x.id != null) ? String(x.id).trim().toUpperCase() : '';
          const nm = (x.name != null) ? String(x.name).trim().toUpperCase() : '';
          return id === s || nm === s;
        });
        return found?.seed ?? null;
      };
      const orderBySeed = (aTok, bTok) => {
        const aS = getSeedNum(aTok);
        const bS = getSeedNum(bTok);
        if (aS == null || bS == null) return [aTok, bTok];
        // smaller seed number = higher seed -> blue side (t1)
        return aS <= bS ? [aTok, bTok] : [bTok, aTok];
      };
      const assignTeam = (m, t1, t2) => {
        if (!m) return false;
        let changed = false;
        if (needsTeam(m.t1) && t1) { m.t1 = t1; changed = true; }
        if (needsTeam(m.t2) && t2) { m.t2 = t2; changed = true; }

        // Once both teams exist, enforce higher seed = t1 (blue side)
        if (!needsTeam(m.t1) && !needsTeam(m.t2)) {
          const [blue, red] = orderBySeed(m.t1, m.t2);
          if (blue !== m.t1 || red !== m.t2) {
            m.t1 = blue;
            m.t2 = red;
            changed = true;
          }
          if (blue && m.blueSidePriority !== blue) {
            m.blueSidePriority = blue;
            changed = true;
          }
        }
        return changed;
      };

      let changed = false;
      const ub1g1 = findM('lec_po_ub1g1');
      const ub1g2 = findM('lec_po_ub1g2');
      const ub1g3 = findM('lec_po_ub1g3');
      const ub1g4 = findM('lec_po_ub1g4');
      const ub2g1 = findM('lec_po_ub2g1');
      const ub2g2 = findM('lec_po_ub2g2');
      const lb1g1 = findM('lec_po_lb1g1');
      const lb1g2 = findM('lec_po_lb1g2');
      const lb2g1 = findM('lec_po_lb2g1');
      const lb2g2 = findM('lec_po_lb2g2');
      const ubf = findM('lec_po_ubf');
      const lbsf = findM('lec_po_lbsf');
      const r4 = findM('lec_po_r4');
      const finalM = findM('lec_po_final');

      // Upper/Lower round 2 + LB1 from UB1 results
      changed = assignTeam(ub2g1, getWinner(ub1g1), getWinner(ub1g4)) || changed;
      changed = assignTeam(ub2g2, getWinner(ub1g2), getWinner(ub1g3)) || changed;
      changed = assignTeam(lb1g1, getLoser(ub1g1), getLoser(ub1g4)) || changed;
      changed = assignTeam(lb1g2, getLoser(ub1g2), getLoser(ub1g3)) || changed;

      // LB2 from LB1 winners + UB2 losers
      changed = assignTeam(lb2g1, getWinner(lb1g1), getLoser(ub2g2)) || changed;
      changed = assignTeam(lb2g2, getWinner(lb1g2), getLoser(ub2g1)) || changed;

      // UBF / LBSF
      changed = assignTeam(ubf, getWinner(ub2g1), getWinner(ub2g2)) || changed;
      changed = assignTeam(lbsf, getWinner(lb2g1), getWinner(lb2g2)) || changed;

      // R4 and Final
      changed = assignTeam(r4, getWinner(lbsf), getLoser(ubf)) || changed;
      changed = assignTeam(finalM, getWinner(r4), getWinner(ubf)) || changed;

      if (!changed) return { league: leagueObj, didUpdate: false };

      const updatedLeague = {
        ...leagueObj,
        foreignMatches: { ...(leagueObj.foreignMatches || {}), [leagueName]: matches }
      };
      return { league: updatedLeague, didUpdate: true };
    };
    
  // ── [LCS] Generate & advance playoff bracket without needing ScheduleTab ───
  // Called after every LCS match finishes. Generates the playoff bracket when
  // all swiss matches are done, then propagates winners/losers into TBD slots.
  const advanceLCSPlayoffBracket = (foreignMatches) => {
    const lgTeams = FOREIGN_LEAGUES['LCS'] || [];
    const isTBD = (v) => !v || String(v) === 'TBD' || String(v) === 'null' || String(v) === 'undefined';

    const regularMatches = foreignMatches.filter(m => m.type === 'regular' || m.type === 'super');
    const allRegularDone = regularMatches.length > 0 && regularMatches.every(m => m.status === 'finished');
    if (!allRegularDone) return { matches: foreignMatches, seeds: null, changed: false };

    // Build standings
    const standings = {};
    lgTeams.forEach(t => { standings[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], name: t.name }; });
    regularMatches.forEach(m => {
      if (!m.result?.winner) return;
      const wName = lgTeams.find(t => t.name === m.result.winner || t.id === m.result.winner)?.name || m.result.winner;
      const t1Name = lgTeams.find(t => t.name === m.t1 || t.id === m.t1)?.name || m.t1;
      const t2Name = lgTeams.find(t => t.name === m.t2 || t.id === m.t2)?.name || m.t2;
      const lName = wName === t1Name ? t2Name : t1Name;
      let diff = 0;
      if (m.result.score) {
        const parts = String(m.result.score).split(/[-:]/).map(Number);
        if (parts.length === 2) diff = Math.abs(parts[0] - parts[1]);
      }
      if (standings[wName]) { standings[wName].w++; standings[wName].diff += diff; standings[wName].defeatedOpponents.push(lName); if (!standings[wName].h2h[lName]) standings[wName].h2h[lName] = { w: 0, l: 0 }; standings[wName].h2h[lName].w++; }
      if (standings[lName]) { standings[lName].l++; standings[lName].diff -= diff; if (!standings[lName].h2h[wName]) standings[lName].h2h[wName] = { w: 0, l: 0 }; standings[lName].h2h[wName].l++; }
    });
    const sorted = Object.values(standings).sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      const aWvsB = a.h2h[b.name]?.w || 0, bWvsA = b.h2h[a.name]?.w || 0;
      if (aWvsB !== bWvsA) return bWvsA - aWvsB;
      return 0;
    });
    const seeds = sorted.slice(0, 8).map((t, i) => ({ ...t, seed: i + 1 }));
    const getSeedName = (s) => seeds.find(x => x.seed === s)?.name || null;

    // Generate playoff bracket if it doesn't exist yet
    let playoffs = foreignMatches.filter(m => m.type === 'playoff' || m.type === 'playin');
    let changed = false;
    if (playoffs.length === 0) {
      playoffs = generateLCSPlayoffs(seeds);
      changed = true;
    }

    // Work on mutable copies
    playoffs = playoffs.map(m => ({ ...m }));

    const findM = (id) => playoffs.find(m => m.id === id);
    const getWinner = (m) => {
      if (!m || m.status !== 'finished' || !m.result?.winner) return null;
      return lgTeams.find(t => t.name === m.result.winner || t.id === m.result.winner)?.name || m.result.winner;
    };
    const getLoser = (m) => {
      if (!m || m.status !== 'finished') return null;
      const w = getWinner(m);
      const t1 = lgTeams.find(t => t.name === m.t1 || t.id === m.t1)?.name || m.t1;
      const t2 = lgTeams.find(t => t.name === m.t2 || t.id === m.t2)?.name || m.t2;
      return w === t1 ? t2 : t1;
    };
    const assign = (m, t1, t2) => {
      if (!m) return;
      if (isTBD(m.t1) && t1) { m.t1 = t1; changed = true; }
      if (isTBD(m.t2) && t2) { m.t2 = t2; changed = true; }
    };
    const assignT1 = (m, v) => { if (m && isTBD(m.t1) && v) { m.t1 = v; changed = true; } };
    const assignT2 = (m, v) => { if (m && isTBD(m.t2) && v) { m.t2 = v; changed = true; } };

    // Play-in
    const pi1M = findM('lcs_pi1');
    assignT1(pi1M, getSeedName(6)); assignT2(pi1M, getSeedName(7));
    const pi1W = getWinner(pi1M);

    // Upper bracket R1 — seed1 picks opponent from 3/4 (90% picks seed4)
    const po1M = findM('lcs_po1'); const po2M = findM('lcs_po2');
    assignT1(po1M, getSeedName(1)); assignT1(po2M, getSeedName(2));
    if (po1M && isTBD(po1M.t2) && getSeedName(3) && getSeedName(4)) {
      const picks4 = Math.random() < 0.90;
      po1M.t2 = picks4 ? getSeedName(4) : getSeedName(3);
      if (po2M && isTBD(po2M.t2)) po2M.t2 = picks4 ? getSeedName(3) : getSeedName(4);
      changed = true;
    }
    const po1W = getWinner(po1M), po1L = getLoser(po1M);
    const po2W = getWinner(po2M), po2L = getLoser(po2M);

    // UB Final (po3)
    const po3M = findM('lcs_po3');
    assign(po3M, po1W, po2W);
    const po3W = getWinner(po3M), po3L = getLoser(po3M);

    // LB R1 (po4): seed5 vs po1 loser
    const po4M = findM('lcs_po4');
    assignT1(po4M, getSeedName(5)); assignT2(po4M, po1L);
    const po4W = getWinner(po4M);

    // LB R1 (po5): pi1 winner vs po2 loser
    const po5M = findM('lcs_po5');
    assign(po5M, pi1W, po2L);
    const po5W = getWinner(po5M);

    // LB R2 (po6)
    const po6M = findM('lcs_po6');
    assign(po6M, po4W, po5W);
    const po6W = getWinner(po6M);

    // LB Final (po7): po3 loser vs po6 winner
    const po7M = findM('lcs_po7');
    assign(po7M, po3L, po6W);
    const po7W = getWinner(po7M);

    // Grand Final (po8)
    const po8M = findM('lcs_po8');
    assign(po8M, po3W, po7W);

    return {
      matches: [...regularMatches, ...playoffs],
      seeds,
      changed,
    };
  };

  // ── [LCS] Fill in Swiss round 2/3 team slots immediately after each match ──
  // Mirrors the same logic in ScheduleTab so the dashboard doesn't need a tab
  // visit to discover the next match.
  const advanceLCSSwissRounds = (matches, lgTeams) => {
    const isTBD = (v) => !v || String(v) === 'TBD' || String(v) === 'null' || String(v) === 'undefined';
    const resolveName = (token) => lgTeams.find(t => t.name === token || t.id === token)?.name || token;

    const getSwissStandings = (pastMatches) => {
      const st = {};
      lgTeams.forEach(t => { st[t.name] = { w: 0, l: 0, played: [] }; });
      pastMatches.forEach(m => {
        if (m.status !== 'finished' || !m.result?.winner) return;
        const wName = resolveName(m.result.winner);
        const t1Name = resolveName(m.t1);
        const t2Name = resolveName(m.t2);
        const lName = wName === t1Name ? t2Name : t1Name;
        if (st[wName]) { st[wName].w++; st[wName].played.push(lName); }
        if (st[lName]) { st[lName].l++; st[lName].played.push(wName); }
      });
      return st;
    };

    // Work on a mutable copy
    const updated = matches.map(m => ({ ...m }));
    let changed = false;

    [2, 3].forEach(roundNum => {
      const roundMatches = updated.filter(m => m.swissRound === roundNum);
      if (!roundMatches.some(m => isTBD(m.t1) || isTBD(m.t2))) return;

      const prevDone = updated
        .filter(m => m.swissRound === roundNum - 1)
        .every(m => m.status === 'finished');
      if (!prevDone) return;

      const pastMatches = updated.filter(m => m.swissRound < roundNum && m.status === 'finished');
      const st = getSwissStandings(pastMatches);

      // Build bracket pools (e.g. "1-0", "0-1") 
      const pools = {};
      Object.entries(st).forEach(([tName, rec]) => {
        const key = `${rec.w}-${rec.l}`;
        if (!pools[key]) pools[key] = [];
        pools[key].push(tName);
      });

      roundMatches.forEach(m => {
        if (!isTBD(m.t1) && !isTBD(m.t2)) return;
        let pool = [...new Set(pools[m.bracket] || [])];
        if (pool.length >= 2) {
          pool = pool.sort(() => Math.random() - 0.5);
          let t1 = pool[0];
          let t2Index = pool.findIndex((t, idx) => idx > 0 && !(st[t1]?.played || []).includes(t));
          if (t2Index <= 0) t2Index = 1;
          let t2 = pool[t2Index];
          if (t1 === t2) t2 = pool.find(t => t !== t1) || lgTeams.find(t => t.name !== t1)?.name;
          m.t1 = t1;
          m.t2 = t2;
          pools[m.bracket] = pool.filter(t => t !== t1 && t !== t2);
          changed = true;
        } else {
          // Fallback: assign any unassigned teams
          const assigned = roundMatches.flatMap(rm => [rm.t1, rm.t2]).filter(x => !isTBD(x));
          const remaining = lgTeams.map(t => t.name).filter(t => !assigned.includes(t));
          if (remaining.length >= 2) {
            m.t1 = remaining[0];
            m.t2 = remaining[1];
            changed = true;
          }
        }
      });
    });

    return { matches: updated, changed };
  };

  const handleProceedNextMatch = () => {
    try {
      if (!nextGlobalMatch) return;

      // For foreign leagues — just auto-sim the CPU match into foreignMatches
      if (isMyLeagueForeign) {
        const foreignTeamsList = FOREIGN_LEAGUES[myLeague] || [];
        const allForeignPlayers = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);

        const resolveTeam = (token) => {
          const t = foreignTeamsList.find(x => x.name === token || x.id === token);
          return t ? { ...t, colors: { primary: TEAM_COLORS[t.name] || TEAM_COLORS['DEFAULT'], secondary: '#fff' } } : null;
        };
        const resolveRoster = (teamName) => {
          const r = allForeignPlayers.filter(p => p.팀 === teamName || p.team === teamName);
          return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => {
            const p = r.find(p => String(p.포지션 || p.role).toUpperCase() === role);
            if (p) return { ...p, 이름: p.이름 || p.playerName || `${teamName} ${role}`, 종합: p.종합 || p.ovr || 80 };
            return { 이름: `${teamName} ${role}`, 포지션: role, 종합: 80, 팀: teamName };
          });
        };

        const t1Obj = resolveTeam(nextGlobalMatch.t1);
        const t2Obj = resolveTeam(nextGlobalMatch.t2);
        if (!t1Obj || !t2Obj) { 
            alert(`팀 데이터 오류: T1=${nextGlobalMatch.t1}, T2=${nextGlobalMatch.t2}\n대진표가 아직 완성되지 않았습니다.`); 
            return; 
        }

        const result = quickSimulateMatch(
          { ...t1Obj, roster: resolveRoster(t1Obj.name) },
          { ...t2Obj, roster: resolveRoster(t2Obj.name) },
          nextGlobalMatch.format || 'BO3'
        );

        // Normalize score for BO1 — quickSimulateMatch may return '2-0' even for BO1
        let resultScore = result.scoreString || result.score || '2-0';
        if (nextGlobalMatch.format === 'BO1') resultScore = '1-0';

        let updatedForeignMatches = (league.foreignMatches?.[myLeague] || []).map(m =>
          m.id === nextGlobalMatch.id
            ? { ...m, status: 'finished', result: { winner: result.winner, score: resultScore, history: result.history } }
            : m
        );

        // LCS Swiss: fill in round 2/3 team slots as soon as the previous round finishes
        let lcsPoSeeds = null;
        if (myLeague === 'LCS') {
          const lgTeams = FOREIGN_LEAGUES['LCS'] || [];
          const { matches: swissAdvanced, changed } = advanceLCSSwissRounds(updatedForeignMatches, lgTeams);
          if (changed) updatedForeignMatches = swissAdvanced;

          // LCS Playoffs: generate bracket + advance team slots as soon as swiss is done
          const { matches: poAdvanced, seeds: poSeeds, changed: poChanged } = advanceLCSPlayoffBracket(updatedForeignMatches);
          if (poChanged) {
            updatedForeignMatches = poAdvanced;
            lcsPoSeeds = poSeeds;
          }
        }

        const baseLeague = {
          ...league,
          foreignMatches: { ...league.foreignMatches, [myLeague]: updatedForeignMatches },
          ...(lcsPoSeeds ? { foreignPlayoffSeeds: { ...(league.foreignPlayoffSeeds || {}), LCS: lcsPoSeeds } } : {}),
        };
        const advanced = advanceForeignBracketIfNeeded(baseLeague, myLeague);
        const updatedLeague = advanced.league;
        updateLeague(league.id, updatedLeague);
        setLeague(updatedLeague);
        recalculateStandings(updatedLeague);
        return;
      }

      // ── LCK path ─────────────────────────────────────────────────────────
      const getID = (val) => (val && typeof val === 'object' && val.id) ? val.id : val;
      const myId = String(myTeam.id);
      
      const isPlayerMatch =
        String(getID(nextGlobalMatch.t1)) === myId ||
        String(getID(nextGlobalMatch.t2)) === myId;
  
      if (!isPlayerMatch) {
        const result = runSimulationForMatch(nextGlobalMatch, false);
        if (!result) throw new Error("Simulation returned null");
  
        let scoreStr = "2:0"; 
        if (result.scoreString) scoreStr = result.scoreString;
        else if (result.score) { const values = Object.values(result.score); if (values.length >= 2) scoreStr = `${values[0]}:${values[1]}`; }
  
        const finalResult = { winner: result.winnerName, score: scoreStr, history: result.history };
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
  
    // [FIX] Robust Start Match Handler - supports both LCK and foreign leagues
    const handleStartMyMatch = (mode = 'auto') => {
      try {
        if (!nextGlobalMatch) { alert("진행할 경기가 없습니다."); return; }

        let t1Obj, t2Obj, t1Roster, t2Roster;

        if (isMyLeagueForeign) {
          // ── Foreign: team tokens are name strings ──────────────────────────
          const foreignTeamsList = FOREIGN_LEAGUES[myLeague] || [];
          const allForeignPlayers = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);

          const resolveTeam = (token) => {
            const t = foreignTeamsList.find(x => x.name === token || x.id === token);
            return t ? { ...t, colors: { primary: TEAM_COLORS[t.name] || TEAM_COLORS['DEFAULT'], secondary: '#fff' } } : null;
          };
          const resolveRoster = (teamName) => {
            const r = allForeignPlayers.filter(p => p.팀 === teamName || p.team === teamName);
            return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => {
              const p = r.find(p => String(p.포지션 || p.role).toUpperCase() === role);
              if (p) return { ...p, 이름: p.이름 || p.playerName || `${teamName} ${role}`, 종합: p.종합 || p.ovr || 80 };
              return { 이름: `${teamName} ${role}`, 포지션: role, 종합: 80, 팀: teamName };
            });
          };

          t1Obj = resolveTeam(nextGlobalMatch.t1);
          t2Obj = resolveTeam(nextGlobalMatch.t2);
          if (!t1Obj || !t2Obj) {
            alert(`팀 데이터 오류! T1: ${nextGlobalMatch.t1}, T2: ${nextGlobalMatch.t2}`);
            return;
          }
          t1Roster = resolveRoster(t1Obj.name);
          t2Roster = resolveRoster(t2Obj.name);

        } else {
          // ── LCK: numeric IDs ───────────────────────────────────────────────
          const t1Id = typeof nextGlobalMatch.t1 === 'object' ? nextGlobalMatch.t1.id : Number(nextGlobalMatch.t1);
          const t2Id = typeof nextGlobalMatch.t2 === 'object' ? nextGlobalMatch.t2.id : Number(nextGlobalMatch.t2);
          t1Obj = teams.find(t => Number(t.id) === t1Id);
          t2Obj = teams.find(t => Number(t.id) === t2Id);
          if (!t1Obj || !t2Obj) { alert(`팀 데이터 오류! T1 ID: ${t1Id}, T2 ID: ${t2Id}`); return; }
          t1Roster = getFullTeamRoster(t1Obj.name);
          t2Roster = getFullTeamRoster(t2Obj.name);
        }

        const safeChampionList = (league.currentChampionList && league.currentChampionList.length > 0)
          ? league.currentChampionList : championList;

        setLiveMatchData({
          match: { ...nextGlobalMatch, blueSidePriority: t1Obj.id || t1Obj.name },
          teamA: { ...t1Obj, roster: t1Roster },
          teamB: { ...t2Obj, roster: t2Roster },
          safeChampionList,
          isManualMode: mode === 'manual'
        });
        setIsLiveGameMode(true);

      } catch (error) {
        console.error("경기 시작 오류:", error);
        alert(`경기 시작 실패: ${error.message}`);
      }
    };
  
    const handleLiveMatchComplete = (match, resultData) => {
      // [FIX] Normalize qualifier round — BracketManager sometimes stores
      // 결승 진출전 as round:5 with a '진출' label. Normalise to round:4
      // so the result modal doesn't display "Finals MVP" for that match.
      const normalizedMatch = (
        match.type === 'playoff' &&
        match.round === 5 &&
        String(match.label || '').includes('진출')
      ) ? { ...match, round: 4, label: '결승 진출전' } : match;

      const result = {
        winner: resultData.winner,
        score: resultData.scoreString,
        history: resultData.history,
        posPlayer: resultData.posPlayer
      };

      let updatedLeague;

      if (isMyLeagueForeign) {
        // ── Save to foreignMatches[myLeague] ──────────────────────────────
        let updatedForeignMatches = (league.foreignMatches?.[myLeague] || []).map(m =>
          m.id === normalizedMatch.id ? { ...m, status: 'finished', result } : m
        );

        // LCS Swiss: fill in round 2/3 team slots immediately after each match
        let lcsPoSeeds = null;
        if (myLeague === 'LCS') {
          const lgTeams = FOREIGN_LEAGUES['LCS'] || [];
          const { matches: swissAdvanced, changed } = advanceLCSSwissRounds(updatedForeignMatches, lgTeams);
          if (changed) updatedForeignMatches = swissAdvanced;

          // LCS Playoffs: generate bracket + advance team slots as soon as swiss is done
          const { matches: poAdvanced, seeds: poSeeds, changed: poChanged } = advanceLCSPlayoffBracket(updatedForeignMatches);
          if (poChanged) {
            updatedForeignMatches = poAdvanced;
            lcsPoSeeds = poSeeds;
          }
        }

        const baseLeague = {
          ...league,
          foreignMatches: { ...league.foreignMatches, [myLeague]: updatedForeignMatches },
          ...(lcsPoSeeds ? { foreignPlayoffSeeds: { ...(league.foreignPlayoffSeeds || {}), LCS: lcsPoSeeds } } : {}),
        };
        updatedLeague = advanceForeignBracketIfNeeded(baseLeague, myLeague).league;
      } else {
        // ── Save to league.matches (LCK) ──────────────────────────────────
        // Store the normalised match (round:4 qualifier fix applied above)
        const updatedMatches = (league.matches || []).map(m =>
          m.id === normalizedMatch.id
            ? { ...m, ...normalizedMatch, status: 'finished', result }
            : m
        );
        updatedLeague = { ...league, matches: updatedMatches };
      }

      // [FIX] Commit state FIRST, then generate next rounds.
      // Calling checkAndGenerate* before setLeague caused them to call
      // setLeague(prev=>{...}) which was immediately overwritten by the
      // setLeague(updatedLeague) below — making the next round disappear
      // from state until a manual refresh.
      updateLeague(league.id, updatedLeague);
      setLeague(updatedLeague);
      recalculateStandings(updatedLeague);
      setIsLiveGameMode(false);
      setLiveMatchData(null);

      // Generate next LCK bracket round only after state is committed
      if (!isMyLeagueForeign) {
        checkAndGenerateNextPlayInRound(updatedLeague.matches);
        checkAndGenerateNextPlayoffRound(updatedLeague.matches);
      }

      setTimeout(() => alert(`경기 종료! 승리: ${resultData.winner}`), 100);
    };
  
    // ── [FOREIGN] Generate the user's own league regular season schedule ────────
    const handleStartForeignSeason = () => {
      try {
        const lgTeams = FOREIGN_LEAGUES[myLeague] || [];
        
        if (!lgTeams || lgTeams.length === 0) {
          alert(`❌ ${myLeague} 팀 데이터를 찾을 수 없습니다.\nFOREIGN_LEAGUES 설정을 확인하세요.`);
          return;
        }
    
        let schedule = [];
        if (myLeague === 'LPL')        schedule = generateLPLRegularSchedule(lgTeams);
        else if (myLeague === 'LEC')   schedule = generateLECRegularSchedule(lgTeams);
        else if (myLeague === 'LCS')   schedule = generateLCSRegularSchedule(lgTeams);
        else if (myLeague === 'LCP')   schedule = generateLCPRegularSchedule(lgTeams);
        else if (myLeague === 'CBLOL') schedule = generateCBLOLRegularSchedule(lgTeams);
    
        if (schedule.length === 0) { 
          alert('일정 생성 실패: 팀 데이터를 찾을 수 없습니다.'); 
          console.error('Generated schedule is empty for', myLeague);
          return; 
        }
    
        console.log(`✅ ${myLeague} 일정 생성 완료: ${schedule.length}개 경기`);
        console.log('First match:', schedule[0]);
    
        const existingForeignMatches = league.foreignMatches || { 
          LPL: [], 
          LEC: [], 
          LCS: [], 
          LCP: [], 
          CBLOL: [] 
        };
        
        const updates = { 
          foreignMatches: { 
            ...existingForeignMatches, 
            [myLeague]: schedule 
          } 
        };
        
        updateLeague(league.id, updates);
        setLeague(prev => ({ ...prev, ...updates }));
        alert(`✅ ${myLeague} 시즌 시작! ${schedule.length}개 경기 생성됨`);
    
      } catch (error) {
        console.error('handleStartForeignSeason error:', error);
        alert(`❌ 시즌 시작 오류:\n${error.message}`);
      }
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
  
    const finalizeDraft = async (groups) => {
      const matches = generateSchedule(groups.baron, groups.elder);
      const updated = await updateLeague(league.id, { groups, matches });
      if (updated) {
        const newLeague = { ...league, groups, matches };
        setLeague(newLeague);
        recalculateStandings(newLeague);
        setIsDrafting(false);
        setActiveTab('standings');
        alert("팀 구성 및 일정이 완료되었습니다!");
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
      { id: 'history', name: '역대 기록', icon: '📜' },
      ...(hasFST ? [{ id: 'fst', name: 'FST 토너먼트', icon: '🌍' }] : []),
    ];
    
    const myRecord = (() => {
      if (!isMyLeagueForeign) return computedStandings[myTeam.id] || { w: 0, l: 0, diff: 0 };
      // For foreign: compute W/L from their league's finished matches
      const fMatches = (league.foreignMatches?.[myLeague] || [])
        .filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
      let w = 0, l = 0;
      fMatches.forEach(m => {
        const involved = m.t1 === myTeam.name || m.t2 === myTeam.name || m.t1 === myTeam.id || m.t2 === myTeam.id;
        if (!involved || !m.result?.winner) return;
        if (m.result.winner === myTeam.name) w++; else l++;
      });
      return { w, l, diff: w - l };
    })();
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

    // ── FST Tournament ────────────────────────────────────────

    const handleCreateFST = () => {
      if (!isSeasonOver || hasFST) return;

      // 1. Build FST bracket from all league results
      const fstData = initFSTTournament(league);
      if (!fstData) {
        alert('⚠️ FST 토너먼트를 생성하려면 모든 리그가 완료되어야 합니다.\n(LCK, LPL, LEC, LCS, LCP, CBLOL)');
        return;
      }

      // 2. Apply 16.03 meta patch (same pattern as 16.02)
      const sourceList = (league.currentChampionList && league.currentChampionList.length > 0)
          ? league.currentChampionList : championList;
      const newChampionList = updateChampionMeta(sourceList);

      // 3. Save everything
      const updates = {
        fst: fstData,
        currentChampionList: newChampionList,
        metaVersion: '16.03',
      };
      setLeague(prev => ({ ...prev, ...updates }));
      updateLeague(league.id, updates);
      setActiveTab('fst');
      alert('🌍 FST 월드 토너먼트가 개막되었습니다!\n패치 16.03 메타가 적용되었습니다.');
    };

    // ── LCK 정규 시즌 스플릿 1 ────────────────────────────────────────────────
    // Available after FST ends. Works even for saves that finished FST before this
    // feature was added — hasLCKSplit1 will be false on those saves, so the button
    // appears automatically the next time the player loads the dashboard.
    const handleCreateLCKSplit1 = () => {
      if (hasLCKSplit1) return;

      try {
        // generateLCKSplit1Schedule expects objects with at least { id, name }
        const rawMatches = generateLCKSplit1Schedule(teams);

        // Override type so existing season logic (isRegularSeasonFinished, meta-patch
        // triggers, play-in guards, etc.) never misidentify these as LCK CUP matches.
        const split1Matches = rawMatches.map(m => ({
          ...m,
          type: 'lck_split1_regular',
        }));

        const updatedMatches = [...(league.matches || []), ...split1Matches];
        const updates = { matches: updatedMatches };
        setLeague(prev => ({ ...prev, ...updates }));
        updateLeague(league.id, updates);
        setActiveTab('schedule');
        alert(`🏆 LCK 정규 시즌 스플릿 1 개막!\n${split1Matches.length}개 경기 생성됨 (4/1 ~ 5/31)`);
      } catch (err) {
        console.error('[LCK Split 1] 일정 생성 오류:', err);
        alert(`❌ 스플릿 1 일정 생성 실패:\n${err.message}`);
      }
    };
    // ── LCK 스플릿 1 재편성 ──────────────────────────────────────────────────
    // Strips all existing lck_split1_regular matches (pending only — finished ones
    // are kept so in-progress seasons aren't broken) and regenerates from scratch.
    const handleRescheduleLCKSplit1 = () => {
      try {
        const existingMatches = league.matches || [];
        const finishedSplit1 = existingMatches.filter(
          m => m.type === 'lck_split1_regular' && m.status === 'finished'
        );
        if (finishedSplit1.length > 0) {
          alert(`❌ 이미 ${finishedSplit1.length}개 경기가 진행됐습니다. 재편성은 경기 시작 전에만 가능합니다.`);
          return;
        }

        // Remove ALL split1 matches (all are pending at this point)
        const otherMatches = existingMatches.filter(m => m.type !== 'lck_split1_regular');

        // Generate a fresh schedule
        const rawMatches = rescheduleLCKSplit1(teams);
        const split1Matches = rawMatches.map(m => ({
          ...m,
          type: 'lck_split1_regular',
        }));

        const updatedMatches = [...otherMatches, ...split1Matches];
        const updates = { matches: updatedMatches };
        setLeague(prev => ({ ...prev, ...updates }));
        updateLeague(league.id, updates);
        setActiveTab('schedule');
        alert(`🔄 스플릿 1 일정 재편성 완료!\n${split1Matches.length}개 경기 새로 생성됨 (4/1 ~ 5/31)`);
      } catch (err) {
        console.error('[LCK Split 1] 재편성 오류:', err);
        alert(`❌ 재편성 실패:\n${err.message}`);
      }
    };

    const checkAndAdvanceFST = (updatedFstMatches, fstTeams) => {
      let current = [...updatedFstMatches];

      // Group A wave progression
      current = createFSTGroupWave2A(current, fstTeams);
      current = createFSTGroupWave3A(current, fstTeams);

      // Group B wave progression
      current = createFSTGroupWave2B(current, fstTeams);
      current = createFSTGroupWave3B(current, fstTeams);

      // Playoffs + Finals (only when both group elimination matches are done)
      current = createFSTPlayoffs(current, fstTeams);
      current = createFSTFinals(current, fstTeams);

      return current;
    };

    // ── FST: Reset tournament data ────────────────────────────
    const handleFSTReset = () => {
      if (!window.confirm('FST 데이터를 초기화하시겠습니까?\n이전 결과가 모두 삭제되고 다시 생성할 수 있습니다.')) return;
      // Switch tab FIRST so FSTTournamentTab is unmounted before fst becomes null
      setActiveTab('dashboard');
      // Use setTimeout to let the tab switch render first, then clear fst
      setTimeout(() => {
        const updates = { fst: null };
        setLeague(prev => ({ ...prev, ...updates }));
        updateLeague(league.id, updates);
      }, 50);
    };

    // ── FST: Build team with real roster for simulation ───────
    const buildFSTTeamWithRoster = (fstTeam) => {
      const lgName   = fstTeam.league;
      const teamName = fstTeam.name;
      if (lgName === 'LCK') {
        return { ...fstTeam, roster: getFullTeamRoster(teamName) };
      }
      const lgPlayers = (FOREIGN_PLAYERS && FOREIGN_PLAYERS[lgName]) ? FOREIGN_PLAYERS[lgName] : [];
      const requiredRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
      const roster = requiredRoles.map(role => {
        const p = lgPlayers.find(p =>
          (p.팀 === teamName || p.team === teamName) &&
          String(p.포지션 || p.role).toUpperCase() === role
        );
        if (p) return {
          ...p,
          이름: p.이름 || p.playerName || `${teamName} ${role}`,
          playerName: p.playerName || p.이름 || `${teamName} ${role}`,
          종합: p.종합 || p.ovr || fstTeam.power || 80,
          상세: p.상세 || { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
          playerData: p.playerData || { 팀: teamName, 포지션: role },
        };
        return {
          이름: `${teamName} ${role}`, playerName: `${teamName} ${role}`,
          포지션: role, 종합: fstTeam.power || 80,
          상세: { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
          playerData: { 팀: teamName, 포지션: role },
        };
      });
      return { ...fstTeam, roster };
    };

    // ── FST: Apply a finished result and advance the bracket ──
    const applyFSTResult = (matchId, result) => {
      const fstTeams = league.fst.teams;
      const updatedMatches = league.fst.matches.map(m =>
        m.id === matchId ? { ...m, status: 'finished', result } : m
      );
      const advancedMatches = checkAndAdvanceFST(updatedMatches, fstTeams);
      const fstFinal = advancedMatches.find(m => m.fstRound === 'Finals');
      const fstDone  = fstFinal?.status === 'finished';
      const updatedFst = {
        ...league.fst,
        matches: advancedMatches,
        status: fstDone ? 'complete' : league.fst.status,
      };
      const updates = { fst: updatedFst };
      setLeague(prev => ({ ...prev, ...updates }));
      updateLeague(league.id, updates);
    };

    const handleFSTSimulate = (match) => {
      if (!league.fst || !match || match.status === 'finished') return;
      const fstTeams = league.fst.teams;
      const t1Fst = fstTeams.find(t => t.fstId === match.t1);
      const t2Fst = fstTeams.find(t => t.fstId === match.t2);
      if (!t1Fst || !t2Fst) return;

      // Player's team is in this FST match → show mode choice modal
      const isPlayerFSTMatch = t1Fst.name === myTeam.name || t2Fst.name === myTeam.name;
      if (isPlayerFSTMatch) {
        setFstMatchPending(match);
        return;
      }

      // CPU vs CPU → quickSimulateMatch with real rosters + 16.03 meta
      const t1 = buildFSTTeamWithRoster(t1Fst);
      const t2 = buildFSTTeamWithRoster(t2Fst);
      const fstChampionList = (league.currentChampionList && league.currentChampionList.length > 0)
        ? league.currentChampionList : championList;

      let result;
      try {
        const sim = quickSimulateMatch(t1, t2, 'BO5', fstChampionList);
        const raw = sim.scoreString || sim.score;
        let scoreStr;
        if (typeof raw === 'object') {
          scoreStr = `${Math.max(raw.A ?? 0, raw.B ?? 0)}-${Math.min(raw.A ?? 0, raw.B ?? 0)}`;
        } else {
          scoreStr = raw || '3-0';
        }
        result = {
          winner:  sim.winner?.name || sim.winner,
          score:   scoreStr,
          history: (sim.history || []).map(s => ({ ...s, logs: [] })),
        };
      } catch (e) {
        console.error('[FST] quickSim error, power fallback:', e);
        const p1 = (t1Fst.power || 80) + (Math.random() * 10 - 5);
        const p2 = (t2Fst.power || 80) + (Math.random() * 10 - 5);
        const winner = p1 >= p2 ? t1Fst : t2Fst;
        const loss = Math.random() < 0.3 ? 0 : Math.random() < 0.55 ? 1 : 2;
        result = { winner: winner.name, score: `3-${loss}`, history: [] };
      }
      applyFSTResult(match.id, result);
    };

    // ── FST: Launch LiveGame with chosen mode ─────────────────
    const launchFSTLiveGame = (match, mode) => {
      const fstTeams = league.fst.teams;
      const t1Fst = fstTeams.find(t => t.fstId === match.t1);
      const t2Fst = fstTeams.find(t => t.fstId === match.t2);
      if (!t1Fst || !t2Fst) return;
      const t1Live = buildFSTTeamWithRoster(t1Fst);
      const t2Live = buildFSTTeamWithRoster(t2Fst);
      const safeChampionList = (league.currentChampionList?.length > 0)
        ? league.currentChampionList : championList;
      setLiveMatchData({
        match:        { ...match, isFSTMatch: true },
        teamA:        t1Live,
        teamB:        t2Live,
        safeChampionList,
        isManualMode: mode === 'manual',
        isFSTMatch:   true,
      });
      setFstMatchPending(null);
      setIsLiveGameMode(true);
    };

    // ── FST: LiveGame completion callback ─────────────────────
    const handleFSTLiveMatchComplete = (match, resultData) => {
      applyFSTResult(match.id, {
        winner:  resultData.winner,
        score:   resultData.scoreString,
        history: resultData.history,
      });
      setIsLiveGameMode(false);
      setLiveMatchData(null);
      setTimeout(() => alert(`🌍 FST 경기 종료! 승리: ${resultData.winner}`), 100);
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

    // Foreign players: LCK regular season finished → require manual meta patch confirmation.
    // Render this prompt in the same spot as the next-match card to prevent skipping it.
    const foreignMetaPending =
      isMyLeagueForeign &&
      isRegularSeasonFinished &&
      league.metaVersion !== '16.02' &&
      league.metaVersion !== '16.03';
    
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

    // LCK 정규 시즌 스플릿 1: matches stored with type 'lck_split1_regular'
    // so existing season-over / super-week / play-in guards (which check type === 'regular')
    // are never accidentally triggered by Split 1 matches.
    const hasLCKSplit1 = !!(league?.matches?.some(m => m.type === 'lck_split1_regular'));
  
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
  
    const parseDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return 0;
      const parts = dateStr.split(' ')[0].split('.');
      if (parts.length < 2) return 0;
      return parseFloat(parts[0]) * 100 + parseFloat(parts[1]);
    };
  
    let effectiveDate;
    if (isSeasonOver && !isMyLeagueForeign) {
      effectiveDate = '시즌 종료';
    } else if (nextGlobalMatch) {
      const matchPool = isMyLeagueForeign ? (league.foreignMatches?.[myLeague] || []) : (league.matches || []);
      const lastFinished = matchPool
        .filter(m => m.status === 'finished')
        .sort((a, b) => parseDate(b.date) - parseDate(a.date))[0];
      effectiveDate = (lastFinished && lastFinished.date !== nextGlobalMatch.date)
        ? lastFinished.date
        : nextGlobalMatch.date;
    } else if (hasDrafted) {
      const matchPool = isMyLeagueForeign ? (league.foreignMatches?.[myLeague] || []) : (league.matches || []);
      const lastMatch = matchPool.filter(m => m.status === 'finished').sort((a,b) => parseDate(b.date) - parseDate(a.date))[0];
      if (isMyLeagueForeign) {
        effectiveDate = lastMatch ? `${lastMatch.date} 이후` : '시즌 진행 중';
      } else {
        if (isPlayInFinished) effectiveDate = "2.9 (월) 이후";
        else if (isSuperWeekFinished) effectiveDate = "2.2 (월) 이후";
        else if (isRegularSeasonFinished) effectiveDate = "1.26 (월) 이후";
        else effectiveDate = lastMatch ? `${lastMatch.date} 이후` : '대진 생성 대기 중';
      }
    } else {
      effectiveDate = '2026 프리시즌';
    }
  
    const getTeamSeed = (teamId, matchType) => {
      const seedData = matchType === 'playin' ? league.playInSeeds : league.playoffSeeds;
      return seedData?.find(s => s.id === teamId)?.seed;
    };
    const formatTeamName = (teamId, matchType) => {
      // 1. Check FST Teams (NEW FIX)
      if ((matchType === 'fst' || league?.fst) && league?.fst?.teams) {
          const fstTeam = league.fst.teams.find(t => t.fstId === teamId || t.name === teamId);
          if (fstTeam) return fstTeam.name;
      }

      const t = teams.find(x => x.id === teamId);
      if (!t) return teamId; // Fallback to raw ID instead of 'TBD' for foreign teams
      
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
        
        {/* Save confirmation toast */}
        {saveMessage && (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900 text-green-400 font-bold text-sm px-6 py-3 rounded-full shadow-2xl border border-green-500 flex items-center gap-2">
        {saveMessage}
    </div>
)}

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
                              key={opp.id || opp.name}
                              onClick={() => opponentChoice.onConfirm(opp)}
                              className="p-3 lg:p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer"
                          >
                              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-sm lg:text-lg" style={{backgroundColor: opp.colors?.primary || '#333'}}>{opp.name}</div>
                              <div className="font-bold text-sm lg:text-lg">{opp.fullName || opp.name}</div>
                              <div className="text-xs bg-gray-100 px-3 py-1 rounded-full font-bold">
                                  {opp._seed
                                      ? `${opp._seed}시드`
                                      : `${getTeamSeed(opp.id, opponentChoice.type.startsWith('playoff') ? 'playoff' : 'playin')} 시드`}
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
        )}

{showFinalStandings && <FinalStandingsModal league={league} myLeague={myLeague} teams={teams} onClose={() => setShowFinalStandings(false)} />}

{/* FST 경기 모드 선택 */}
{fstMatchPending && (() => {
  const fstTeams = league?.fst?.teams || [];
  const t1Fst = fstTeams.find(t => t.fstId === fstMatchPending.t1);
  const t2Fst = fstTeams.find(t => t.fstId === fstMatchPending.t2);
  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 lg:p-10 max-w-md w-full text-center shadow-2xl">
        <div className="text-3xl mb-3">🌍</div>
        <h2 className="text-xl lg:text-2xl font-black mb-1">FST 경기 시작</h2>
        <p className="text-gray-500 text-sm mb-2">{t1Fst?.name} vs {t2Fst?.name}</p>
        <p className="text-gray-600 text-sm mb-6">경기 방식을 선택하세요</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => launchFSTLiveGame(fstMatchPending, 'manual')}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            <span>🎮</span> 직접 경기하기 (MANUAL)
          </button>
          <button
            onClick={() => launchFSTLiveGame(fstMatchPending, 'auto')}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            <span>📺</span> AI 자동 진행 (AUTO)
          </button>
          <button
            onClick={() => setFstMatchPending(null)}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition text-sm"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
})()}
  
{isLiveGameMode && liveMatchData && (
    <LiveGamePlayer 
        match={liveMatchData.match}
        teamA={liveMatchData.teamA}
        teamB={liveMatchData.teamB}
        isManualMode={liveMatchData.isManualMode} 
        simOptions={{
            currentChampionList: liveMatchData.safeChampionList || league.currentChampionList,
            difficulty: league.difficulty,
            playerTeamName: myTeam.name
        }}
        externalGlobalBans={[]} 
        onMatchComplete={liveMatchData.isFSTMatch ? handleFSTLiveMatchComplete : handleLiveMatchComplete}
        onClose={() => { setIsLiveGameMode(false); setLiveMatchData(null); }}
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
             {/* [NEW] Manual Archive Button for Old Saves */}
             {/* [FIX] Button is now always visible when season is over, allowing "Update" */}
             {/* [FIX] Button is now always visible. If saved, it shows as 'Update' */}
{(isSeasonOver || isFSTOver) && (
   <button 
     onClick={handleManualArchive} 
     className={`px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm shadow-md flex items-center gap-2 transition whitespace-nowrap ${
         (isSavedInHistory && (!isFSTOver || isFSTSavedInHistory))
         ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-500' 
         : 'bg-gray-900 text-green-400 hover:bg-black border border-green-500 animate-pulse'
     }`}
   >
       <span>💾</span> 
       <span className="hidden sm:inline">
           {(isSavedInHistory && (!isFSTOver || isFSTSavedInHistory)) ? "시즌 기록 갱신 (Update)" : "시즌 기록 저장"}
       </span>
   </button>
)}

            {isSeasonOver && !hasFST && (
               <button 
               onClick={() => setShowFinalStandings(true)} 
               className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gray-900 hover:bg-black text-yellow-400 shadow-sm flex items-center gap-2 transition border-2 border-yellow-500 animate-pulse whitespace-nowrap"
             >
                 <span>🏆</span> <span className="hidden sm:inline">최종 순위</span>
             </button>
            )}

            {isFSTReady && (
              <button
                onClick={handleCreateFST}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg flex items-center gap-2 animate-pulse transition border border-blue-400 whitespace-nowrap"
              >
                <span>🌍</span> <span className="hidden sm:inline">FST 개막</span>
              </button>
            )}

            {hasFST && (
              <button
                onClick={() => setActiveTab('fst')}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gray-900 hover:bg-black text-blue-300 shadow-sm flex items-center gap-2 transition border border-blue-700 whitespace-nowrap"
              >
                <span>🌍</span> <span className="hidden sm:inline">FST</span>
              </button>
            )}

{hasFSTError && (
              <button
                onClick={handleFSTReset}
                className="px-3 py-1.5 rounded-full font-bold text-xs bg-red-900 hover:bg-red-800 text-white shadow-sm flex items-center gap-1 transition border border-red-700 whitespace-nowrap animate-pulse"
                title="FST 생성 오류 복구"
              >
                <span>⚠️</span> <span className="hidden sm:inline">FST 오류 초기화</span>
              </button>
            )}

            {/* LCK 정규 시즌 스플릿 1: unlocks after FST is over.
                Also visible for existing saves that finished FST before this feature existed
                — isFSTOver will be true, hasLCKSplit1 will be false, so the button appears. */}
            {!isMyLeagueForeign && isFSTOver && !hasLCKSplit1 && (
              <button
                onClick={handleCreateLCKSplit1}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gradient-to-r from-red-700 to-yellow-600 hover:from-red-600 hover:to-yellow-500 text-white shadow-lg flex items-center gap-2 animate-pulse transition border border-yellow-400 whitespace-nowrap"
              >
                <span>🏆</span> <span className="hidden sm:inline">LCK 스플릿 1 개막</span><span className="sm:hidden">스플릿 1</span>
              </button>
            )}

            {/* LCK 스플릿 1 재편성: shown when split1 exists but no matches played yet */}
            {!isMyLeagueForeign && hasLCKSplit1 && !(league?.matches || []).some(m => m.type === 'lck_split1_regular' && m.status === 'finished') && (
              <button
                onClick={handleRescheduleLCKSplit1}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gray-700 hover:bg-gray-600 text-white shadow-sm flex items-center gap-2 transition border border-gray-500 whitespace-nowrap"
              >
                <span>🔄</span> <span className="hidden sm:inline">일정 재편성</span><span className="sm:hidden">재편성</span>
              </button>
            )}

            {/* FST next match: CPU game → ⏩ auto-sim, Player game → 🎮 start */}
            {hasFST && nextFSTMatch && !isMyNextFSTMatch && (
              <button
                onClick={() => handleFSTSimulate(nextFSTMatch)}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-pulse transition whitespace-nowrap"
              >
                <span>⏩</span>
                <span className="hidden sm:inline">
                  FST: {nextFSTMatchT1?.name || '?'} vs {nextFSTMatchT2?.name || '?'}
                </span>
                <span className="sm:hidden">FST 진행</span>
              </button>
            )}

            {hasFST && nextFSTMatch && isMyNextFSTMatch && (
              <button
                onClick={() => setFstMatchPending(nextFSTMatch)}
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white shadow-lg flex items-center gap-2 animate-bounce transition whitespace-nowrap"
              >
                <span>🎮</span>
                <span className="hidden sm:inline">
                  FST 경기: {nextFSTMatchT1?.name || '?'} vs {nextFSTMatchT2?.name || '?'}
                </span>
                <span className="sm:hidden">FST 시작</span>
              </button>
            )}

            {!isMyLeagueForeign && hasDrafted && isRegularSeasonFinished && league.metaVersion !== '16.02' && !hasFST && (
                 <button 
                 onClick={handleGenerateSuperWeek} 
                 className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
               >
                   <span>🔥</span> <span className="hidden sm:inline">슈퍼위크</span>
               </button>
            )}

            {/* LEC players: playoff seed picking button */}
            {lecPlayoffPickNeeded && (
                <button
                    onClick={handleLECPlayoffStart}
                    className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
                >
                    <span>🏆</span> <span className="hidden sm:inline">플레이오프 대진 선택</span>
                </button>
            )}

            {!isMyLeagueForeign && isSuperWeekFinished && !hasPlayInGenerated && (
                <button 
                onClick={handleGeneratePlayIn} 
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
              >
                  <span>🛡️</span> <span className="hidden sm:inline">플레이-인</span>
              </button>
            )} 

            {!isMyLeagueForeign && isPlayInFinished && !hasPlayoffsGenerated && (
                <button 
                onClick={handleGeneratePlayoffs} 
                className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm flex items-center gap-2 animate-bounce transition whitespace-nowrap"
              >
                  <span>👑</span> <span className="hidden sm:inline">PO 대진</span>
              </button>
            )}
            
            {(hasDrafted || isMyLeagueForeign) && nextGlobalMatch && !isMyNextMatch &&
             !foreignMetaPending &&
             !(nextGlobalMatch.type === 'super' && league.metaVersion !== '16.02') && (
                <button 
                  onClick={handleProceedNextMatch} 
                  className="px-3 lg:px-5 py-1.5 rounded-full font-bold text-xs lg:text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-pulse transition whitespace-nowrap"
                >
                    <span>⏩</span> <span className="hidden sm:inline">다음 경기 ({t1?.name} vs {t2?.name})</span><span className="sm:hidden">진행</span>
                </button>
            )}

            {/* Foreign league: show season start button when schedule not yet generated */}
            {isMyLeagueForeign && (league.foreignMatches?.[myLeague] || []).length === 0 && (
                <button
                    onClick={handleStartForeignSeason}
                    className="px-3 lg:px-6 py-1.5 rounded-full font-bold text-xs lg:text-sm shadow-sm transition flex items-center gap-2 whitespace-nowrap bg-green-600 hover:bg-green-700 text-white animate-pulse"
                >
                    <span>▶</span> <span className="hidden sm:inline">{myLeague} 시즌 시작</span><span className="sm:hidden">시작</span>
                </button>
            )}
            {/* LCK draft button — hidden for foreign players */}
            <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-3 lg:px-6 py-1.5 rounded-full font-bold text-xs lg:text-sm shadow-sm transition flex items-center gap-2 whitespace-nowrap ${hasDrafted || isMyLeagueForeign ? 'hidden' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}`}>
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

                     {/* FST match card — shown when FST is active and it's my turn */}
                     {hasFST && nextFSTMatch && isMyNextFSTMatch ? (
                       <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-3 lg:p-6 border border-blue-500">
                         <div className="text-center w-1/3">
                           <div className="text-base lg:text-3xl font-black text-white mb-1 truncate">{nextFSTMatchT1?.name || '?'}</div>
                           <div className="text-[10px] text-blue-300 font-bold">{nextFSTMatchT1?.league}</div>
                         </div>
                         <div className="text-center w-1/3 flex flex-col items-center">
                           <div className="text-xs font-bold text-blue-300 uppercase mb-1">🌍 FST</div>
                           <div className="text-lg lg:text-3xl font-bold text-gray-300 my-1">VS</div>
                           <span className="mt-1 text-[10px] lg:text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm whitespace-nowrap">BO5</span>
                           <div className="flex flex-col gap-2 mt-3 w-full">
                             <button
                               onClick={() => setFstMatchPending(nextFSTMatch)}
                               className="w-full px-2 lg:px-4 py-2 bg-green-500 hover:bg-green-400 text-white font-bold text-xs lg:text-sm rounded-lg shadow-md transition flex items-center justify-center gap-2"
                             >
                               <span>🎮</span> 경기 시작
                             </button>
                           </div>
                         </div>
                         <div className="text-center w-1/3">
                           <div className="text-base lg:text-3xl font-black text-white mb-1 truncate">{nextFSTMatchT2?.name || '?'}</div>
                           <div className="text-[10px] text-blue-300 font-bold">{nextFSTMatchT2?.league}</div>
                         </div>
                       </div>
                     ) : (
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
                              
                              {foreignMetaPending ? (
                                  <div className="flex flex-col gap-2 mt-3 w-full">
                                      <button
                                        onClick={handleForeignMeta1602}
                                        className="w-full px-2 lg:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs lg:text-base rounded-lg shadow-md transform transition hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                                      >
                                          <span>🔥</span> 16.02 메타 확인
                                      </button>
                                      <div className="text-[10px] lg:text-xs text-gray-500 font-bold text-center">
                                          메타 패치를 적용해야 다음 일정이 진행됩니다.
                                      </div>
                                  </div>
                              ) : isMyNextMatch ? (
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
                          ) : <div className="text-xs font-bold text-blue-600">{isSeasonOver ? '시즌 종료' : isMyLeagueForeign ? `▶ ${myLeague} 시즌 시작 버튼을 클릭하세요` : '대진 생성 대기 중'}</div>}
                        </div>
                        <div className="text-center w-1/3">
                            <div className="text-lg lg:text-4xl font-black text-gray-800 mb-2 truncate">{t2 ? t2.name : '?'}</div>
                        </div>
                     </div>
                     )} {/* end FST ternary */}
                  </div>
                  
                  <div className="col-span-1 lg:col-span-4 flex flex-col h-full max-h-[400px] lg:max-h-[500px]">
                     {isMyLeagueForeign ? (
                       // ── Foreign league mini standings ────────────────────
                       <div className="bg-white rounded-lg border shadow-sm p-4 h-full overflow-y-auto flex flex-col">
                         <div className="flex justify-between items-center mb-3">
                           <h3 className="font-bold text-gray-800 text-sm">📊 {myLeague} 순위표</h3>
                           <button onClick={() => setActiveTab('standings')} className="text-xs text-blue-600 hover:underline">전체 보기</button>
                         </div>
                         {(() => {
                           const fMatches = (league.foreignMatches?.[myLeague] || []).filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
                           const lgTeamsList = FOREIGN_LEAGUES[myLeague] || [];
                           const st = {};
                           lgTeamsList.forEach(t => { st[t.name] = { w: 0, l: 0, name: t.name, fullName: t.fullName }; });
                           fMatches.forEach(m => {
                             if (!m.result?.winner) return;
                             const loser = m.result.winner === m.t1 ? m.t2 : m.t1;
                             if (st[m.result.winner]) st[m.result.winner].w++;
                             if (st[loser]) st[loser].l++;
                           });
                           const sorted = Object.values(st).sort((a, b) => b.w - a.w || a.l - b.l);
                           return (
                             <table className="w-full text-xs">
                               <thead className="bg-gray-50 text-gray-400">
                                 <tr><th className="p-1.5 text-center w-6">#</th><th className="p-1.5 text-left">팀</th><th className="p-1.5 text-center w-12">W-L</th></tr>
                               </thead>
                               <tbody>
                                 {sorted.map((t, idx) => {
                                   const isMe = t.name === myTeam.name;
                                   return (
                                     <tr key={t.name} className={`border-b last:border-0 ${isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                       <td className="p-1.5 text-center font-bold text-gray-400">{idx + 1}</td>
                                       <td className={`p-1.5 font-bold truncate ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>{t.fullName || t.name}</td>
                                       <td className="p-1.5 text-center text-gray-600 whitespace-nowrap">{t.w} - {t.l}</td>
                                     </tr>
                                   );
                                 })}
                               </tbody>
                             </table>
                           );
                         })()}
                       </div>
                     ) : hasDrafted ? (
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
                                  {[...(league.matches || [])]
                                      .filter(Boolean)
                                      .filter(m => m.type === (hasPlayoffsGenerated ? 'playoff' : 'playin'))
                                      .sort((a,b) => a.id - b.id)
                                      .map(m => (
                                      <div key={m.id} className="bg-gray-50 border rounded p-2 text-xs">
                                          <div className="font-bold text-gray-400 mb-1">{m.label || m.date}</div>
                                          <div className="flex justify-between items-center">
                                              <div className={`font-bold ${m.result?.winner === teams.find(t=>t.id===m.t1)?.name ? 'text-green-600' : 'text-gray-700'}`}>{formatTeamName(m.t1, m.type)}</div>
                                              <div className="text-gray-400 font-bold">{m.status === 'finished' ? (m.result?.score || '-') : 'vs'}</div>
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
                    key={myLeague}
                    league={league}
                    teams={teams}
                    myTeam={myTeam}
                    myLeague={myLeague}
                    computedStandings={computedStandings}
                    setViewingTeamId={setViewingTeamId}
                    hasDrafted={hasDrafted}
                    baronTotalWins={baronTotalWins}
                    elderTotalWins={elderTotalWins}
                />
                      )}
              
              {activeTab === 'playoffs' && (
                <PlayoffTab 
                    key={myLeague}
                    league={league}
                    teams={teams}
                    myLeague={myLeague}
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
                    key={myLeague}
                    viewingTeam={viewingTeam}
                    roster={currentRoster}
                    myLeague={myLeague}
                    myTeam={myTeam}
                    onPrevTeam={handlePrevTeam}
                    onNextTeam={handleNextTeam}
                    league={league}
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
                    key={myLeague}
                    league={league}
                    myLeague={myLeague}
                />
            )}

  {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
                <ScheduleTab 
                    activeTab={activeTab}
                    league={league}
                    setLeague={setLeague}
                    teams={teams}
                    myTeam={myTeam}
                    myLeague={myLeague}
                    hasDrafted={hasDrafted}
                    formatTeamName={formatTeamName}
                    onMatchClick={handleMatchClick} 
                />
            )}

{activeTab === 'awards' && (
    <AwardsTab key={myLeague} league={league} teams={teams} playerList={playerList} myLeague={myLeague} />
)}


{activeTab === 'history' && (
    <HistoryTab key={myLeague} league={league} myLeague={myLeague} />
)}

{/* [NEW] FST World Tournament Tab */}
{activeTab === 'fst' && (
    <FSTTournamentTab
        fst={league?.fst}
        onSimulate={handleFSTSimulate}
        onMatchClick={handleMatchClick}
        onReset={hasFSTError ? handleFSTReset : null}
        myTeamName={myTeam?.name}
    />
)}
  
            </div>
          </main>
        </div>
      </div>
    );
  }