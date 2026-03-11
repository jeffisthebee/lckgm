// src/components/CoachProfileModal.jsx
import React, { useState } from 'react';
import { TEAM_COLORS } from '../data/constants';

const ROLE_LABELS = {
    '감독':   { icon: '🎯', color: '#1d4ed8' },
    '코치':   { icon: '📋', color: '#15803d' },
    '분석가': { icon: '📊', color: '#7e22ce' },
    '트레이너': { icon: '💪', color: '#c2410c' },
};

const getTitleIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('worlds') || t.includes('월챔') || t.includes('월드 챔피언십') || t.includes('world')) return '🌍';
    if (t.includes('msi')) return '🌐';
    if (t.includes('ewc')) return '⚡';
    if (t.includes('asi')) return '🌏';
    if (t.includes('fst')) return '🌍';
    if (t.includes('lck')) return '🏆';
    if (t.includes('rift') || t.includes('라이벌')) return '🤝';
    if (t.includes('iem')) return '🥇';
    if (t.includes('mlg') || t.includes('nlb') || t.includes('클럽')) return '🥇';
    if (t.includes('아시안')) return '🎖️';
    return '🥇';
};

function TrophyBadge({ icon, label, count, color, years }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className="relative flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3 border min-w-[80px] cursor-default"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span className="text-2xl">{icon}</span>
            <span className="text-2xl font-black" style={{ color }}>×{count}</span>
            <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
            {hovered && years && years.length > 0 && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-bold rounded-lg px-3 py-2 whitespace-nowrap z-50 shadow-xl pointer-events-none">
                    {years.join(' · ')}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
}

function TitleRow({ icon, title, year, team }) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs font-black text-gray-400 w-10 shrink-0">{year}</span>
            <span className="text-base">{icon}</span>
            <span className="flex-1 text-sm font-bold text-gray-800">{title}</span>
            {team && (
                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{team}</span>
            )}
        </div>
    );
}

