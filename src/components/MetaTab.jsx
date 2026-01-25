// src/components/MetaTab.jsx
import React, { useEffect, useState, useMemo } from 'react';

const MetaTab = ({ league, championList, metaRole, setMetaRole }) => {
    // Safe fallback for the list
    const currentList = league.currentChampionList || championList;
    const currentVersion = league.metaVersion || '16.01';

    // State to hold the "Previous Patch" data for comparison
    const [previousData, setPreviousData] = useState(null);

    // Effect: Handle Data Persistence and Versioning
    useEffect(() => {
        const STORAGE_KEY_CURRENT = 'lck_meta_current';
        const STORAGE_KEY_PREV = 'lck_meta_previous';

        try {
            const storedCurrent = localStorage.getItem(STORAGE_KEY_CURRENT);
            const parsedCurrent = storedCurrent ? JSON.parse(storedCurrent) : null;

            if (!parsedCurrent) {
                // Scenario 1: First time running. Save current as "Current".
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
                    version: currentVersion,
                    list: currentList
                }));
            } else if (parsedCurrent.version !== currentVersion) {
                // Scenario 2: Version changed (e.g., 16.01 -> 16.02).
                // 1. Move the old "Current" to "Previous".
                localStorage.setItem(STORAGE_KEY_PREV, JSON.stringify(parsedCurrent));
                // 2. Save the new data as "Current".
                localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
                    version: currentVersion,
                    list: currentList
                }));
                // 3. Set state so we can render diffs immediately
                setPreviousData(parsedCurrent.list);
            } else {
                // Scenario 3: Same version (reload). Load "Previous" if it exists to show diffs.
                const storedPrev = localStorage.getItem(STORAGE_KEY_PREV);
                if (storedPrev) {
                    setPreviousData(JSON.parse(storedPrev).list);
                }
            }
        } catch (error) {
            console.error("Failed to sync meta history:", error);
        }
    }, [currentVersion, currentList]);

    // Helper: Calculate Rank Change
    // Returns: { diff: number | null, isNew: boolean }
    const getRankChange = (champId, currentRankIdx) => {
        if (!previousData) return { diff: null, isNew: false };

        // 1. Filter previous list to get the ranking context of the SAME ROLE
        const prevRoleList = previousData
            .filter(c => c.role === metaRole)
            .sort((a, b) => a.tier - b.tier);

        // 2. Find index in previous list
        const prevIdx = prevRoleList.findIndex(c => c.id === champId);

        if (prevIdx === -1) return { diff: null, isNew: true }; // Was not in the list before

        // 3. Calculate Diff (Positive means climbed: Prev 5 -> Curr 2 = +3)
        // Note: Indices are 0-based, so logic is same.
        return { diff: prevIdx - currentRankIdx, isNew: false };
    };

    // Filter and sort current list once per render/role change
    const sortedCurrentList = useMemo(() => {
        return currentList
            .filter(c => c.role === metaRole)
            .sort((a, b) => a.tier - b.tier);
    }, [currentList, metaRole]);

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

            {/* Champion List */}
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
                                    
                                    {/* Rank Change Indicator */}
                                    <div className="text-[10px] font-bold mt-1">
                                        {isNew ? (
                                            <span className="text-purple-600 bg-purple-50 px-1 rounded">NEW</span>
                                        ) : diff > 0 ? (
                                            <span className="text-green-600 flex items-center">
                                                ▲ {diff}
                                            </span>
                                        ) : diff < 0 ? (
                                            <span className="text-red-500 flex items-center">
                                                ▼ {Math.abs(diff)}
                                            </span>
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
        </div>
    );
};

export default MetaTab;