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

    // ─── Shared Layout Components ────────────────────────────────────────────
    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // ─── LCK Bracket (existing logic, untouched) ─────────────────────────────
    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];

        const getWinner = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const team = teams.find(t => t.name === m.result.winner);
            return team ? team.id : null;
        };

        const getLoser = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerId = getWinner(m);
            if (!winnerId) return null;
            return m.t1 === winnerId ? m.t2 : m.t1;
        };

        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);

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

        const getSeedId = (seedNum) => {
            if (!league.playoffSeeds) return null;
            const s = league.playoffSeeds.find(item => item.seed === seedNum);
            return s ? s.id : null;
        };

        const pendingMatch = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        const getHigherSeedLoser = (matchA, matchB) => {
            const loserA = getLoser(matchA);
            const loserB = getLoser(matchB);
            if (!loserA) return loserB;
            if (!loserB) return loserA;
            const seedA = league.playoffSeeds?.find(s => s.id === loserA)?.seed || 99;
            const seedB = league.playoffSeeds?.find(s => s.id === loserB)?.seed || 99;
            return seedA < seedB ? loserA : loserB;
        };

        const getLowerSeedLoser = (matchA, matchB) => {
            const higher = getHigherSeedLoser(matchA, matchB);
            const loserA = getLoser(matchA);
            return (loserA === higher) ? getLoser(matchB) : loserA;
        };

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    {/* Winner's Bracket */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r2m1_actual || pendingMatch(getSeedId(1), getWinner(r1m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r2m2_actual || pendingMatch(getSeedId(2), getWinner(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={r3m1_actual || pendingMatch(getWinner(r2m1_actual), getWinner(r2m2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={final_actual || pendingMatch(getWinner(r3m1_actual), getWinner(r4m1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>
                    {/* Loser's Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={r2lm1_actual || pendingMatch(getLoser(r1m1), getLoser(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 2R">
                                <MatchupBox match={r2lm2_actual || pendingMatch(getHigherSeedLoser(r2m1_actual, r2m2_actual), getWinner(r2lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 3R">
                                <MatchupBox match={r3lm1_actual || pendingMatch(getLowerSeedLoser(r2m1_actual, r2m2_actual), getWinner(r2lm2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={r4m1_actual || pendingMatch(getLoser(r3m1_actual), getWinner(r3lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── LCP Bracket ─────────────────────────────────────────────────────────
    // Structure (6-team double elimination):
    //   WB R1  : po1 (5v6),  po2 (3v4)
    //   WB R2  : po3 (1 vs W[po1]),  po4 (2 vs W[po2])
    //   WB Final : po5 (W[po3] vs W[po4])
    //   LB R1  : po6 (L[po3] vs L[po4])
    //   LB Final : po7 (W[po6] vs L[po5])
    //   Grand Final : po8 (W[po5] vs W[po7])
    const renderLCPBracket = () => {
        const lcpTeams = FOREIGN_LEAGUES['LCP'] || [];
        const lcpMatches = (league.foreignMatches?.['LCP'] || []).filter(m => m.type === 'playoff');
        const lcpSeeds = league.foreignPlayoffSeeds?.['LCP'] || [];

        // ── Robust team lookup ──────────────────────────────────────────────
        // t1/t2 on matches may be stored as: team.id, team.name, team.shortName,
        // team.abbr, or even the raw seed object's id/name. We try everything.
        const findTeam = (token) => {
            if (!token) return null;
            const s = String(token).toLowerCase().trim();
            return lcpTeams.find(t =>
                String(t.id   || '').toLowerCase() === s ||
                String(t.name || '').toLowerCase() === s ||
                String(t.shortName || '').toLowerCase() === s ||
                String(t.abbr || '').toLowerCase() === s ||
                String(t.fullName || '').toLowerCase() === s ||
                String(t.teamName || '').toLowerCase() === s
            );
        };

        // Always returns a human-readable display name; never returns 'TBD' for a non-null token
        const lcpFormatTeamName = (token) => {
            if (!token) return 'TBD';
            const t = findTeam(token);
            // Prefer shortName → name → token itself (so at worst the raw ID shows, not "TBD")
            return t ? (t.shortName || t.name || t.id || String(token)) : String(token);
        };

        const findById = (id) => lcpMatches.find(m => m.id === id);

        // ── Normalize any team token → a canonical key for comparison ───────
        // This is the critical fix: t1/t2 and result.winner may use DIFFERENT
        // representations (id vs name). We normalize both sides to the same thing
        // (the team's name string, which is what result.winner always uses).
        const normalize = (token) => {
            if (!token) return null;
            const t = findTeam(token);
            return t ? (t.name || t.id || String(token)) : String(token);
        };

        // ── Winner / Loser helpers (normalized comparison) ──────────────────
        const getWinner = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            // result.winner is always a team name string from the sim engine
            // — normalize it back to whatever token format t1/t2 use so that
            //   the getLoser comparison works correctly.
            const winnerNorm = normalize(m.result.winner);
            const t1Norm     = normalize(m.t1);
            const t2Norm     = normalize(m.t2);
            // Return whichever original token (t1 or t2) matches the winner
            if (t1Norm === winnerNorm) return m.t1;
            if (t2Norm === winnerNorm) return m.t2;
            // Fallback: just return result.winner directly; better than null
            return m.result.winner;
        };

        const getLoser = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerToken = getWinner(m);
            if (!winnerToken) return null;
            // Return the OTHER token (t1 or t2) that is NOT the winner
            const winnerNorm = normalize(winnerToken);
            if (normalize(m.t1) !== winnerNorm) return m.t1;
            if (normalize(m.t2) !== winnerNorm) return m.t2;
            return null;
        };

        // ── Seed lookup ─────────────────────────────────────────────────────
        // Seeds are stored as { seed: N, id, name, ... }. Also fall back to
        // computing seeds live from standings if foreignPlayoffSeeds is missing.
        const getSeedId = (seedNum) => {
            // 1. Try stored seeds
            const s = lcpSeeds.find(item => item.seed === seedNum);
            if (s) return s.id || s.name || null;

            // 2. Compute live from regular-season results as a fallback
            const regularMatches = (league.foreignMatches?.['LCP'] || [])
                .filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
            if (regularMatches.length === 0) return null;

            const st = {};
            lcpTeams.forEach(t => { st[t.name] = { w: 0, ref: t }; });
            regularMatches.forEach(m => {
                const winnerName = m.result?.winner;
                if (!winnerName) return;
                const t1 = findTeam(m.t1);
                const t2 = findTeam(m.t2);
                if (!t1 || !t2) return;
                if (st[t1.name]) st[t1.name].w += (winnerName === t1.name || normalize(winnerName) === normalize(t1.name)) ? 1 : 0;
                if (st[t2.name]) st[t2.name].w += (winnerName === t2.name || normalize(winnerName) === normalize(t2.name)) ? 1 : 0;
            });

            const sorted = Object.values(st).sort((a, b) => b.w - a.w);
            const entry = sorted[seedNum - 1];
            return entry ? (entry.ref.id || entry.ref.name) : null;
        };

        const pendingMatch = (t1, t2) => ({
            t1: t1 || null,
            t2: t2 || null,
            status: 'pending',
            type: 'playoff',
        });

        const po1 = findById('lcp_po1');
        const po2 = findById('lcp_po2');
        const po3 = findById('lcp_po3');
        const po4 = findById('lcp_po4');
        const po5 = findById('lcp_po5');
        const po6 = findById('lcp_po6');
        const po7 = findById('lcp_po7');
        const po8 = findById('lcp_po8');

        // We wrap each match for MatchupBox: it gets actual match if exists,
        // otherwise a pending placeholder derived from bracket logic.
        const wbR1m1 = po1 || pendingMatch(getSeedId(5), getSeedId(6));
        const wbR1m2 = po2 || pendingMatch(getSeedId(3), getSeedId(4));
        const wbR2m1 = po3 || pendingMatch(getSeedId(1), getWinner(po1));
        const wbR2m2 = po4 || pendingMatch(getSeedId(2), getWinner(po2));
        const wbFinal = po5 || pendingMatch(getWinner(po3), getWinner(po4));
        const lbR1   = po6 || pendingMatch(getLoser(po3),  getLoser(po4));
        const lbFinal = po7 || pendingMatch(getWinner(po6), getLoser(po5));
        const grandFinal = po8 || pendingMatch(getWinner(po5), getWinner(po7));

        // MatchupBox expects formatTeamName(id) → display string
        // For LCP we pass our local resolver as formatTeamName
        const lcpClick = (m) => handleMatchClick && handleMatchClick(m);

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1300px] relative pt-12">

                    {/* ── Winner's Bracket ── */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">
                            승자조 (Winner's Bracket)
                        </h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox
                                        match={wbR1m1}
                                        onClick={lcpClick}
                                        formatTeamName={lcpFormatTeamName}
                                    />
                                    <MatchupBox
                                        match={wbR1m2}
                                        onClick={lcpClick}
                                        formatTeamName={lcpFormatTeamName}
                                    />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox
                                        match={wbR2m1}
                                        onClick={lcpClick}
                                        formatTeamName={lcpFormatTeamName}
                                    />
                                    <MatchupBox
                                        match={wbR2m2}
                                        onClick={lcpClick}
                                        formatTeamName={lcpFormatTeamName}
                                    />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="승자조 결승">
                                <MatchupBox
                                    match={wbFinal}
                                    onClick={lcpClick}
                                    formatTeamName={lcpFormatTeamName}
                                />
                            </BracketColumn>

                            <BracketColumn title="🏆 결승전">
                                <MatchupBox
                                    match={grandFinal}
                                    onClick={lcpClick}
                                    formatTeamName={lcpFormatTeamName}
                                />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* ── Loser's Bracket ── */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">
                            패자조 (Loser's Bracket)
                        </h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox
                                    match={lbR1}
                                    onClick={lcpClick}
                                    formatTeamName={lcpFormatTeamName}
                                />
                            </BracketColumn>

                            <BracketColumn title="패자조 결승">
                                <MatchupBox
                                    match={lbFinal}
                                    onClick={lcpClick}
                                    formatTeamName={lcpFormatTeamName}
                                />
                            </BracketColumn>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    // ─── Empty State (shared between leagues) ────────────────────────────────
    const NotStartedState = ({ league: lgName, label }) => (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-4">🛡️</div>
            <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
            <p className="mt-2">{label || '정규 시즌을 모두 마친 후 대진이 생성됩니다.'}</p>
        </div>
    );

    // ─── LCP playoffs ready check ─────────────────────────────────────────
    const lcpMatches = league.foreignMatches?.['LCP'] || [];
    const hasLCPPlayoffs = lcpMatches.some(m => m.type === 'playoff');

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">

            {/* League Switcher */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-4 sm:mb-6">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                            : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                👑 2026 {currentLeague} 플레이오프
            </h2>

            {/* ── LCK ── */}
            {currentLeague === 'LCK' && (
                hasPlayoffsGenerated
                    ? renderLCKBracket()
                    : <NotStartedState lgName="LCK" label="정규 시즌과 플레이-인을 모두 마친 후 대진이 생성됩니다." />
            )}

            {/* ── LCP ── */}
            {currentLeague === 'LCP' && (
                hasLCPPlayoffs
                    ? renderLCPBracket()
                    : <NotStartedState lgName="LCP" label="LCP 정규 시즌을 마친 후 대진이 자동으로 생성됩니다." />
            )}

            {/* ── All other foreign leagues: placeholder ── */}
            {!['LCK', 'LCP'].includes(currentLeague) && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                    <p className="mt-2 text-sm lg:text-base font-bold text-gray-500">
                        해외 리그의 플레이오프 및 FST 토너먼트 로직은 다음 작전 단계에서 가동됩니다!
                    </p>
                </div>
            )}

        </div>
    );
};

export default PlayoffTab;