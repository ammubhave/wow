import {useAppSelector} from "@/store";

import {HoverCard, HoverCardContent, HoverCardTrigger} from "./ui/hover-card";

export function PresencesCard({id}: {id: string}) {
  const presences = useAppSelector(state => state.presences.value)[id] ?? [];
  return (
    <HoverCard openDelay={500}>
      <HoverCardTrigger>
        <span className="text-nowrap cursor-default inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200">
          <svg viewBox="0 0 6 6" aria-hidden="true" className="h-1.5 w-1.5 fill-green-500 shrink-0">
            <circle r={3} cx={3} cy={3} />
          </svg>
          {presences.length} Online
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="flex flex-col gap-1 text-sm font-normal w-fit">
        {presences.map(presence => (
          <div key={presence}>{presence}</div>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
