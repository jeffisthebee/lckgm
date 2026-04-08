import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';
import { difficulties, championList, TEAM_COLORS } from '../data/constants';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { saveLeague } from '../engine/storage';

function getTextColor(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (r*299+g*587+b*114)/1000 > 128 ? '#000000' : '#FFFFFF';
}

// League display metadata
const LEAGUE_META = {
    LCK: { label: 'LCK', seasonName: 'LCK 컵', flag: '🇰🇷' },
    LPL: { label: 'LPL', seasonName: 'LPL 스플릿 1', flag: '🇨🇳' },
    LEC: { label: 'LEC', seasonName: 'LEC 버서스', flag: '🇪🇺' },
    LCS: { label: 'LCS', seasonName: 'LCS 락 인', flag: '🇺🇸' },
    LCP: { label: 'LCP', seasonName: 'LCP 스플릿 1', flag: '🌏' },
    CBLOL: { label: 'CBLOL', seasonName: 'CBLOL 레전드 컵', flag: '🇧🇷' },
};

const ALL_LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'];

// Get team color — LCK teams have colors on the object, foreign teams use TEAM_COLORS
function getTeamColor(team) {
    if (team?.colors?.primary) return team.colors.primary;
    return TEAM_COLORS[team?.name] || TEAM_COLORS['DEFAULT'];
}

// Get the full team list for a given league, with colors injected for foreign teams
function getTeamsForLeague(league) {
    if (league === 'LCK') return teams;
    return (FOREIGN_LEAGUES[league] || []).map(t => ({
        ...t,
        colors: { primary: TEAM_COLORS[t.name] || TEAM_COLORS['DEFAULT'], secondary: '#ffffff' }
    }));
}

