// src/components/DraftModal.jsx
import React, { useState, useEffect } from 'react';

const DraftModal = ({ leagueId, teams, myTeamId, onDraftComplete }) => {
    // --- STATE ---
    const [draftStatus, setDraftStatus] = useState('ready'); // ready, active, finished
    const [draftPool, setDraftPool] = useState([]);
    const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
    const [draftTurn, setDraftTurn] = useState(null); // 'baron' or 'elder'
    const [message, setMessage] = useState("2026 LCK 컵 조 추첨식에 오신 것을 환영합니다.");

    // --- INITIALIZATION ---
    useEffect(() => {
        initializeDraft();
    }, []);

    const initializeDraft = () => {
        // 1. Identify the two captains (My Team vs Rival)
        const myTeam = teams.find(t => t.id === myTeamId);
        // In this logic, T1 is the fixed rival if you aren't T1. If you are T1, it's GEN.
        let rivalId = 'T1';
        if (myTeamId === 'T1') rivalId = 'GEN';
        
        const rivalTeam = teams.find(t => t.id === rivalId);

        // 2. Set Captains
        const initialGroups = {
            baron: [myTeamId], // You are always Baron Captain
            elder: [rivalId]   // Rival is Elder Captain
        };

        // 3. Create Pool (Everyone else)
        const pool = teams
            .filter(t => t.id !== myTeamId && t.id !== rivalId)
            .map(t => t.id);

        setDraftGroups(initialGroups);
        setDraftPool(pool);
        setDraftStatus('ready');
    };

    // --- LOGIC ---
    const startDraft = () => {
        setDraftStatus('active');
        setDraftTurn('baron'); // You go first
        setMessage("당신의 차례입니다. 팀을 선택하세요!");
    };

    const pickTeam = (teamId, side) => {
        // Add to group
        const newGroups = { ...draftGroups, [side]: [...draftGroups[side], teamId] };
        setDraftGroups(newGroups);
        
        // Remove from pool
        const newPool = draftPool.filter(id => id !== teamId);
        setDraftPool(newPool);

        return { newGroups, newPool };
    };

    const handleUserPick = (teamId) => {
        if (draftTurn !== 'baron') return;

        // 1. User Pick
        const { newGroups, newPool } = pickTeam(teamId, 'baron');
        
        // 2. Check if done
        if (newPool.length === 0) {
            finalizeDraft(newGroups);
            return;
        }

        // 3. Switch to CPU Turn
        setDraftTurn('elder');
        setMessage("상대방(Elder)이 고민 중입니다...");

        // 4. Trigger CPU Pick after delay
        setTimeout(() => {
            const randomPick = newPool[Math.floor(Math.random() * newPool.length)];
            const { newGroups: afterCpuGroups } = pickTeam(randomPick, 'elder');
            
            if (newPool.length - 1 === 0) {
                finalizeDraft(afterCpuGroups);
            } else {
                setDraftTurn('baron');
                setMessage("당신의 차례입니다. 팀을 선택하세요!");
            }
        }, 1000);
    };

    const finalizeDraft = (finalGroups) => {
        setDraftStatus('finished');
        setMessage("조 추첨이 완료되었습니다!");
        
        // Wait a moment then notify Dashboard
        setTimeout(() => {
            onDraftComplete(finalGroups);
        }, 1500);
    };

    // --- RENDER ---
    return (
        <div className="fixed inset-0 z-50 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 text-center shrink-0">
                    <h2 className="text-3xl font-black text-white tracking-widest">2026 LCK CUP GROUP DRAW</h2>
                    <p className="text-blue-200 mt-2 font-bold text-lg animate-pulse">{message}</p>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex gap-4">
                    
                    {/* LEFT: BARON GROUP (USER) */}
                    <div className="flex-1 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex flex-col">
                        <h3 className="text-2xl font-black text-blue-900 mb-4 text-center">🔵 TEAM BARON</h3>
                        <div className="space-y-2 flex-1">
                            {draftGroups.baron.map((tid, i) => {
                                const t = teams.find(team => team.id === tid);
                                return (
                                    <div key={tid} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex items-center justify-between">
                                        <span className="font-bold text-lg text-gray-800">{i+1}. {t.name}</span>
                                        {i === 0 && <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">CAPTAIN</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* MIDDLE: POOL */}
                    <div className="w-1/3 flex flex-col gap-3">
                        {draftStatus === 'ready' ? (
                            <button 
                                onClick={startDraft}
                                className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl font-black text-2xl hover:scale-[1.02] transition shadow-lg flex flex-col items-center justify-center gap-2"
                            >
                                <span>START DRAW</span>
                                <span className="text-sm font-normal opacity-75">조 추첨 시작하기</span>
                            </button>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2">
                                {draftPool.map(tid => {
                                    const t = teams.find(team => team.id === tid);
                                    const isMyTurn = draftTurn === 'baron';
                                    return (
                                        <button 
                                            key={tid}
                                            disabled={!isMyTurn}
                                            onClick={() => handleUserPick(tid)}
                                            className={`p-4 rounded-lg font-bold text-left transition shadow-sm border ${
                                                isMyTurn 
                                                ? 'bg-white hover:bg-blue-600 hover:text-white border-gray-200 cursor-pointer' 
                                                : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                                            }`}
                                        >
                                            {t.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: ELDER GROUP (RIVAL) */}
                    <div className="flex-1 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex flex-col">
                        <h3 className="text-2xl font-black text-red-900 mb-4 text-center">🔴 TEAM ELDER</h3>
                        <div className="space-y-2 flex-1">
                            {draftGroups.elder.map((tid, i) => {
                                const t = teams.find(team => team.id === tid);
                                return (
                                    <div key={tid} className="bg-white p-4 rounded-lg shadow-sm border border-red-100 flex items-center justify-between">
                                        <span className="font-bold text-lg text-gray-800">{i+1}. {t.name}</span>
                                        {i === 0 && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">CAPTAIN</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DraftModal;