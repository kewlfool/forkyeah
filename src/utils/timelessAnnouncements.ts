import type { TimelessChimeMode } from '../types/models';

export interface TimelessAnnouncementSettings {
  enabled: boolean;
  mode: TimelessChimeMode;
  fromHour: number;
  tillHour: number;
  randomMinute1: number;
  randomMinute2: number;
}

export const setRandomPair = (): { rM1: number; rM2: number } => {
  for (;;) {
    const rM1 = Math.floor(Math.random() * 29) + 1;
    const rM2 = Math.floor(Math.random() * 30) + 30;
    const gap = rM2 - rM1;
    if (gap > 25 && gap < 40) {
      return { rM1, rM2 };
    }
  }
};

export const isValidRandomPair = (rM1: number, rM2: number): boolean => {
  if (!Number.isInteger(rM1) || !Number.isInteger(rM2)) {
    return false;
  }

  if (rM1 < 1 || rM1 > 29) {
    return false;
  }

  if (rM2 < 30 || rM2 > 59) {
    return false;
  }

  const gap = rM2 - rM1;
  return gap > 25 && gap < 40;
};

const DEFAULT_RANDOM_PAIR = setRandomPair();

export const DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS: TimelessAnnouncementSettings = {
  enabled: false,
  mode: 'halfHourly',
  fromHour: 8,
  tillHour: 22,
  randomMinute1: DEFAULT_RANDOM_PAIR.rM1,
  randomMinute2: DEFAULT_RANDOM_PAIR.rM2
};

const CHIME_MODE_ORDER: TimelessChimeMode[] = ['hourly', 'halfHourly', 'random'];
const MAX_SCHEDULED_NOTIFICATIONS = 60;
const SCHEDULE_HORIZON_HOURS = 72;
const scheduledTimers = new Map<string, number>();

export const normalizeHour = (hour: number): number => {
  const rounded = Math.round(hour);
  return ((rounded % 24) + 24) % 24;
};

export const shiftHour = (hour: number, direction: 1 | -1): number => {
  return normalizeHour(hour + direction);
};

export const cycleTimelessChimeMode = (
  mode: TimelessChimeMode,
  direction: 1 | -1
): TimelessChimeMode => {
  const index = CHIME_MODE_ORDER.indexOf(mode);
  const baseIndex = index >= 0 ? index : 0;
  const nextIndex = (baseIndex + direction + CHIME_MODE_ORDER.length) % CHIME_MODE_ORDER.length;
  return CHIME_MODE_ORDER[nextIndex];
};

export const formatHourLabel = (hour: number): string => {
  const normalized = normalizeHour(hour);
  const suffix = normalized >= 12 ? 'pm' : 'am';
  const hour12 = normalized % 12 || 12;
  return `${hour12} ${suffix}`;
};

const formatSpokenLabel = (date: Date): string => {
  const hour = date.getHours() % 12 || 12;
  const minute = date.getMinutes().toString().padStart(2, '0');
  const suffix = date.getHours() >= 12 ? 'PM' : 'AM';
  return `Time announcement: ${hour}:${minute} ${suffix}`;
};

const isMinuteInWindow = (minuteOfDay: number, fromHour: number, tillHour: number): boolean => {
  const start = normalizeHour(fromHour) * 60;
  const end = normalizeHour(tillHour) * 60;

  if (start === end) {
    return true;
  }

  if (start < end) {
    return minuteOfDay >= start && minuteOfDay <= end;
  }

  return minuteOfDay >= start || minuteOfDay <= end;
};

const candidateMinutesForMode = (
  mode: TimelessChimeMode,
  randomPair?: { rM1: number; rM2: number }
): number[] => {
  if (mode === 'hourly') {
    return [0];
  }

  if (mode === 'halfHourly') {
    return [0, 30];
  }

  const { rM1, rM2 } = randomPair ?? setRandomPair();
  return [rM1, rM2];
};

const buildUpcomingDates = (settings: TimelessAnnouncementSettings, now: Date): Date[] => {
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);

  const rows: Date[] = [];

  const initialRandomPair = isValidRandomPair(settings.randomMinute1, settings.randomMinute2)
    ? {
      rM1: settings.randomMinute1,
      rM2: settings.randomMinute2
    }
    : setRandomPair();

  for (let hourOffset = 0; hourOffset <= SCHEDULE_HORIZON_HOURS; hourOffset += 1) {
    if (rows.length >= MAX_SCHEDULED_NOTIFICATIONS) {
      break;
    }

    const hourBase = new Date(cursor.getTime() + hourOffset * 60 * 60 * 1000);
    const minutes = candidateMinutesForMode(
      settings.mode,
      settings.mode === 'random'
        ? hourOffset === 0
          ? initialRandomPair
          : setRandomPair()
        : undefined
    );

    for (const minute of minutes) {
      const at = new Date(hourBase);
      at.setMinutes(minute, 0, 0);

      const timeMs = at.getTime();
      if (timeMs <= now.getTime()) {
        continue;
      }

      const minuteOfDay = at.getHours() * 60 + at.getMinutes();
      if (!isMinuteInWindow(minuteOfDay, settings.fromHour, settings.tillHour)) {
        continue;
      }

      rows.push(at);
      if (rows.length >= MAX_SCHEDULED_NOTIFICATIONS) {
        break;
      }
    }
  }

  rows.sort((a, b) => a.getTime() - b.getTime());
  return rows;
};

const getSpokenFileName = (date: Date): string => {
  const hour12 = date.getHours() % 12 || 12;
  const minute = date.getMinutes();
  return `spoken_${hour12}_${minute}.caf`;
};

const clearBrowserSchedule = (): void => {
  scheduledTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  scheduledTimers.clear();
};

const ensureNotificationPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

const playSpokenAudio = (fileName: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const base = import.meta.env.BASE_URL ?? '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  const url = `${normalized}sounds/${fileName}`;
  new Audio(url).play().catch(() => undefined);
};

const notifySpoken = (date: Date): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const notification = new Notification('Forkyeah Timeless', {
    body: formatSpokenLabel(date)
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

export const syncTimelessAnnouncements = async (
  settings: TimelessAnnouncementSettings
): Promise<void> => {
  clearBrowserSchedule();

  if (!settings.enabled) {
    return;
  }

  const upcomingDates = buildUpcomingDates(settings, new Date());
  if (upcomingDates.length < 1) {
    return;
  }

  await ensureNotificationPermission();

  upcomingDates.forEach((at) => {
    const timeoutMs = at.getTime() - Date.now();
    if (timeoutMs <= 0) {
      return;
    }

    const key = String(at.getTime());
    const timerId = window.setTimeout(() => {
      notifySpoken(at);
      playSpokenAudio(getSpokenFileName(at));
      scheduledTimers.delete(key);
    }, timeoutMs);

    scheduledTimers.set(key, timerId);
  });
};
