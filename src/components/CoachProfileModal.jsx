// src/components/CoachProfileModal.jsx
import React, { useState } from 'react';
import { TEAM_COLORS } from '../data/constants';

const ROLE_LABELS = {
    '감독': { icon: '🎯', color: '#1d4ed8' },
    '코치': { icon: '📋', color: '#15803d' },
    '분석가': { icon: '📊', color: '#7e22ce' },
    '트레이너': { icon: '💪', color: '#c2410c' },
};

const getTitleIcon = (t = '') => {
    t = t.toLowerCase();
    if (t.includes('월드 챔피언십') || t.includes('worlds') || t.includes('월챔')) return '🌍';
    if (t.includes('msi')) return '🌐';
    if (t.includes('ewc')) return '⚡';
    if (t.includes('asi') || t.includes('fst')) return '🌏';
    if (t.includes('lck')) return '🏆';
    if (t.includes('라이벌') || t.includes('rift')) return '🤝';
    if (t.includes('아시안')) return '🎖️';
    return '🥇';
};

const Tag = ({ children, color }) => (
    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white ml-1" style={{ backgroundColor: color }}>{children}</span>
);

const AwardRow = ({ year, icon = '🎖️', label, team, role, roleColor }) => (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-xs font-black text-gray-400 w-10 shrink-0">{year}</span>
        <span>{icon}</span>
        <span className="flex-1 text-sm font-bold text-gray-800">{label}</span>
        {team && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{team}</span>}
        {role && <Tag color={roleColor || '#6b7280'}>{role}</Tag>}
    </div>
);

const Section = ({ title, children, span2 }) => (
    <div className={`bg-white rounded-xl p-4 border shadow-sm${span2 ? ' sm:col-span-2' : ''}`}>
        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{title}</div>
        {children}
    </div>
);

const Empty = ({ msg = '기록이 없습니다.' }) => (
    <div className="text-sm text-gray-400 text-center py-4">{msg}</div>
);

function HoverBadge({ icon, label, count, tooltip }) {
    const [pos, setPos] = useState(null);
    const ref = React.useRef(null);

    const handleEnter = () => {
        if (ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ x: r.left, y: r.top });
        }
    };

    return (
        <div ref={ref} className="relative flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3 border min-w-[80px] cursor-default"
            onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)}>
            <span className="text-2xl">{icon}</span>
            {count > 1 && <span className="text-2xl font-black text-blue-600">{'×'}{count}</span>}
            <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
            {pos && tooltip?.length > 0 && (
                <div className="pointer-events-none z-[9999] bg-gray-900 text-white text-[11px] font-bold rounded-lg px-3 py-2 shadow-xl"
                    style={{ position: 'fixed', left: Math.min(pos.x, window.innerWidth - 220), top: pos.y - 8, transform: 'translateY(-100%)' }}>
                    {tooltip.map((t, i) => <div key={i} className="py-0.5 border-b border-white/10 last:border-0 whitespace-nowrap">{t}</div>)}
                </div>
            )}
        </div>
    );
}

