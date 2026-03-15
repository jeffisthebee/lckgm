import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants';
import TutorialModal from '../components/TutorialModal';
import { getLeagues, updateLeague, deleteLeague, getSetting, setSetting, deleteSetting } from '../engine/storage';
import db from '../engine/db';

// Resolve a team from any league by id or name
const resolveTeam = (leagueTeam) => {
    if (!leagueTeam) return null;
    // Try LCK first
    let found = teams.find(t =>
        String(t.id) === String(leagueTeam.id) || t.name === leagueTeam.name
    );
    // Try foreign leagues
    if (!found) {
        const allForeign = Object.values(FOREIGN_LEAGUES).flat();
        found = allForeign.find(t =>
            String(t.id) === String(leagueTeam.id) || t.name === leagueTeam.name
        );
    }
    // Fall back to the saved team object itself (always has name/fullName)
    return found || leagueTeam;
};

// Safe color resolver
const getTeamColor = (team) => {
    if (team?.colors?.primary) return team.colors.primary;
    return (TEAM_COLORS && TEAM_COLORS[team?.name]) || '#607d8b';
};

const LEAGUE_BADGE_COLORS = {
    LCK:   'bg-blue-100 text-blue-700',
    LPL:   'bg-red-100 text-red-700',
    LEC:   'bg-purple-100 text-purple-700',
    LCS:   'bg-green-100 text-green-700',
    LCP:   'bg-yellow-100 text-yellow-700',
    CBLOL: 'bg-orange-100 text-orange-700',
};

export default function LeagueManager() {
    const [leagues, setLeagues] = useState([]);
    const [showTutorial, setShowTutorial] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await getLeagues();
                const hasCorrupted = data.some(l => !l.team || !l.id);
                if (hasCorrupted) setLoadError(true);
                setLeagues(data);
            } catch (err) {
                console.error('Failed to load leagues:', err);
                setLoadError(true);
                setLeagues([]);
            }

            const isHidden = await getSetting('tutorial_hidden');
            if (!isHidden) setShowTutorial(true);
        };
        loadData();
    }, []);

    const handleCloseTutorial = () => setShowTutorial(false);

    const handleDoNotShowAgain = async () => {
        if (window.confirm('다음부터 이 창을 띄우지 않겠습니까? (상단 ? 버튼으로 다시 볼 수 있습니다)')) {
            await setSetting('tutorial_hidden', 'true');
            setShowTutorial(false);
        }
    };

    const handleOpenTutorial = () => setShowTutorial(true);

    const handleClearData = async () => {
        if (window.confirm('저장된 모든 데이터를 초기화하시겠습니까? 실행 후 접속 오류가 해결됩니다.')) {
            await db.leagues.clear();
            await deleteSetting('tutorial_hidden');
            window.location.reload();
        }
    };

    const handleEnterLeague = async (leagueId) => {
        await updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
        navigate(`/league/${leagueId}`);
    };

    const handleDeleteLeague = async (leagueId) => {
        if (window.confirm('삭제하시겠습니까?')) {
            await deleteLeague(leagueId);
            setLeagues(prev => prev.filter(l => l.id !== leagueId));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
            {showTutorial && (
                <TutorialModal
                    onClose={handleCloseTutorial}
                    onDoNotShowAgain={handleDoNotShowAgain}
                />
            )}

            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">⚡ GM 모드</h1>
                        <p className="text-gray-500 text-sm mt-1">저장된 시즌을 선택하세요</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenTutorial}
                            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold text-sm transition flex items-center justify-center"
                            title="튜토리얼 보기"
                        >
                            ?
                        </button>
                        {loadError && (
                            <button
                                onClick={handleClearData}
                                className="text-xs text-red-500 underline hover:text-red-700 whitespace-nowrap ml-2"
                                title="데이터 오류 발생 시 초기화"
                            >
                                ⚠️ 데이터 초기화
                            </button>
                        )}
                    </div>
                </div>

                {/* League List */}
                <div className="grid gap-3 sm:gap-4">
                    {leagues.map(l => {
                        // Use resolveTeam so foreign leagues aren't filtered out
                        const t = resolveTeam(l.team);
                        if (!t) return null;

                        const teamColor = getTeamColor(t);
                        const leagueType = l.leagueType || 'LCK';
                        const badgeClass = LEAGUE_BADGE_COLORS[leagueType] || 'bg-gray-100 text-gray-600';

                        return (
                            <div
                                key={l.id}
                                className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center group gap-4 sm:gap-0"
                            >
                                {/* Team Info */}
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div
                                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md text-base sm:text-lg"
                                        style={{ backgroundColor: teamColor }}
                                    >
                                        {t.name}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg sm:text-xl font-bold group-hover:text-blue-600 transition truncate">
                                                {t.fullName || t.name}
                                            </h2>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                {leagueType}
                                            </span>
                                        </div>
                                        <p className="text-gray-500 font-medium text-xs sm:text-sm truncate">
                                            {l.leagueName} · {l.difficulty?.toUpperCase() || 'NORMAL'}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleEnterLeague(l.id)}
                                        className="flex-1 sm:flex-none bg-blue-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition text-sm sm:text-base"
                                    >
                                        접속하기
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLeague(l.id)}
                                        className="flex-1 sm:flex-none bg-gray-100 text-gray-600 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold hover:bg-gray-200 transition text-sm sm:text-base"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* New League Button */}
                <button
                    onClick={() => navigate('/new-league')}
                    className="w-full mt-4 sm:mt-6 bg-white border-2 border-dashed border-gray-300 py-4 sm:py-6 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 font-bold text-lg sm:text-xl transition flex items-center justify-center gap-2"
                >
                    <span>+</span> 새로운 시즌 시작하기
                </button>
            </div>
        </div>
    );
}