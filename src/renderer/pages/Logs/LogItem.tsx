// src/pages/Logs/LogItem.tsx
import React from 'react';
import { LogEntry, LogStatus } from '../../shared/types/types';
import { CheckmarkCircleIcon, InfoCircleIcon, WrenchIcon, NavigationIcon } from './LogsConstants';

interface LogItemProps {
  log: LogEntry;
}

const statusColors: Record<LogStatus, string> = {
  [LogStatus.Success]: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  [LogStatus.Error]: 'bg-red-500/10 text-red-300 border-red-500/40',
  [LogStatus.Pending]: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/40',
};

const LogItem: React.FC<LogItemProps> = ({ log }) => {
  const { timestamp, type, level, message, status } = log;

  const renderTypeIcon = () => {
    if (type === 'SYSTEM') return <WrenchIcon />;
    if (type === 'NAVIGATION') return <NavigationIcon />;
    return <InfoCircleIcon />;
  };

  const renderStatusIcon = () => {
    if (status === LogStatus.Success) return <CheckmarkCircleIcon />;
    if (status === LogStatus.Error) return <span className="ml-2 text-red-400 font-bold">!</span>;
    return <span className="ml-2 text-yellow-300 font-bold">…</span>;
  };

  return (
    <div
      className="mb-3 p-3 rounded-lg bg-zinc-800/80 border border-zinc-700/70 shadow-sm hover:bg-zinc-800 transition-colors duration-150"
      style={{
        backgroundColor: '#181818',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
        backgroundSize: '12px 12px, 12px 12px, 100% 100%',
        backgroundBlendMode: 'overlay, overlay, normal',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center text-xs text-gray-400">
          <span>{timestamp}</span>
          <span className="mx-2 text-gray-600">•</span>
          <span className="uppercase tracking-wide text-[11px] text-gray-300 flex items-center">
            {renderTypeIcon()}
            <span className="ml-1">{type}</span>
          </span>
          <span className="mx-2 text-gray-600">•</span>
          <span className="uppercase tracking-wide text-[11px] text-gray-300">{level}</span>
        </div>
        <div
          className={`ml-4 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            statusColors[status] || 'bg-zinc-700 text-gray-200 border-zinc-500/60'
          }`}
        >
          <span className="inline-flex items-center">
            <span>{status}</span>
            {renderStatusIcon()}
          </span>
        </div>
      </div>
      <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{message}</div>
    </div>
  );
};

export default LogItem;
