import { ChevronRight, ExternalLink } from "lucide-react";
import { HazardIcon, SeverityBadge } from "../lib/hazards";
import { timeAgo } from "../lib/geo";
import { openPlace } from "../lib/router";
import { eventPageName, type DisasterEvent } from "../services/events";

export function EventPreview({ event }: { event: DisasterEvent }) {
  return (
    <div className="pb-2">
      <div className="flex items-start gap-3">
        <HazardIcon type={event.type} filled size={20} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">{event.title}</p>
          <p className="text-[13px] text-muted">{event.place}</p>
          <p className="mt-1 text-[12px] text-muted">
            {timeAgo(event.time)} · {event.detail} · {event.source}
          </p>
        </div>
        <SeverityBadge severity={event.severity} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openPlace({ lat: event.lat, lon: event.lon, name: eventPageName(event), event: event.id })}
          className="flex items-center justify-center gap-1 rounded-xl bg-indigo-500 py-3 text-[14px] font-semibold text-white"
        >
          View details <ChevronRight size={16} />
        </button>
        <a href={event.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-3 text-[14px] font-semibold text-ink">
          Source <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
