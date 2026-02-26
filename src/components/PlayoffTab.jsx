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
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // ─── SUPER SEARCH ────────────────────────────────────────────────────────
    // Resolves any token (ID like "LCP_GAM", or name like "GAM") to a team object
    const findGlobalTeam = (token) => {
        if (!token || token === 'TBD') return null;
        const s = String(token).trim().toUpperCase();
        const pool = [...teams, ...Object.values(FOREIGN_LEAGUES).flat()];
        return pool.find(t =>
            (t.id        && String(t.id).toUpperCase()        === s) ||
            (t.name      && String(t.name).toUpperCase()      === s) ||
            (t.fullName  && String(t.fullName).toUpperCase()  === s) ||
            (t.shortName && String(t.shortName).toUpperCase() === s) ||
            (t.abbr      && String(t.abbr).toUpperCase()      === s)
        ) || null;
    };

    // Given any token, get the best human-readable display name
    const resolveDisplayName = (token) => {
        if (!token) return null;
        const t = findGlobalTeam(token);
        // shortName is empty for LCP teams per debug output, so fall through to name
        return t ? (t.name || t.id || String(token)) : String(token);
    };

    // Seed label lookup
    const getSeedLabel = (token, leagueKey) => {
        const seedList = league.foreignPlayoffSeeds?.[leagueKey] || league.playoffSeeds || [];
        const displayName = resolveDisplayName(token);
        const seedInfo = seedList.find(s =>
            (s.id   && String(s.id).toUpperCase()   === String(token || '').toUpperCase()) ||
            (s.name && displayName && String(s.name).toUpperCase() === displayName.toUpperCase())
        );
        return seedInfo ? `${seedInfo.seed}시드` : null;
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">{children}</div>
        </div>
    );

    // ─── LCP BRACKET ─────────────────────────────────────────────────────────
    const renderLCPBracket = () => {
        const lcpTeams   = FOREIGN_LEAGUES['LCP'] || [];
        const lcpMatches = (league.foreignMatches?.['LCP'] || []).filter(m => m.type === 'playoff');
        const lcpSeeds   = league.foreignPlayoffSeeds?.['LCP'] || [];

        // ── Fetch match by stored ID ──────────────────────────────────────
        const byId = (id) => lcpMatches.find(m => m.id === id) || null;

        const po1 = byId('lcp_po1');
        const po2 = byId('lcp_po2');
        const po3 = byId('lcp_po3');
        const po4 = byId('lcp_po4');
        const po5 = byId('lcp_po5');
        const po6 = byId('lcp_po6');
        const po7 = byId('lcp_po7');
        const po8 = byId('lcp_po8');

        // ── Winner/loser token helpers ────────────────────────────────────
        // result.winner = name string ("DCG"), t1/t2 = ID strings ("LCP_DCG")
        // We normalize both through findGlobalTeam to get a safe comparison.
        const getWinnerToken = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerName = String(m.result.winner).toUpperCase();
            const t1Team = findGlobalTeam(m.t1);
            const t2Team = findGlobalTeam(m.t2);
            if (t1Team && String(t1Team.name).toUpperCase() === winnerName) return m.t1;
            if (t2Team && String(t2Team.name).toUpperCase() === winnerName) return m.t2;
            return m.result.winner; // last resort
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

        // ── Seed → token ─────────────────────────────────────────────────
        const getSeedToken = (seedNum) => {
            const s = lcpSeeds.find(item => item.seed === seedNum);
            if (s) return s.id || s.name || null;
            return null;
        };

        // ── THE KEY FIX ───────────────────────────────────────────────────
        // MatchupBox does its own internal teams.find(t => t.id === match.t1)
        // using the LCK `teams` array — so "LCP_GAM" never resolves → TBD.
        //
        // Solution: replace t1/t2 in the match object with the already-resolved
        // display names BEFORE passing to MatchupBox. MatchupBox then reads
        // "GAM" directly from the field instead of looking it up.
        // Also replace result.winner with the display name so the WIN highlight works.
        const resolved = (m) => {
            if (!m) return null;
            const t1Name = resolveDisplayName(m.t1);
            const t2Name = resolveDisplayName(m.t2);
            const winnerName = m.result?.winner ? resolveDisplayName(m.result.winner) : undefined;
            return {
                ...m,
                t1: t1Name || m.t1,
                t2: t2Name || m.t2,
                result: m.result ? { ...m.result, winner: winnerName || m.result.winner } : m.result,
            };
        };

        const pending = (t1token, t2token) => ({
            t1: resolveDisplayName(t1token) || null,
            t2: resolveDisplayName(t2token) || null,
            status: 'pending',
            type: 'playoff',
        });

        // ── Build display matches with pre-resolved names ─────────────────
        const wbR1m1     = resolved(po1) || pending(getSeedToken(5), getSeedToken(6));
        const wbR1m2     = resolved(po2) || pending(getSeedToken(3), getSeedToken(4));
        const wbR2m1     = resolved(po3) || pending(getSeedToken(1), getWinnerToken(po1));
        const wbR2m2     = resolved(po4) || pending(getSeedToken(2), getWinnerToken(po2));
        const wbFinal    = resolved(po5) || pending(getWinnerToken(po3), getWinnerToken(po4));
        const lbR1       = resolved(po6) || pending(getLoserToken(po3), getLoserToken(po4));
        const lbFinal    = resolved(po7) || pending(getWinnerToken(po6), getLoserToken(po5));
        const grandFinal = resolved(po8) || pending(getWinnerToken(po5), getWinnerToken(po7));

        // MatchupBox formatTeamName: names are already resolved, just pass through
        // but still append seed info if available
        const lcpFormatName = (name) => {
            if (!name) return 'TBD';
            const seed = getSeedLabel(name, 'LCP');
            return seed ? `${name} (${seed})` : name;
        };

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1200px] relative pt-12">

                    {/* ── Upper Bracket ── */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">

                            <BracketColumn title="PO 1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={wbR1m1} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                                    <MatchupBox match={wbR1m2} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="PO 2라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={wbR2m1} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                                    <MatchupBox match={wbR2m2} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={wbFinal} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                            </BracketColumn>

                            <BracketColumn title="🏆 결승전">
                                <MatchupBox match={grandFinal} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                            </BracketColumn>

                        </div>
                    </div>

                    {/* ── Lower Bracket ── */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">

                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={lbR1} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                            </BracketColumn>

                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={lbFinal} onClick={handleMatchClick} formatTeamName={lcpFormatName} />
                            </BracketColumn>

                        </div>
                    </div>

                </div>
            </div>
        );
    };

    // ─── LCK BRACKET ─────────────────────────────────────────────────────────
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
                                    <MatchupBox match={findMatch(1, 1)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={findMatch(1, 2)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={findMatch(2, 1)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={findMatch(2, 2)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={findMatch(3, 1)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={findMatch(5, 1)} onClick={handleMatchClick} formatTeamName={formatTeamName} />
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