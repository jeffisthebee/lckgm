// src/components/FinalStandingsModal.jsx
import React from 'react';
import { calculateFinalStandings } from '../engine/BracketManager';

const FinalStandingsModal = ({ league, onClose }) => {
    // Safety check
    if (!league) return null;

    try {
        const standings = calculateFinalStandings(league);
        
        return (
            <div className="absolute inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
                    <div className="bg-gray-900 p-6 text-center relative">
                        <h2 className="text-3xl font-black text-yellow-400">🏆 2026 LCK CUP FINAL STANDINGS</h2>
                        <button 
                            onClick={onClose}
                            className="absolute top-6 right-6 text-gray-400 hover:text-white font-bold"
                        >
                            ✕ 닫기
                        </button>
                    </div>
                    <div className="p-0 overflow-y-auto max-h-[70vh]">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b">
                                <tr>
                                    <th className="p-4 text-center w-20">순위</th>
                                    <th className="p-4">팀</th>
                                    <th className="p-4 text-right">상금 (확정)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {standings.length > 0 ? standings.map((item) => (
                                    <tr key={item.team.id} className={`${item.rank === 1 ? 'bg-yellow-50' : 'bg-white'}`}>
                                        <td className="p-4 text-center">
                                            {item.rank === 1 ? <span className="text-2xl">🥇</span> : 
                                             item.rank === 2 ? <span className="text-2xl">🥈</span> : 
                                             item.rank === 3 ? <span className="text-2xl">🥉</span> : 
                                             <span className="font-bold text-gray-500 text-lg">{item.rank}위</span>}
                                        </td>
                                        <td className="p-4 flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-lg" 
                                                 style={{backgroundColor: item.team.colors?.primary || '#333'}}>
                                                {item.team.name}
                                            </div>
                                            <div>
                                                <div className="font-black text-xl text-gray-800 flex items-center gap-2">
                                                    {item.team.fullName}
                                                    {item.rank <= 2 && (
                                                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm animate-pulse">
                                                            FST 진출
                                                        </span>
                                                    )}
                                                </div>
                                                {item.rank === 1 && <div className="text-xs font-bold text-yellow-600 bg-yellow-100 inline-block px-2 py-0.5 rounded mt-1">CHAMPION</div>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-600">
                                            {item.rank === 1 ? '0.5억' : 
                                             item.rank === 2 ? '0.25억' : 
                                             item.rank === 3 ? '0.2억' : '0.1억'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="3" className="p-8 text-center text-gray-500">순위 데이터 계산 중 오류가 발생했습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 text-center border-t">
                        <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-white font-bold rounded hover:bg-gray-700">확인</button>
                    </div>
                </div>
            </div>
        );
    } catch (err) {
        console.error(err);
        return null; 
    }
};

export default FinalStandingsModal;