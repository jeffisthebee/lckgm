// src/components/MetaTab.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { SYNERGIES } from '../data/synergies';

const MetaTab = ({ league, championList, metaRole, setMetaRole }) => {
    const currentList = league.currentChampionList || championList;
    const currentVersion = league.metaVersion || '16.01';

    const [previousData, setPreviousData] = useState(null);

    useEffect(() => {
        const STORAGE_KEY_CURRENT = 'lck_meta_current';
        const STORAGE_KEY_PREV = 'lck_meta_previous';

        try {
            const storedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT);
            const parsedCurrent = storedCurrent ? JSON.parse(storedCurrent) : null;

            if (!parsedCurrent) {
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
                    version: currentVersion,
                    list: currentList
                }));
            } else if (parsedCurrent.version !== currentVersion) {
                localStorage.setItem(STORAGE_KEY_PREV, JSON.stringify(parsedCurrent));
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
                    version: currentVersion,
                    list: currentList
                }));
                setPreviousData(parsedCurrent.list);
            } else {
                const storedPrev = localStorage.getItem(STORAGE_KEY_PREV);
                if (storedPrev) {
                    setPreviousData(JSON.parse(storedPrev).list);
                }
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

    // Compute relevant synergies for the current role's champion names
    const relevantSynergies = useMemo(() => {
        const roleChampNames = new Set(sortedCurrentList.map(c => c.name));

        return SYNERGIES
            .filter(syn => syn.champions.some(name => roleChampNames.has(name)))
            .map(syn => {
                const inMeta = syn.champions.filter(name => roleChampNames.has(name));
                const external = syn.champions.filter(name => !roleChampNames.has(name));
                return { ...syn, inMeta, external };
            })
            // Prioritise synergies where more role champions are involved, then by multiplier
            .sort((a, b) => b.inMeta.length - a.inMeta.length || b.multiplier - a.multiplier)
            .slice(0, 20);
    }, [sortedCurrentList]);

    // Multiplier → strength label + colour
    const getSynergyStrength = (multiplier) => {
        if (multiplier >= 1.10) return { label: 'S', bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' };
        if (multiplier >= 1.07) return { label: 'A', bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
        if (multiplier >= 1.05) return { label: 'B', bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
        return { label: 'C', bg: 'bg-gray-100', text: 'text-gray-500', bar: 'bg-gray-400' };
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6 lg:p-8 min-h-[50vh] flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> {currentVersion} 패치 메타
                </h2>
                {/* Role Selector */}
                <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar justify-center sm:justify-start">
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
            </div>

            {/* Main Content: Champion List + Synergies Sidebar */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Champion List */}
                <div className="flex-1 grid grid-cols-1 gap-3 sm:gap-4 content-start">
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

                {/* Synergies Sidebar */}
                <div className="lg:w-72 xl:w-80 flex-shrink-0">
                    <div className="sticky top-4 border rounded-xl p-4 bg-gray-50">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <span>⚡</span> {metaRole} 시너지
                        </h3>

                        {relevantSynergies.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-6">시너지 데이터 없음</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {relevantSynergies.map((syn, i) => {
                                    const { label, bg, text, bar } = getSynergyStrength(syn.multiplier);
                                    const pct = Math.round((syn.multiplier - 1) * 1000) / 10; // e.g. 1.07 → 7.0

                                    return (
                                        <div key={i} className="bg-white border rounded-lg p-2.5 hover:border-purple-200 transition">
                                            {/* Grade + Champions */}
                                            <div className="flex items-start gap-2">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${bg} ${text}`}>
                                                    {label}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    {/* Highlight in-meta champions, dim external */}
                                                    <div className="text-xs font-semibold text-gray-800 leading-snug">
                                                        {syn.champions.map((name, ci) => (
                                                            <span key={ci}>
                                                                {ci > 0 && <span className="text-gray-300 mx-0.5">+</span>}
                                                                <span className={syn.inMeta.includes(name) ? 'text-purple-700' : 'text-gray-400'}>
                                                                    {name}
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {/* Strength bar */}
                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${bar}`}
                                                                style={{ width: `${Math.min(pct * 7, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[10px] font-bold ${text}`}>+{pct}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MetaTab;