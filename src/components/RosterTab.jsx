// src/components/RosterTab.jsx
import React from 'react';

const getOvrBadgeStyle = (ovr) => {
    if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
    if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
    if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
    if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
    return 'bg-green-100 text-green-700 border-green-300 ring-green-200';
};

const getPotBadgeStyle = (pot) => {
    if (pot >= 95) return 'text-purple-600 font-black'; 
    if (pot >= 90) return 'text-blue-600 font-bold'; 
    return 'text-gray-500 font-medium';
};

const RosterTab = ({ viewingTeam, roster, onPrevTeam, onNextTeam }) => {
    return (
        <div className="bg-white rounded-lg border shadow-sm flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-4">
                    <button onClick={onPrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>
                            {viewingTeam.name}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2>
                            <p className="text-sm font-bold text-gray-500 mt-1">상세 로스터 및 계약 현황</p>
                        </div>
                    </div>
                    <button onClick={onNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left table-fixed">
                    <thead className="bg-white text-gray-500 uppercase font-bold border-b">
                        <tr>
                            <th className="py-2 px-2 bg-gray-50 w-[12%]">정보</th>
                            <th className="py-2 px-1 text-center w-[5%]">OVR</th>
                            <th className="py-2 px-1 text-center w-[5%]">나이</th>
                            <th className="py-2 px-1 text-center w-[5%]">경력</th>
                            <th className="py-2 px-1 text-center w-[6%]">소속</th>
                            <th className="py-2 px-1 text-center w-[8%]">연봉</th>
                            <th className="py-2 px-1 text-center bg-gray-50 border-l w-[6%]">라인</th>
                            <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">무력</th>
                            <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">한타</th>
                            <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">성장</th>
                            <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">안정</th>
                            <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">운영</th>
                            <th className="py-2 px-1 text-center bg-gray-50 border-l text-purple-600 w-[6%]">POT</th>
                            <th className="py-2 px-2 text-left bg-gray-50 border-l w-[12%]">계약 정보</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {roster.map((p, i) => (
                            <tr key={i} className="hover:bg-blue-50/30 transition group">
                                <td className="py-2 px-2 bg-white group-hover:bg-blue-50/30">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-400 w-6">{p.포지션}</span>
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-gray-900 truncate">{p.이름} {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</div>
                                            <div className="text-[10px] text-gray-400 truncate">{p.특성}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                <td className="py-2 px-1 text-center border-l font-medium text-gray-600">{p.상세?.라인전 || '-'}</td>
                                <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.무력 || '-'}</td>
                                <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.한타 || '-'}</td>
                                <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.성장 || '-'}</td>
                                <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.안정성 || '-'}</td>
                                <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.운영 || '-'}</td>
                                <td className="py-2 px-1 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                <td className="py-2 px-2 border-l"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold block truncate">{p.계약}</span></td>
                            </tr>
                        ))} 
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RosterTab;