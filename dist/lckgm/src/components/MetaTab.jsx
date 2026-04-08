// src/components/MetaTab.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { SYNERGIES } from '../data/synergies';

const getSynergyStrength = (multiplier) => {
    if (multiplier >= 1.10) return { label: 'S', bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' };
    if (multiplier >= 1.07) return { label: 'A', bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
    if (multiplier >= 1.05) return { label: 'B', bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
    return { label: 'C', bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-400' };
};

// ─── Synergies View ────────────────────────────────────────────────────────────
const SynergiesView = () => {
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    const FILTERS = ['ALL', 'S', 'A', 'B', 'C'];

    const filtered = useMemo(() => {
        return SYNERGIES
            .filter(syn => {
                const { label } = getSynergyStrength(syn.multiplier);
                const matchGrade = filter === 'ALL' || label === filter;
                const matchSearch = search === '' || syn.champions.some(c =>
                    c.toLowerCase().includes(search.toLowerCase())
                );
                return matchGrade && matchSearch;
            })
            .sort((a, b) => b.multiplier - a.multiplier);
    }, [filter, search]);

    return (
        <div className="flex flex-col gap-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition ${filter === f ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {f === 'ALL' ? '전체' : `${f} 등급`}
                        </button>
                    ))}
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="챔피언 검색..."
                    className="border rounded-lg px-3 py-1.5 text-sm w-full sm:w-48 outline-none focus:ring-2 focus:ring-purple-300"
                />
                <span className="text-xs text-gray-400 sm:ml-auto">{filtered.length}개 시너지</span>
            </div>

            {/* Synergy Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((syn, i) => {
                    const { label, bg, text, bar } = getSynergyStrength(syn.multiplier);
                    const pct = Math.round((syn.multiplier - 1) * 1000) / 10;
                    const isTeamComp = syn.champions.length >= 3;

                    return (
                        <div key={i} className={`border rounded-xl p-3 hover:border-purple-200 transition bg-white ${isTeamComp ? 'ring-1 ring-purple-100' : ''}`}>
                            <div className="flex items-start gap-2">
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${bg} ${text}`}>
                                    {label}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                                        {syn.champions.map((name, ci) => (
                                            <span key={ci} className="flex items-center gap-0.5">
                                                {ci > 0 && <span className="text-gray-300 text-xs">+</span>}
                                                <span className="text-xs font-semibold text-gray-800">{name}</span>
                                            </span>
                                        ))}
                                    </div>
                                    {isTeamComp && (
                                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">팀 조합</span>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${bar}`}
                                                style={{ width: `${Math.min(pct * 7, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-[11px] font-bold ${text}`}>+{pct}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Main MetaTab ──────────────────────────────────────────────────────────────
const MetaTab = ({ league, championList, metaRole, setMetaRole }) => {
    const currentList = league.currentChampionList || championList;
    const currentVersion = league.metaVersion || '16.01';

    const [activeView, setActiveView] = useState('meta'); // 'meta' | 'synergies'
    const [previousData, setPreviousData] = useState(null);

    useEffect(() => {
        const STORAGE_KEY_CURRENT = 'lck_meta_current';
        const STORAGE_KEY_PREV = 'lck_meta_previous';

        try {
            const storedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT);
            const parsedCurrent = storedCurrent ? JSON.parse(storedCurrent) : null;

            if (!parsedCurrent) {
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({ version: currentVersion, list: currentList }));
            } else if (parsedCurrent.version !== currentVersion) {
                localStorage.setItem(STORAGE_KEY_PREV, JSON.stringify(parsedCurrent));
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({ version: currentVersion, list: currentList }));
                setPreviousData(parsedCurrent.list);
            } else {
                const storedPrev = localStorage.getItem(STORAGE_KEY_PREV);
                if (storedPrev) setPreviousData(JSON.parse(storedPrev).list);
            }
        } catch (error) {
            console.error("Failed to sync meta history:", error);
        }
    }, [currentVersion, currentList]);

    const getRankChange = (champId, currentRankIdx) => {
        if (!previousData) return { diff: null, isNew: false };
        const prevRoleList = previousData
            .filter(c => c.role === metaRole)
            .sort((a, b) => a.tier - b.tier);
        const prevIdx = prevRoleList.findIndex(c => c.id === champId);
        if (prevIdx === -1) return { diff: null, isNew: true };
        return { diff: prevIdx - currentRankIdx, isNew: false };
    };

    const sortedCurrentList = useMemo(() => {
        return currentList
            .filter(c => c.role === metaRole)
            .sort((a, b) => a.tier - b.tier);
    }, [currentList, metaRole]);

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6 lg:p-8 min-h-[50vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> {currentVersion} 패치 메타
                </h2>

                {/* View Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveView('meta')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition ${activeView === 'meta' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        📊 메타 랭킹
                    </button>
                    <button
                        onClick={() => setActiveView('synergies')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition ${activeView === 'synergies' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        ⚡ 시너지
                    </button>
                </div>
            </div>

            {/* Role Selector — meta view only */}
            {activeView === 'meta' && (
                <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar mb-4 sm:mb-6 self-start">
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                        <button
                            key={role}
                            onClick={() => setMetaRole(role)}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold whitespace-nowrap transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            )}

            {/* Views */}
            {activeView === 'synergies' ? (
                <SynergiesView />
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {sortedCurrentList.map((champ, idx) => {
                        const { diff, isNew } = getRankChange(champ.id, idx);

                        return (
                            <div key={champ.id} className="border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-50 transition group gap-3 sm:gap-4">

                                {/* Rank & Name */}
                                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-1/4">
                                    <div className="flex flex-col items-center w-8 sm:w-10 flex-shrink-0">
                                        <span className={`text-xl sm:text-2xl font-black ${champ.tier === 1 ? 'text-yellow-500' : 'text-gray-300'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="text-[10px] font-bold mt-1">
                                            {isNew ? (
                                                <span className="text-purple-600 bg-purple-50 px-1 rounded">NEW</span>
                                            ) : diff > 0 ? (
                                                <span className="text-green-600 flex items-center">▲ {diff}</span>
                                            ) : diff < 0 ? (
                                                <span className="text-red-500 flex items-center">▼ {Math.abs(diff)}</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-base sm:text-lg text-gray-800">{champ.name}</div>
                                        <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {champ.tier} 티어
                                        </span>
                                    </div>
                                </div>

                                {/* Stats Bars */}
                                <div className="w-full sm:flex-1 sm:px-4">
                                    <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mb-1 font-medium">
                                        <span>초반 {champ.stats.early}</span>
                                        <span>중반 {champ.stats.mid}</span>
                                        <span>후반 {champ.stats.late}</span>
                                    </div>
                                    <div className="h-2 sm:h-2.5 bg-gray-100 rounded-full flex overflow-hidden w-full">
                                        <div className="bg-green-400 h-full" style={{ width: `${champ.stats.early * 10}%` }} />
                                        <div className="bg-yellow-400 h-full" style={{ width: `${champ.stats.mid * 10}%` }} />
                                        <div className="bg-red-400 h-full" style={{ width: `${champ.stats.late * 10}%` }} />
                                    </div>
                                </div>

                                {/* Counters */}
                                <div className="w-full sm:w-1/3 text-left sm:text-right mt-1 sm:mt-0">
                                    <div className="text-[10px] sm:text-xs font-bold text-gray-400 mb-0.5 uppercase tracking-wide">Counter Picks</div>
                                    <div className="text-xs sm:text-sm font-medium text-gray-700 truncate">{champ.counters.join(', ')}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MetaTab;