export default function TeamSelection() {
    const [selectedLeague, setSelectedLeague] = useState('LCK');
    const [idx, setIdx] = useState(0);
    const [diff, setDiff] = useState('normal');
    const navigate = useNavigate();

    const leagueTeams = getTeamsForLeague(selectedLeague);
    const safeIdx = Math.min(idx, leagueTeams.length - 1);
    const current = leagueTeams[safeIdx];
    const primaryColor = getTeamColor(current);
    const meta = LEAGUE_META[selectedLeague];

    const handleLeagueChange = (lg) => {
        setSelectedLeague(lg);
        setIdx(0); // reset team index when switching league
    };

    const handlePrev = () => setIdx(i => (i === 0 ? leagueTeams.length - 1 : i - 1));
    const handleNext = () => setIdx(i => (i === leagueTeams.length - 1 ? 0 : i + 1));

    const handleStart = async () => {
        const newId = Date.now().toString();

        // Build team object — always has colors injected
        const teamObj = {
            ...current,
            colors: { primary: primaryColor, secondary: current.colors?.secondary || '#ffffff' }
        };

        const newLeague = {
            id: newId,
            leagueName: `2026 ${meta.seasonName} - ${current.name}`,
            seasonName: meta.seasonName,
            team: teamObj,
            myLeague: selectedLeague,        // ← THE KEY NEW FIELD — used by all tabs
            difficulty: diff,
            createdAt: new Date().toISOString(),
            lastPlayed: new Date().toISOString(),

            // -- LCK DATA (still needed for watching LCK + FST participation) --
            groups: { baron: [], elder: [] },
            matches: [],
            standings: {},
            currentChampionList: championList,
            metaVersion: '16.01',

            // -- FOREIGN LEAGUE DATA --
            foreignLeagues: FOREIGN_LEAGUES,
            foreignStandings: { LPL: {}, LEC: {}, LCS: {}, LCP: {}, CBLOL: {} },
            foreignMatches:   { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] },
            foreignHistory:   { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] },
        };

        await saveLeague(newLeague);
        navigate(`/league/${newId}`);
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors duration-500 p-4 sm:p-6"
            style={{ backgroundColor: `${primaryColor}10` }}
        >
            <div
                className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-lg sm:max-w-5xl text-center border-t-8 transition-all duration-300"
                style={{ borderColor: primaryColor }}
            >
                <h2 className="text-2xl sm:text-3xl font-black mb-4 sm:mb-6 text-gray-900">팀 선택</h2>

                {/* ── League Picker ── */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {ALL_LEAGUES.map(lg => {
                        const lMeta = LEAGUE_META[lg];
                        const isActive = selectedLeague === lg;
                        return (
                            <button
                                key={lg}
                                onClick={() => handleLeagueChange(lg)}
                                className={`px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95 border-2 ${
                                    isActive
                                        ? 'text-white shadow-md scale-105'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                }`}
                                style={isActive ? {
                                    backgroundColor: primaryColor,
                                    borderColor: primaryColor,
                                    color: getTextColor(primaryColor)
                                } : {}}
                            >
                                {lMeta.flag} {lMeta.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">

                    {/* Left Column: Team Display */}
                    <div className="flex-1 w-full flex flex-col items-center">
                        <div className="flex items-center justify-between w-full sm:w-auto sm:justify-center sm:gap-6 mb-4 sm:mb-6">
                            <button
                                onClick={handlePrev}
                                className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                            >
                                ◀
                            </button>

                            <div className="flex flex-col items-center transform transition duration-300">
                                <div
                                    className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black shadow-xl mb-3 sm:mb-4 ring-4 ring-white transition-all"
                                    style={{ backgroundColor: primaryColor, color: getTextColor(primaryColor) }}
                                >
                                    {current.name}
                                </div>
                                {/* League badge under the circle */}
                                <span
                                    className="text-xs font-bold px-3 py-1 rounded-full mb-1"
                                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                                >
                                    {meta.flag} {meta.label}
                                </span>
                            </div>

                            <button
                                onClick={handleNext}
                                className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                            >
                                ▶
                            </button>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{current.fullName}</h3>
                        <div className="inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">
                            종합 전력: <span className="text-lg" style={{ color: primaryColor }}>{current.power}</span>
                        </div>

                        {/* Team dots indicator */}
                        <div className="flex gap-1.5 mt-4 flex-wrap justify-center">
                            {leagueTeams.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setIdx(i)}
                                    className="w-2 h-2 rounded-full transition-all"
                                    style={{
                                        backgroundColor: i === safeIdx ? primaryColor : '#d1d5db',
                                        transform: i === safeIdx ? 'scale(1.4)' : 'scale(1)'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Divider for mobile portrait only */}
                    <div className="w-full h-px bg-gray-200 sm:hidden"></div>

                    {/* Right Column: Settings & Start */}
                    <div className="flex-1 w-full flex flex-col justify-center">
                        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
                            {difficulties.map(d => (
                                <button
                                    key={d.value}
                                    onClick={() => setDiff(d.value)}
                                    className={`py-2 sm:py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition ${
                                        diff === d.value
                                            ? 'bg-gray-800 text-white border-gray-800'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-8 text-xs sm:text-sm leading-relaxed border border-gray-100 text-left">
                            <p className="text-gray-600 font-medium">
                                ℹ️ 난이도가 상승할수록 승리 확률 감소, 재계약 확률 감소, 선수의 기복이 증가합니다.
                            </p>
                            {diff === 'insane' && (
                                <p className="text-red-600 font-bold mt-2 animate-pulse">
                                    ⚠️ 극악 난이도는 운과 실력이 모두 필요한 최악의 시나리오입니다.
                                </p>
                            )}
                            {selectedLeague !== 'LCK' && (
                                <p className="mt-2 font-bold" style={{ color: primaryColor }}>
                                    🌏 해외 리그 모드: {meta.seasonName} 일정으로 플레이합니다.
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleStart}
                            className="w-full py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1 active:translate-y-0"
                            style={{ backgroundColor: primaryColor, color: getTextColor(primaryColor) }}
                        >
                            2026 시즌 시작하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}