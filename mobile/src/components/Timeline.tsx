import { useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "./ui";

// The play / scrub / Live control from the mockup. `value` is how far back in time we are
// (0 = now); `max` is the start of the range. Labels are the three tick captions.
export function Timeline({
  value,
  max,
  onChange,
  playing,
  setPlaying,
  labels,
  step = 1,
  formatValue,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  labels: [string, string, string];
  step?: number;
  formatValue: (v: number) => string;
}) {
  // Playing steps forward in time (towards 0) and stops at "now".
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (value <= 0) setPlaying(false);
      else onChange(Math.max(0, value - step));
    }, 600);
    return () => window.clearInterval(timer);
  }, [playing, value, step, onChange, setPlaying]);

  const live = value === 0;
  return (
    <div className="glass-light flex items-center gap-3 rounded-full py-2 pr-2 pl-2 shadow-lg">
      <button
        type="button"
        aria-label={playing ? "Pause replay" : "Play replay"}
        onClick={() => {
          if (!playing && value === 0) onChange(max); // replay from the start
          setPlaying(!playing);
        }}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-900 shadow"
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={max - value}
          onChange={(e) => {
            setPlaying(false);
            onChange(max - Number(e.target.value));
          }}
          aria-label="Time"
          aria-valuetext={formatValue(value)}
          className="h-1.5 w-full cursor-pointer accent-indigo-500"
        />
        <div className="mt-0.5 flex justify-between text-[11px] font-medium text-slate-600">
          {labels.map((l) => <span key={l}>{l}</span>)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          onChange(0);
        }}
        className={cn(
          "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold",
          live ? "bg-white text-slate-900 shadow" : "bg-indigo-500 text-white",
        )}
      >
        {live ? "Live" : formatValue(value)}
      </button>
    </div>
  );
}
