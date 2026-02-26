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
    const [showDebug, setShowDebug] = useState(false);
    
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const isLCK = currentLeague === 'LCK';
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // ─── SUPER SEARCH ────────────────────────────────────────────────────────
    const findGlobalTeam = (token) => {
        if (!token || token === 'TBD') return null;
        const s = String(token).trim().toUpperCase();
        const allForeignTeams = Object.values(FOREIGN_LEAGUES).flat();
        const pool = [...teams, ...allForeignTeams];
        return pool.find(t =>
            (t.id        && String(t.id).toUpperCase()        === s) ||
            (t.name      && String(t.name).toUpperCase()      === s) ||
            (t.fullName  && String(t.fullName).toUpperCase()  === s) ||
            (t.shortName && String(t.shortName).toUpperCase() === s) ||
            (t.abbr      && String(t.abbr).toUpperCase()      === s)
        ) || null;
    };

    const resolveDisplayName = (token) => {
        if (!token) return 'TBD';
        const t = findGlobalTeam(token);
        if (t) return t.shortName || t.name || t.id || String(token);
        return String(token);
    };

    const getBracketDisplayName = (token) => {
        if (!token) return 'TBD';
        const displayName = resolveDisplayName(token);
        const seedList = league.foreignPlayoffSeeds?.[currentLeague] || league.playoffSeeds || [];
        const seedInfo = seedList.find(s =>
            (s.id   && String(s.id).toUpperCase()   === String(token).toUpperCase()) ||
            (s.name && String(s.name).toUpperCase() === displayName.toUpperCase())
        );
        return seedInfo ? `${displayName} (${seedInfo.seed}시드)` : displayName;
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">{children}</div>
        </div>
    );

    // ─── DEBUG PANEL ─────────────────────────────────────────────────────────
    // Shows the raw data so we can see EXACTLY what's stored vs what resolves.
    // Remove this once TBD is fixed.
    const renderDebugPanel = () => {
        const allLCP = league.foreignMatches?.['LCP'] || [];
        const playoffMatches = allLCP.filter(m => m.type === 'playoff');
        const regularMatches = allLCP.filter(m => m.type !== 'playoff');
        const seeds = league.foreignPlayoffSeeds?.['LCP'] || [];
        const lcpTeamsFromForeignLeagues = FOREIGN_LEAGUES['LCP'] || [];

        return (
            <div className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg text-xs font-mono overflow-auto max-h-[600px]">
                <div className="text-yellow-400 font-bold mb-2">🔍 LCP DEBUG PANEL — copy this and share it</div>

                <div className="mb-3">
                    <div className="text-white font-bold">FOREIGN_LEAGUES['LCP'] team sample (first 3):</div>
                    {lcpTeamsFromForeignLeagues.slice(0, 3).map((t, i) => (
                        <div key={i} className="ml-2">
                            id="{t.id}" | name="{t.name}" | shortName="{t.shortName}" | fullName="{t.fullName}"
                        </div>
                    ))}
                    {lcpTeamsFromForeignLeagues.length === 0 && <div className="text-red-400 ml-2">⚠️ EMPTY — FOREIGN_LEAGUES['LCP'] has no teams!</div>}
                </div>

                <div className="mb-3">
                    <div className="text-white font-bold">foreignPlayoffSeeds['LCP'] ({seeds.length} seeds):</div>
                    {seeds.length === 0
                        ? <div className="text-red-400 ml-2">⚠️ EMPTY — seeds not generated yet</div>
                        : seeds.map((s, i) => <div key={i} className="ml-2">seed={s.seed} | id="{s.id}" | name="{s.name}"</div>)
                    }
                </div>

                <div className="mb-3">
                    <div className="text-white font-bold">LCP playoff matches ({playoffMatches.length} total):</div>
                    {playoffMatches.length === 0
                        ? <div className="text-red-400 ml-2">⚠️ EMPTY — playoff matches not generated yet</div>
                        : playoffMatches.map((m, i) => (
                            <div key={i} className="ml-2 mb-1">
                                <span className="text-cyan-400">{m.id}</span>: t1="{m.t1}" t2="{m.t2}" status={m.status}
                                {m.result && <span> | winner="{m.result.winner}" score="{m.result.score}"</span>}
                                <span className="text-gray-500"> | resolvedT1="{resolveDisplayName(m.t1)}" resolvedT2="{resolveDisplayName(m.t2)}"</span>
                            </div>
                        ))
                    }
                </div>

                <div className="mb-3">
                    <div className="text-white font-bold">LCP regular season: {regularMatches.length} total, {regularMatches.filter(m => m.status === 'finished').length} finished</div>
                    {regularMatches.length === 0 && <div className="text-red-400 ml-2">⚠️ No regular season matches — ScheduleTab may not have synced yet</div>}
                </div>

                <div className="mb-3">
                    <div className="text-white font-bold">Visibility flags:</div>
                    <div className="ml-2">isLCPGenerated={String(isLCPGenerated)} | isLckFinished={String(isLckFinished)}</div>
                </div>
            </div>
        );
    };

    // ─── LCP BRACKET ─────────────────────────────────────────────────────────
    const renderLCPBracket = () => {
        const lcpTeams   = FOREIGN_LEAGUES['LCP'] || [];
        const lcpMatches = (league.foreignMatches?.['LCP'] || []).filter(m => m.type === 'playoff');
        const lcpSeeds   = league.foreignPlayoffSeeds?.['LCP'] || [];

        const byId = (id) => lcpMatches.find(m => m.id === id) || null;

        const po1 = byId('lcp_po1');
        const po2 = byId('lcp_po2');
        const po3 = byId('lcp_po3');
        const po4 = byId('lcp_po4');
        const po5 = byId('lcp_po5');
        const po6 = byId('lcp_po6');
        const po7 = byId('lcp_po7');
        const po8 = byId('lcp_po8');

        const getWinnerToken = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerName = String(m.result.winner).toUpperCase();
            const t1Team = findGlobalTeam(m.t1);
            const t2Team = findGlobalTeam(m.t2);
            if (t1Team && String(t1Team.name).toUpperCase() === winnerName) return m.t1;
            if (t2Team && String(t2Team.name).toUpperCase() === winnerName) return m.t2;
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

        const getSeedToken = (seedNum) => {
            const s = lcpSeeds.find(item => item.seed === seedNum);
            if (s) return s.id || s.name || null;

            // Live fallback from regular season
            const regularDone = (league.foreignMatches?.['LCP'] || [])
                .filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
            if (regularDone.length === 0) return null;

            const wins = {};
            lcpTeams.forEach(t => { wins[String(t.id || t.name)] = { token: t.id || t.name, name: t.name, w: 0 }; });
            regularDone.forEach(m => {
                const winner = m.result?.winner;
                if (!winner) return;
                const winUp = String(winner).toUpperCase();
                const entry = Object.values(wins).find(e => String(e.name).toUpperCase() === winUp);
                if (entry) entry.w += 1;
            });
            const sorted = Object.values(wins).sort((a, b) => b.w - a.w);
            return sorted[seedNum - 1]?.token || null;
        };

        const pending = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

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

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-gray-900">
                    👑 2026 {currentLeague} 플레이오프
                </h2>
                {/* Temporary debug toggle — remove after fixing TBD */}
                {currentLeague === 'LCP' && (
                    <button
                        onClick={() => setShowDebug(v => !v)}
                        className="text-xs px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded font-bold"
                    >
                        {showDebug ? '🔍 Hide Debug' : '🔍 Show Debug'}
                    </button>
                )}
            </div>

            {currentLeague === 'LCP' && showDebug && renderDebugPanel()}
            
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