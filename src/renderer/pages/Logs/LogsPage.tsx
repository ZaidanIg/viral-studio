// src/pages/Logs/LogsPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import LogItem from './LogItem';
import { LogEntry, LogType, LogLevel, LogStatus } from '../../shared/types/types';
import { useLanguage } from '../../shared/i18n';

import {
  UnifiedLogsIcon,
  ExportJsonIcon,
  ExportCsvIcon,
  AutoScrollIcon,
  SearchIcon,
  CopyIcon,
  RefreshIcon,
  DropDownArrowIcon,
} from './LogsConstants';
import { ClearDataIcon } from '../../shared/constants/constants';
import Modal from '../../shared/components/Modal';
import { getRuntimeLogs, subscribeToRuntimeLogs, clearRuntimeLogs } from '../../shared/runtimeLogs';

const LOGS_PER_PAGE = 50;

const LogsPage: React.FC = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>(() => getRuntimeLogs());

  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const logsListRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | undefined>(undefined);
  const [modalConfirmButtonText, setModalConfirmButtonText] = useState(t.common.confirm);
  const [modalCancelButtonText, setModalCancelButtonText] = useState(t.common.cancel);
  const [modalConfirmButtonColor, setModalConfirmButtonColor] = useState('bg-blue-600 hover:bg-blue-700');

  useEffect(() => {
    const unsubscribe = subscribeToRuntimeLogs((nextLogs) => {
      setLogs(nextLogs);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      filterType === 'all' ||
      log.type.toLowerCase() === filterType.toLowerCase() ||
      log.level.toLowerCase() === filterType.toLowerCase();

    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.timestamp.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort so that newest logs appear at the top
  const sortedLogs = [...filteredLogs].slice().reverse();
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / LOGS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * LOGS_PER_PAGE;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);

  // If filter changes, always return to first page
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchTerm]);

  // Auto-scroll: in newest-at-top mode, scroll to top
  useEffect(() => {
    if (autoScroll && logsListRef.current) {
      logsListRef.current.scrollTop = 0;
    }
  }, [paginatedLogs, autoScroll]);

  const downloadFile = (data: string, filename: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenModal = (
    title: string,
    message: string,
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string,
    confirmColor?: string,
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOnConfirm(() => onConfirm);
    setModalConfirmButtonText(confirmText || t.common.confirm);
    setModalCancelButtonText(cancelText || t.common.cancel);
    setModalConfirmButtonColor(confirmColor || 'bg-blue-600 hover:bg-blue-700');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalOnConfirm(undefined);
  };

  const handleExportJson = () => {
    const jsonString = JSON.stringify(filteredLogs, null, 2);
    downloadFile(jsonString, 'logs.json', 'application/json');
    handleOpenModal(t.logsPage.exportSuccessTitle, t.logsPage.exportJsonSuccess, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
  };

  const handleExportCsv = () => {
    const headers = ['id', 'timestamp', 'type', 'level', 'message', 'status'];
    const csvRows = filteredLogs.map((log) => {
      const escapedMessage = `"${log.message.replace(/"/g, '""')}"`;
      return `${log.id},${log.timestamp},${log.type},${log.level},${escapedMessage},${log.status}`;
    });
    const csvString = [headers.join(','), ...csvRows].join('\n');
    downloadFile(csvString, 'logs.csv', 'text/csv');
    handleOpenModal(t.logsPage.exportSuccessTitle, t.logsPage.exportCsvSuccess, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
  };

  const handleClearLogs = () => {
    handleOpenModal(
      t.logsPage.confirmClearTitle,
      t.logsPage.confirmClearMsg,
      () => {
        clearRuntimeLogs();
        setSearchTerm('');
        setFilterType('all');

        handleOpenModal(t.logsPage.logsClearedTitle, t.logsPage.logsClearedMsg, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      },
      t.logsPage.clearBtn,
      t.common.cancel,
      'bg-red-600 hover:bg-red-700',
    );
  };

  const handleCopyLogs = () => {
    const logText = filteredLogs
      .map((log) => `${log.timestamp} [${log.type}] [${log.level}] ${log.message} (Status: ${log.status})`)
      .join('\n');
    navigator.clipboard
      .writeText(logText)
      .then(() => {
        handleOpenModal(t.logsPage.logsCopiedTitle, t.logsPage.logsCopiedMsg, undefined, 'OK', undefined, 'bg-green-600 hover:bg-green-700');
      })
      .catch((err) => {
        handleOpenModal(t.logsPage.copyFailedTitle, t.logsPage.copyFailedMsg.replace('{error}', err.message), undefined, 'OK', undefined, 'bg-red-600 hover:bg-red-700');
      });
  };

  const handleRefreshLogs = () => {
    handleOpenModal(
      t.logsPage.logsRefreshedTitle,
      t.logsPage.logsRefreshedMsg,
      undefined,
      'OK',
      undefined,
      'bg-green-600 hover:bg-green-700',
    );
  };

  return (
    <div role="main">
      {/* Header */}
      <div
        className="flex items-center justify-between p-6 bg-zinc-800 rounded-lg mb-6 shadow-md electron-drag select-none"
        style={{
          backgroundColor: '#181818',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
          backgroundSize: '12px 12px, 12px 12px, 100% 100%',
          backgroundBlendMode: 'overlay, overlay, normal',
        }}
      >
        <h2 className="text-xl font-bold text-gray-50 flex items-center">
          <UnifiedLogsIcon />
          {t.logsPage.title.toUpperCase()}
        </h2>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        {t.logsPage.description}
      </p>

      {/* Controls Row 1 */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative">
          <select
            className="block appearance-none w-full bg-zinc-800 border border-zinc-700 text-gray-200 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-zinc-700 focus:border-purple-500 transition-colors duration-200"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label={t.logsPage.allLogs}
          >
            <option value="all">{t.logsPage.allLogs}</option>
            <optgroup label={t.logsPage.byType}>
              <option value={LogType.System}>System</option>
              <option value={LogType.Logs}>Logs</option>
              <option value={LogType.Navigation}>Navigation</option>
            </optgroup>
            <optgroup label={t.logsPage.byLevel}>
              <option value={LogLevel.Info}>Info</option>
              <option value={LogLevel.Success}>Success</option>
              <option value={LogLevel.Warning}>Warning</option>
              <option value={LogLevel.Error}>Error</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <DropDownArrowIcon aria-hidden="true" />
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportJson}
            className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-200 font-medium rounded-lg transition-colors duration-200"
            aria-label={`${t.logsPage.exportLogs} JSON`}
          >
            <ExportJsonIcon />
            {t.logsPage.exportLogs} JSON
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-200 font-medium rounded-lg transition-colors duration-200"
            aria-label={`${t.logsPage.exportLogs} CSV`}
          >
            <ExportCsvIcon />
            {t.logsPage.exportLogs} CSV
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors duration-200
              ${
                autoScroll
                  ? 'btn-glass-primary bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-gray-200'
              }
            `}
            aria-pressed={autoScroll}
            aria-label={`${t.common.autoScroll}: ${autoScroll ? t.logsPage.on : t.logsPage.off}`}
          >
            <AutoScrollIcon />
            {t.common.autoScroll}: {autoScroll ? t.logsPage.on : t.logsPage.off}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon aria-hidden="true" />
        </div>
        <input
          type="text"
          placeholder={t.common.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-zinc-800 text-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
          aria-label={t.common.searchPlaceholder}
        />
      </div>

      {/* Log Summary & Actions */}
      <div className="flex justify-between items-center mb-4 text-sm text-gray-400">
        <div>
          <span className="font-semibold text-gray-200">{t.logsPage.logsCount.replace('{count}', String(logs.length))}</span>
          <span className="ml-4">{t.logsPage.filteredCount.replace('{count}', String(filteredLogs.length))}</span>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleClearLogs}
            className="flex items-center text-gray-400 hover:text-red-500 transition-colors duration-200"
            aria-label={t.logsPage.clearLogs}
          >
            <ClearDataIcon />
            {t.buttons.clear}
          </button>
          <button
            onClick={handleCopyLogs}
            className="flex items-center text-gray-400 hover:text-blue-400 transition-colors duration-200"
            aria-label={t.logsPage.logsCopiedTitle}
          >
            <CopyIcon />
            {t.buttons.copy}
          </button>
          <button
            onClick={handleRefreshLogs}
            className="flex items-center text-gray-400 hover:text-green-400 transition-colors duration-200"
            aria-label={t.logsPage.logsRefreshedTitle}
          >
            <RefreshIcon />
            {t.buttons.refresh}
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div
        ref={logsListRef}
        className="bg-zinc-900 rounded-lg p-4 h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar"
        style={{
          backgroundColor: '#181818',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, transparent 75%, transparent), linear-gradient(0deg, rgba(0,0,0,0.24), rgba(0,0,0,0.24))',
          backgroundSize: '12px 12px, 12px 12px, 100% 100%',
          backgroundBlendMode: 'overlay, overlay, normal',
        }}
        role="list"
        aria-live="polite"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">{t.logsPage.noLogs}</div>
        ) : (
          paginatedLogs.map((log) => <LogItem key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination Controls */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <div>
            {t.common.page} <span className="font-semibold text-gray-200">{safePage}</span> {t.common.of}{' '}
            <span className="font-semibold text-gray-200">{totalPages}</span>
          </div>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 rounded-md border border-zinc-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 hover:text-white transition-colors duration-200"
            >
              {t.buttons.prev}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 rounded-md border border-zinc-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 hover:text-white transition-colors duration-200"
            >
              {t.buttons.next}
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={modalOnConfirm}
        title={modalTitle}
        message={modalMessage}
        confirmButtonText={modalConfirmButtonText}
        cancelButtonText={modalCancelButtonText}
        confirmButtonColor={modalConfirmButtonColor}
      />
    </div>
  );
};

export default LogsPage;