function TrophyBadge({ icon, label, count, color, years }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3 border min-w-[80px] cursor-default"
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <span className="text-2xl">{icon}</span>
            <span className="text-2xl font-black" style={{ color }}>{'×'}{count}</span>
            <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
            {hovered && years?.length > 0 && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-bold rounded-lg px-3 py-2 whitespace-nowrap z-50 shadow-xl pointer-events-none">
                    {years.join(' · ')}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
}

export default function CoachProfileModal({ coach, onClose }) {
    const [tab, setTab] = useState('overview');
    if (!coach) return null;

    const teamColor = TEAM_COLORS[coach.팀] || '#3b82f6';
    const roleInfo = ROLE_LABELS[coach.역할] || { icon: '👤', color: '#6b7280' };
    const titles       = coach.수상?.팀_타이틀  || {};
    const coachTitles  = coach.수상?.코치_우승  || [];
    const coachAwards  = [...(coach.수상?.코치_어워드 || []), ...(coach.수상?.개인_수상 || [])];
    const playerTitles = coach.수상?.선수_우승  || [];
    const playerAwards = coach.수상?.선수_어워드 || [];
    const career       = coach.코칭_경력 || [];
    const useOldFormat = coachTitles.length === 0 && (titles.worlds > 0 || titles.lck > 0 || titles.msi > 0);

    const OldTrophies = () => (
        <div className="flex gap-3 flex-wrap">
            {titles.worlds > 0 && <TrophyBadge icon="🌍" label="월드 챔피언십" count={titles.worlds} color="#f59e0b" years={titles.worlds_years} />}
            {titles.msi    > 0 && <TrophyBadge icon="🌐" label="MSI"          count={titles.msi}    color="#6366f1" years={titles.msi_years} />}
            {titles.lck    > 0 && <TrophyBadge icon="🏆" label="LCK 우승"     count={titles.lck}    color="#3b82f6" years={titles.lck_years} />}
        </div>
    );

    // Group coach titles by name for hoverable badge display (like PlayerProfileModal)
    const groupedCoachTitles = coachTitles.reduce((acc, ct) => {
        const key = ct.title;
        if (!acc[key]) acc[key] = { title: ct.title, entries: [] };
        acc[key].entries.push(ct);
        return acc;
    }, {});

    const CoachTitleList = () => {
        if (coachTitles.length === 0) return <Empty />;
        const groups = Object.values(groupedCoachTitles);
        return (
            <div className="flex flex-wrap gap-3">
                {groups.map((g, i) => {
                    const tooltipLines = g.entries.map(e => `${e.year}${e.team ? ' · ' + e.team : ''}${e.역할 ? ' (' + e.역할 + ')' : ''}`);
                    return (
                        <HoverBadge
                            key={i}
                            icon={getTitleIcon(g.title)}
                            label={g.title}
                            count={g.entries.length}
                            tooltip={tooltipLines}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg">
            <div className="bg-white w-full h-full flex flex-col shadow-2xl overflow-hidden rounded-lg">

                {/* Header */}
                <div className="relative flex items-center gap-4 p-4 sm:p-6 shrink-0 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${teamColor}22, ${teamColor}08)`, borderBottom: `2px solid ${teamColor}30` }}>
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle at 80% 50%, ${teamColor}, transparent 60%)` }} />
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-white text-xl sm:text-3xl shrink-0 shadow-lg z-10"
                        style={{ backgroundColor: teamColor }}>
                        {coach.이름?.charAt(0) || '?'}
                    </div>
                    <div className="z-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl sm:text-3xl font-black text-gray-900">{coach.이름}</h2>
                            {coach.풀네임 && <span className="text-sm font-bold text-gray-400">({coach.풀네임})</span>}
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: roleInfo.color }}>{roleInfo.icon} {coach.역할}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{coach.팀}{coach.특성 ? ` · ${coach.특성}` : ''}</div>
                        <div className="text-xs text-gray-400 mt-1">{coach.나이 && `${coach.나이}세${coach.생년월일 ? ` (${coach.생년월일})` : ''}`}{coach.경력 && ` · 경력 ${coach.경력}`}</div>
                    </div>
                    <div className="z-10 hidden sm:flex flex-col items-end gap-1 shrink-0 text-[10px] font-bold">
                        {(useOldFormat ? [
                            titles.worlds > 0 && { icon: '🌍', label: `월즈 ×${titles.worlds}`, color: '#d97706' },
                            titles.lck    > 0 && { icon: '🏆', label: `LCK ×${titles.lck}`,    color: '#2563eb' },
                            titles.msi    > 0 && { icon: '🌐', label: `MSI ×${titles.msi}`,    color: '#7c3aed' },
                        ] : coachTitles.slice(0, 3).map(ct => ({ icon: getTitleIcon(ct.title), label: `${ct.title} ${ct.year}`, color: '#2563eb' })))
                        .filter(Boolean).map((t, i) => <div key={i} style={{ color: t.color }}>{t.icon} {t.label}</div>)}
                        <div className="text-gray-400 mt-1">계약 {coach.계약}</div>
                    </div>
                    <button onClick={onClose} className="z-10 ml-auto sm:ml-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition shrink-0">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    {['overview', 'accolades'].map(id => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`px-4 sm:px-6 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all ${tab === id ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                            {id === 'overview' ? '개요' : '수상경력'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
                    {tab === 'overview' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Section title="코치 정보">
                                {[['팀', coach.팀], ['역할', `${roleInfo.icon} ${coach.역할}`],
                                  ['나이', coach.나이 ? `${coach.나이}세${coach.생년월일 ? ` (${coach.생년월일})` : ''}` : '-'],
                                  ['경력', coach.경력 || '-'], ['소속기간', coach['팀 소속기간'] || '-'], ['계약', coach.계약 || '-'],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between border-b border-gray-50 pb-1.5 last:border-0 text-sm">
                                        <span className="text-gray-400">{k}</span>
                                        <span className="font-bold text-gray-800">{v}</span>
                                    </div>
                                ))}
                            </Section>
                            <Section title="코칭 경력">
                                {career.length > 0 ? career.map((c, i) => {
                                    const ri = ROLE_LABELS[c.역할] || ROLE_LABELS['코치'];
                                    const isCurrent = i === career.length - 1;
                                    return (
                                        <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isCurrent ? teamColor : '#d1d5db' }} />
                                            <div className="flex-1">
                                                <div className="font-bold text-gray-800 text-sm">{c.팀}</div>
                                                <div className="text-[10px] text-gray-400">{c.기간} · {c.리그}</div>
                                            </div>
                                            {c.역할 && <Tag color={ri.color}>{ri.icon} {c.역할}</Tag>}
                                            {isCurrent && <Tag color={teamColor}>현재</Tag>}
                                        </div>
                                    );
                                }) : <Empty msg="경력 데이터가 없습니다." />}
                            </Section>
                            {(useOldFormat || coachTitles.length > 0) && (
                                <Section title="주요 우승 기록" span2>
                                    {useOldFormat ? <OldTrophies /> : <CoachTitleList />}
                                </Section>
                            )}
                        </div>
                    )}
                    {tab === 'accolades' && (
                        <div className="space-y-4">
                            <Section title={`${coach.역할 === '감독' ? '감독' : '코치'} 우승 기록`}>
                                {useOldFormat
                                    ? (titles.worlds > 0 || titles.lck > 0 || titles.msi > 0 ? <OldTrophies /> : <Empty />)
                                    : <CoachTitleList />}
                            </Section>
                            {coachAwards.length > 0 && (
                                <Section title={`${coach.역할 === '감독' ? '감독' : '코치'} 개인 수상`}>
                                    {coachAwards.map((a, i) => <AwardRow key={i} year={a.year} label={a.award} team={a.team} />)}
                                </Section>
                            )}
                            {playerTitles.length > 0 && (
                                <Section title="선수 시절 우승">
                                    {playerTitles.map((pt, i) => <AwardRow key={i} year={pt.year} icon={getTitleIcon(pt.title)} label={pt.title} team={pt.team} />)}
                                </Section>
                            )}
                            {playerAwards.length > 0 && (
                                <Section title="선수 어워드">
                                    {playerAwards.map((pa, i) => <AwardRow key={i} year={pa.year} label={pa.award} team={pa.team} />)}
                                </Section>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}