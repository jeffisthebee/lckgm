// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const isLCK = currentLeague === 'LCK';
    
    // Visibility logic
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // ─── THE SUPER SEARCH ────────────────────────────────────────────────────
    // Resolves any token (team ID, name, shortName, fullName) across every league
    const findGlobalTeam = (token) => {
        if (!token || token === 'TBD') return null;
        const s = String(token).trim().toUpperCase();
        const allForeignTeams = Object.values(FOREIGN_LEAGUES).flat();
        const pool = [...teams, ...allForeignTeams];
        return pool.find(t =>
            (t.id       && String(t.id).toUpperCase()        === s) ||
            (t.name     && String(t.name).toUpperCase()      === s) ||
            (t.fullName && String(t.fullName).toUpperCase()  === s) ||
            (t.shortName && String(t.shortName).toUpperCase() === s) ||
            (t.abbr     && String(t.abbr).toUpperCase()      === s)
        ) || null;
    };

    // Given any token, return the best display name — never "TBD" for a non-null token
    const resolveDisplayName = (token) => {
        if (!token) return 'TBD';
        const t = findGlobalTeam(token);
        if (t) return t.shortName || t.name || t.id || String(token);
        return String(token); // raw ID is better than "TBD"
    };

    // Formatter for MatchupBox — shows name + seed if available for that league
    const getBracketDisplayName = (token) => {
        if (!token) return 'TBD';
        const displayName = resolveDisplayName(token);
        if (displayName === 'TBD') return 'TBD';

        const seedList = league.foreignPlayoffSeeds?.[currentLeague] || league.playoffSeeds || [];
        // Seeds store both .id (team ID) and .name (team name) — check both
        const seedInfo = seedList.find(s =>
            (s.id   && String(s.id).toUpperCase()   === String(token).toUpperCase()) ||
            (s.name && String(s.name).toUpperCase() === displayName.toUpperCase())
        );
        return seedInfo ? `${displayName} (${seedInfo.seed}시드)` : displayName;
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // ─── LCP BRACKET ─────────────────────────────────────────────────────────
    //
    // ScheduleTab stores LCP playoff matches with IDs: lcp_po1 … lcp_po8
    // t1/t2 are stored as TEAM IDs (team.id from FOREIGN_LEAGUES['LCP'])
    // result.winner is stored as a TEAM NAME string (from the sim engine)
    //
    // Bracket structure:
    //   WB R1:       po1 (seed5 v seed6)      po2 (seed3 v seed4)
    //   WB R2:       po3 (seed1 v W[po1])     po4 (seed2 v W[po2])
    //   WB Final:    po5 (W[po3] v W[po4])
    //   LB R1:       po6 (L[po3] v L[po4])
    //   LB Final:    po7 (W[po6] v L[po5])
    //   Grand Final: po8 (W[po5] v W[po7])
    //
    const renderLCPBracket = () => {
        const lcpTeams   = FOREIGN_LEAGUES['LCP'] || [];
        const lcpMatches = (league.foreignMatches?.['LCP'] || []).filter(m => m.type === 'playoff');
        const lcpSeeds   = league.foreignPlayoffSeeds?.['LCP'] || [];

        // ── Look up matches by their actual stored ID ──────────────────────
        // Previous versions used findM(round, matchNum) — WRONG.
        // LCP playoff matches have NO round/match properties, only id: 'lcp_poN'
        const byId = (id) => lcpMatches.find(m => m.id === id) || null;

        const po1 = byId('lcp_po1');
        const po2 = byId('lcp_po2');
        const po3 = byId('lcp_po3');
        const po4 = byId('lcp_po4');
        const po5 = byId('lcp_po5');
        const po6 = byId('lcp_po6');
        const po7 = byId('lcp_po7');
        const po8 = byId('lcp_po8');

        // ── Winner / Loser helpers ─────────────────────────────────────────
        // result.winner = team NAME string (from sim engine)
        // t1 / t2      = team ID strings (stored by ScheduleTab's simPlayoffMatch)
        //
        // We resolve both sides through findGlobalTeam so the name↔ID comparison
        // always works no matter what the engine wrote.

        const getWinnerToken = (m) => {
            // Returns the original t1 or t2 token (the ID) that won,
            // so downstream matches stay on the ID-based system consistently.
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerName = String(m.result.winner).toUpperCase();
            const t1Team = findGlobalTeam(m.t1);
            const t2Team = findGlobalTeam(m.t2);
            if (t1Team && String(t1Team.name).toUpperCase() === winnerName) return m.t1;
            if (t2Team && String(t2Team.name).toUpperCase() === winnerName) return m.t2;
            // Last resort: return the name itself so at least the box renders
            return m.result.winner;
        };

        const getLoserToken = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerToken = getWinnerToken(m);
            if (!winnerToken) return null;
            const winUp = String(winnerToken).toUpperCase();
            if (String(m.t1).toUpperCase() !== winUp) return m.t1;
            if (String(m.t2).toUpperCase() !== winUp) return m.t2;
            return null;
        };

        // ── Seed → team token ──────────────────────────────────────────────
        // Seeds stored by ScheduleTab: { seed: N, id: teamId, name: teamName, w, l }
        // Fall back to live standings computation if seeds are missing.
        const getSeedToken = (seedNum) => {
            // 1. Stored seeds (fastest path)
            const s = lcpSeeds.find(item => item.seed === seedNum);
            if (s) return s.id || s.name || null;

            // 2. Live standings fallback
            const regularDone = (league.foreignMatches?.['LCP'] || [])
                .filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
            if (regularDone.length === 0) return null;

            const wins = {};
            lcpTeams.forEach(t => { wins[t.id || t.name] = { token: t.id || t.name, name: t.name, w: 0 }; });
            regularDone.forEach(m => {
                const winner = m.result?.winner;
                if (!winner) return;
                const winUp = String(winner).toUpperCase();
                // Find whichever team token matches the winner name
                const entry = Object.values(wins).find(e => String(e.name).toUpperCase() === winUp);
                if (entry) entry.w += 1;
            });
            const sorted = Object.values(wins).sort((a, b) => b.w - a.w);
            return sorted[seedNum - 1]?.token || null;
        };

        // ── Pending placeholder match ──────────────────────────────────────
        const pending = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        // ── Build display matches ──────────────────────────────────────────
        // If the real match exists (fully populated by ScheduleTab auto-sync), use it.
        // Otherwise fall back to a pending placeholder built from bracket logic —
        // this means slots will show team names as soon as their feeders resolve.
        const wbR1m1     = po1 || pending(getSeedToken(5), getSeedToken(6));
        const wbR1m2     = po2 || pending(getSeedToken(3), getSeedToken(4));
        const wbR2m1     = po3 || pending(getSeedToken(1), getWinnerToken(po1));
        const wbR2m2     = po4 || pending(getSeedToken(2), getWinnerToken(po2));
        const wbFinal    = po5 || pending(getWinnerToken(po3), getWinnerToken(po4));
        const lbR1       = po6 || pending(getLoserToken(po3), getLoserToken(po4));
        const lbFinal    = po7 || pending(getWinnerToken(po6), getLoserToken(po5));
        const grandFinal = po8 || pending(getWinnerToken(po5), getWinnerToken(po7));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1200px] relative pt-12">

                    {/* ── Upper / Winner's Bracket ── */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">

                            <BracketColumn title="PO 1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={wbR1m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={wbR1m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="PO 2라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={wbR2m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={wbR2m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={wbFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>

                            <BracketColumn title="🏆 결승전">
                                <MatchupBox match={grandFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>

                        </div>
                    </div>

                    {/* ── Lower / Loser's Bracket ── */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">

                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={lbR1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>

                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={lbFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>

                        </div>
                    </div>

                </div>
            </div>
        );
    };

    // ─── LCK BRACKET (original logic, untouched) ─────────────────────────────
    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={findMatch(1, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={findMatch(1, 2)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={findMatch(2, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={findMatch(2, 2)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={findMatch(3, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={findMatch(5, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-4 sm:mb-6">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-6">
                👑 2026 {currentLeague} 플레이오프
            </h2>
            
            {isLCK ? (
                hasPlayoffsGenerated ? renderLCKBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                    </div>
                )
            ) : currentLeague === 'LCP' ? (
                (isLCPGenerated || isLckFinished) ? renderLCPBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-xl font-bold">LCP 플레이오프 대진표 준비 중</div>
                    </div>
                )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;