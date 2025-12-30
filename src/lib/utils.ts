import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Source - https://stackoverflow.com/a
// Posted by Brian Hannay, modified by community. See post 'Timeline' for change history
// Retrieved 2025-12-29, License - CC BY-SA 4.0

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;
const daysPerWeek = 7;
const intervals = {
  week: millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay * daysPerWeek,
  day: millisecondsPerSecond * secondsPerMinute * minutesPerHour * hoursPerDay,
  hour: millisecondsPerSecond * secondsPerMinute * minutesPerHour,
  minute: millisecondsPerSecond * secondsPerMinute,
  second: millisecondsPerSecond,
};
const relativeDateFormat = new Intl.RelativeTimeFormat("en", {style: "long"});

export function formatRelativeTime(createTime: Date): string {
  if (isNaN(createTime.getTime())) {
    return "";
  }
  const diff = createTime - new Date();
  for (const interval in intervals) {
    if (intervals[interval] <= Math.abs(diff)) {
      return relativeDateFormat.format(Math.trunc(diff / intervals[interval]), interval);
    }
  }
  return relativeDateFormat.format(Math.trunc(diff / 1000), "second");
}
