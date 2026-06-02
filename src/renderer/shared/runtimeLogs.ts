import { LogEntry, LogType, LogLevel, LogStatus } from './types/types';

type Listener = (logs: LogEntry[]) => void;

let runtimeLogs: LogEntry[] = [];
const listeners = new Set<Listener>();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    listener(runtimeLogs);
  });
};

export const getRuntimeLogs = (): LogEntry[] => runtimeLogs;

export const subscribeToRuntimeLogs = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(runtimeLogs);
  return () => {
    listeners.delete(listener);
  };
};

export const initializeRuntimeLogs = (initialLogs: LogEntry[]): void => {
  if (runtimeLogs.length === 0 && initialLogs.length > 0) {
    runtimeLogs = [...initialLogs];
    notifyListeners();
  }
};

interface AddRuntimeLogParams {
  type: LogType;
  level: LogLevel;
  status: LogStatus;
  message: string;
}

export const addRuntimeLog = ({ type, level, status, message }: AddRuntimeLogParams): void => {
  if (!message) return;

  const timestamp = new Date().toLocaleTimeString('id-ID', {
    hour12: true,
  });

  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    type,
    level,
    message,
    status,
  };

  runtimeLogs = [...runtimeLogs, entry];
  notifyListeners();
};

export const clearRuntimeLogs = (): void => {
  runtimeLogs = [];
  notifyListeners();
};

export const resetRuntimeLogs = (initialLogs: LogEntry[]): void => {
  runtimeLogs = [...initialLogs];
  notifyListeners();
};
