import {Chip, Tooltip} from "@heroui/react";
import {TimerIcon} from "lucide-react";
import {useNow} from "use-intl";

import {useWorkspace} from "@/hooks/use-workspace";

/** In the viewer's own time zone. */
const timeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "2d 4h", "3h 12m", "8m". */
function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * The hunt clock in the header, if the workspace set hunt times (they're optional): time until the
 * start, then time elapsed (and left, with an end time), then "Hunt over".
 */
export function HuntClock() {
  const {huntStartsAt, huntEndsAt} = useWorkspace();
  const now = useNow({updateInterval: 30_000}).getTime();
  if (!huntStartsAt && !huntEndsAt) return null;
  const start = huntStartsAt ? new Date(huntStartsAt).getTime() : undefined;
  const end = huntEndsAt ? new Date(huntEndsAt).getTime() : undefined;

  let label: string;
  if (start !== undefined && now < start) label = `Starts in ${formatDuration(start - now)}`;
  else if (end !== undefined && now >= end) label = "Hunt over";
  else if (end !== undefined) label = `${formatDuration(end - now)} left`;
  else label = `${formatDuration(now - start!)} in`;

  const details = [
    start !== undefined && `Starts ${timeFormat.format(start)}`,
    end !== undefined && `Ends ${timeFormat.format(end)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <Chip size="sm" variant="secondary" className="hidden gap-1 tabular-nums sm:inline-flex">
          <TimerIcon className="size-3.5" />
          <Chip.Label>{label}</Chip.Label>
        </Chip>
      </Tooltip.Trigger>
      <Tooltip.Content>{details}</Tooltip.Content>
    </Tooltip>
  );
}
