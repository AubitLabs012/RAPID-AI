import { Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { useDashboardStore } from "../../store";

const labels = ["May 20", "May 21", "May 22", "May 23", "May 24", "May 25", "Today"];

export function TimelineControl() {
  const timelineValue = useDashboardStore((state) => state.timelineValue);
  const setTimelineValue = useDashboardStore((state) => state.setTimelineValue);

  return (
    <div className="timeline-control" aria-label="Historical playback timeline">
      <Button variant="icon" type="button" aria-label="Play historical playback"><Play size={16} /></Button>
      <div>
        <input
          aria-label="Historical playback day"
          type="range"
          min="0"
          max="6"
          value={timelineValue}
          onChange={(event) => setTimelineValue(Number(event.target.value))}
        />
        <div className="timeline-labels">{labels.map((label) => <span key={label}>{label}</span>)}</div>
      </div>
      <span>1x</span>
      <Button variant="icon" type="button" aria-label="Pause historical playback"><Pause size={15} /></Button>
    </div>
  );
}