export default function CoachProfileModal({ coach, onClose }) {
    const [tab, setTab] = useState('overview');

    if (!coach) return null;

    const teamColor = TEAM_COLORS[coach.팀] || '#3b82f6';
    const roleInfo = ROLE_LABELS[coach.역할] || { icon: '👤', color: '#6b7280' };

    // Support both old-format (팀_타이틀 object) and new-format (individual arrays)
    const titles = coach.수상?.팀_타이틀 || {};
    const coachTitles  = coach.수상?.코치_우승   || [];
    const coachAwards  = coach.수상?.코치_어워드  || [];
    const playerTitles = coach.수상?.선수_우승   || [];
    const playerAwards = coach.수상?.선수_어워드  || [];
    const legacyAwards = coach.수상?.개인_수상   || [];

    const useOldFormat = coachTitles.length === 0 && (titles.worlds > 0 || titles.lck > 0 || titles.msi > 0);

    const career = coach.코칭_경력 || [];

    const TABS = [
        { id: 'overview',  label: '개요' },
        { id: 'accolades', label: '수상경력' },
    ];

    // Header quick-titles
    const headerTitles = useOldFormat
        ? [
            titles.worlds > 0 && { icon: '🌍', label: `월즈 ×${titles.worlds}`, color: '#d97706' },
            titles.lck    > 0 && { icon: '🏆', label: `LCK ×${titles.lck}`,    color: '#2563eb' },
            titles.msi    > 0 && { icon: '🌐', label: `MSI ×${titles.msi}`,    color: '#7c3aed' },
          ].filter(Boolean)
        : coachTitles.slice(0, 3).map(ct => ({ icon: getTitleIcon(ct.title), label: `${ct.title} ${ct.year}`, color: '#2563eb' }));

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg">
            <div className="bg-white w-full h-full flex flex-col shadow-2xl overflow-hidden rounded-lg">

                {/* ── Header ── */}
                <div
                    className="relative flex items-center gap-4 p-4 sm:p-6 shrink-0 overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${teamColor}22, ${teamColor}08)`,
                        borderBottom: `2px solid ${teamColor}30`
                    }}
                >
                    <div className="absolute inset-0 opacity-5"
                        style={{ backgroundImage: `radial-gradient(circle at 80% 50%, ${teamColor}, transparent 60%)` }} />

                    {/* Avatar */}
                    <div
                        className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-white text-xl sm:text-3xl shrink-0 shadow-lg z-10"
                        style={{ backgroundColor: teamColor }}
                    >
                        {coach.이름?.charAt(0) || '?'}
                    </div>

                    <div className="z-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl sm:text-3xl font-black text-gray-900 leading-tight">{coach.이름}</h2>
                            {coach.풀네임 && (
                                <span className="text-sm sm:text-base font-bold text-gray-400">({coach.풀네임})</span>
                            )}
                            <span
                                className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: roleInfo.color }}
                            >
                                {roleInfo.icon} {coach.역할}
                            </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                            {coach.팀}{coach.특성 ? ` · ${coach.특성}` : ''}
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-gray-400">
                            {coach.나이 && (
                                <span>{coach.나이}세{coach.생년월일 ? ` (${coach.생년월일})` : ''}</span>
                            )}
                            {coach.경력 && <span>경력 {coach.경력}</span>}
                        </div>
                    </div>

                    {/* Quick titles */}
                    <div className="z-10 hidden sm:flex flex-col items-end gap-1 shrink-0">
                        {headerTitles.map((t, i) => (
                            <div key={i} className="text-[10px] font-bold" style={{ color: t.color }}>
                                {t.icon} {t.label}
                            </div>
                        ))}
                        <div className="text-[10px] text-gray-400 mt-1">계약 {coach.계약}</div>
                    </div>

                    <button
                        onClick={onClose}
                        className="z-10 ml-auto sm:ml-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Tab bar ── */}
                <div className="flex border-b bg-gray-50 shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 ${
                                tab === t.id
                                    ? 'border-blue-500 text-blue-600 bg-white'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">

                    {/* ═══ OVERVIEW ═══ */}
                    {tab === 'overview' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Personal info */}
                            <div className="bg-white rounded-xl p-4 border shadow-sm">
                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">코치 정보</div>
                                <div className="space-y-2 text-sm">
                                    {[
                                        ['팀',      coach.팀],
                                        ['역할',    `${roleInfo.icon} ${coach.역할}`],
                                        ['나이',    coach.나이 ? `${coach.나이}세${coach.생년월일 ? ` (${coach.생년월일})` : ''}` : '-'],
                                        ['경력',    coach.경력 || '-'],
                                        ['소속기간', coach['팀 소속기간'] || '-'],
                                        ['계약',    coach.계약 || '-'],
                                    ].map(([label, val]) => (
                                        <div key={label} className="flex justify-between border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                                            <span className="text-gray-400 font-medium">{label}</span>
                                            <span className="font-bold text-gray-800">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Career timeline */}
                            <div className="bg-white rounded-xl p-4 border shadow-sm">
                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">코칭 경력</div>
                                {career.length > 0 ? (
                                    <div className="space-y-1">
                                        {career.map((c, i) => {
                                            const isCurrent = i === career.length - 1;
                                            const entryRoleInfo = ROLE_LABELS[c.역할] || ROLE_LABELS['코치'];
                                            return (
                                                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: isCurrent ? teamColor : '#d1d5db' }}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-bold text-gray-800 text-sm">{c.팀}</div>
                                                        <div className="text-[10px] text-gray-400">{c.기간} · {c.리그}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {c.역할 && (
                                                            <span
                                                                className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
                                                                style={{ backgroundColor: entryRoleInfo.color }}
                                                            >
                                                                {entryRoleInfo.icon} {c.역할}
                                                            </span>
                                                        )}
                                                        {isCurrent && (
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: teamColor }}>현재</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 text-center py-6">경력 데이터가 없습니다.</div>
                                )}
                            </div>

                            {/* Title summary */}
                            {(useOldFormat || coachTitles.length > 0) && (
                                <div className="bg-white rounded-xl p-4 border shadow-sm sm:col-span-2">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">주요 우승 기록</div>
                                    {useOldFormat ? (
                                        <div className="flex gap-3 flex-wrap">
                                            {titles.worlds > 0 && <TrophyBadge icon="🌍" label="월드 챔피언십" count={titles.worlds} color="#f59e0b" years={titles.worlds_years || []} />}
                                            {titles.msi    > 0 && <TrophyBadge icon="🌐" label="MSI"          count={titles.msi}    color="#6366f1" years={titles.msi_years    || []} />}
                                            {titles.lck    > 0 && <TrophyBadge icon="🏆" label="LCK 우승"     count={titles.lck}    color="#3b82f6" years={titles.lck_years    || []} />}
                                        </div>
                                    ) : (
                                        <div>
                                            {coachTitles.map((ct, i) => (
                                                <TitleRow key={i} icon={getTitleIcon(ct.title)} title={ct.title} year={ct.year} team={ct.team} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ ACCOLADES ═══ */}
                    {tab === 'accolades' && (
                        <div className="space-y-4">

                            {/* Coaching titles */}
                            <div className="bg-white rounded-xl p-4 border shadow-sm">
                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                                    {coach.역할 === '감독' ? '감독' : '코치'} 우승 기록
                                </div>
                                {useOldFormat ? (
                                    titles.worlds > 0 || titles.lck > 0 || titles.msi > 0 ? (
                                        <div className="flex flex-wrap gap-3">
                                            {titles.worlds > 0 && <TrophyBadge icon="🌍" label="월드 챔피언십" count={titles.worlds} color="#f59e0b" years={titles.worlds_years || []} />}
                                            {titles.msi    > 0 && <TrophyBadge icon="🌐" label="MSI"          count={titles.msi}    color="#6366f1" years={titles.msi_years    || []} />}
                                            {titles.lck    > 0 && <TrophyBadge icon="🏆" label="LCK 우승"     count={titles.lck}    color="#3b82f6" years={titles.lck_years    || []} />}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-400 text-center py-4">우승 기록이 없습니다.</div>
                                    )
                                ) : (
                                    coachTitles.length > 0 ? (
                                        <div>
                                            {coachTitles.map((ct, i) => (
                                                <TitleRow key={i} icon={getTitleIcon(ct.title)} title={ct.title} year={ct.year} team={ct.team} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-400 text-center py-4">우승 기록이 없습니다.</div>
                                    )
                                )}
                            </div>

                            {/* Coaching awards */}
                            {(coachAwards.length > 0 || legacyAwards.length > 0) && (
                                <div className="bg-white rounded-xl p-4 border shadow-sm">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                                        {coach.역할 === '감독' ? '감독' : '코치'} 개인 수상
                                    </div>
                                    <div className="space-y-1">
                                        {[...coachAwards, ...legacyAwards].map((aw, i) => (
                                            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                                                <span className="text-xs font-black text-gray-400 w-10 shrink-0">{aw.year}</span>
                                                <span className="text-yellow-500">🎖️</span>
                                                <span className="flex-1 text-sm font-bold text-gray-700">{aw.award}</span>
                                                {aw.team && <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{aw.team}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Player titles */}
                            {playerTitles.length > 0 && (
                                <div className="bg-white rounded-xl p-4 border shadow-sm">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">선수 시절 우승</div>
                                    {playerTitles.map((pt, i) => (
                                        <TitleRow key={i} icon={getTitleIcon(pt.title)} title={pt.title} year={pt.year} team={pt.team} />
                                    ))}
                                </div>
                            )}

                            {/* Player awards */}
                            {playerAwards.length > 0 && (
                                <div className="bg-white rounded-xl p-4 border shadow-sm">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">선수 어워드</div>
                                    {playerAwards.map((pa, i) => (
                                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                                            <span className="text-xs font-black text-gray-400 w-10 shrink-0">{pa.year}</span>
                                            <span className="text-yellow-500">🎖️</span>
                                            <span className="flex-1 text-sm font-bold text-gray-700">{pa.award}</span>
                                            {pa.team && <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{pa.team}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}