import { CloudRain, Flame, Mountain, Triangle, Waves, Wind, Activity, Thermometer, type LucideIcon } from "lucide-react";

// "Disaster Guide" content: short, standard safety advice (based on NDMA / common public guidance).
export type Guide = {
  id: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  tint: string;
  before: string[];
  during: string[];
  after: string[];
};

export const GUIDES: Guide[] = [
  {
    id: "earthquake",
    label: "Earthquake",
    Icon: Activity,
    color: "#e5484d",
    tint: "#fdecec",
    before: ["Fix heavy furniture and shelves to walls.", "Know the safe spots in each room: under a sturdy table, against an inside wall.", "Keep an emergency kit: water, torch, medicines, documents."],
    during: ["Drop, Cover and Hold On until the shaking stops.", "Stay away from windows, glass and outside walls.", "If outside, move to an open area away from buildings, trees and wires.", "If driving, stop in the open and stay inside."],
    after: ["Expect aftershocks.", "Check for gas leaks before using flames or switches.", "Use stairs, not lifts. Send text messages instead of calling to keep lines free."],
  },
  {
    id: "tsunami",
    label: "Tsunami",
    Icon: Waves,
    color: "#0e86d4",
    tint: "#e6f3fc",
    before: ["Know whether your home, work or school is in a coastal hazard zone.", "Learn the route to high ground or an inland area."],
    during: ["A strong coastal earthquake or the sea pulling back suddenly is a natural warning: move to high ground at once.", "Go as high and as far inland as you can; don't wait for an official alert.", "Never go to the shore to watch the waves."],
    after: ["Stay away from the coast until officials say it is safe — more waves can follow for hours.", "Avoid flood water and damaged buildings."],
  },
  {
    id: "fire",
    label: "Fire",
    Icon: Flame,
    color: "#f76b15",
    tint: "#fff0e6",
    before: ["Keep a fire extinguisher and know how to use it.", "Plan two ways out of every room."],
    during: ["Get out, stay out, and call 101.", "Crawl low under smoke; cover your nose and mouth with a wet cloth.", "Feel doors before opening; if hot, use another way out.", "If your clothes catch fire: Stop, Drop and Roll."],
    after: ["Do not go back inside until firefighters say it is safe.", "Get burns checked by a doctor."],
  },
  {
    id: "volcano",
    label: "Volcano",
    Icon: Triangle,
    color: "#8e4ec6",
    tint: "#f4ecfb",
    before: ["Know the evacuation routes if you live near an active volcano.", "Keep masks (N95) and goggles in your kit."],
    during: ["Follow evacuation orders immediately.", "Stay indoors with windows closed if ash is falling; wear a mask and goggles outside.", "Avoid river valleys downstream, where mudflows travel."],
    after: ["Clear ash from roofs carefully — it is heavy.", "Avoid driving in heavy ash."],
  },
  {
    id: "wind",
    label: "Strong Winds",
    Icon: Wind,
    color: "#12a594",
    tint: "#e6f7f4",
    before: ["Secure or bring in loose objects: roof sheets, pots, signboards.", "Trim weak branches near your house.", "Follow IMD cyclone bulletins."],
    during: ["Stay indoors, away from windows.", "Keep away from trees, poles and fallen power lines.", "In a cyclone, the calm 'eye' is not the end — the wind comes back."],
    after: ["Report fallen power lines; don't touch them.", "Watch for weakened walls and roofs."],
  },
  {
    id: "flood",
    label: "Floods",
    Icon: CloudRain,
    color: "#3e63dd",
    tint: "#ebf0fe",
    before: ["Know your area's flood risk and the nearest high ground.", "Keep documents and valuables in waterproof bags, up high."],
    during: ["Move to higher ground early.", "Never walk or drive through flood water — 15 cm of moving water can knock you over, 60 cm can float a car.", "Switch off electricity at the mains if water comes in."],
    after: ["Drink only boiled or bottled water.", "Clean and disinfect anything that got wet.", "Watch for snakes and damaged wiring."],
  },
];

// Extra guides used by the assistant.
export const EXTRA_GUIDES: Pick<Guide, "id" | "label" | "Icon" | "during">[] = [
  { id: "landslide", label: "Landslide", Icon: Mountain, during: ["Avoid steep slopes and hill roads during heavy rain.", "Warning signs: new cracks, tilting trees or poles, sudden muddy water, rumbling sounds.", "Move away from the slide's path, across rather than downhill."] },
  { id: "heat", label: "Heatwave", Icon: Thermometer, during: ["Drink water often, even if not thirsty.", "Avoid the sun from 12–4 pm; wear light, loose clothes.", "Check on elderly people and children.", "Heatstroke signs (confusion, hot dry skin): cool the person and call 108."] },
];

export const EMERGENCY_NUMBERS = [
  { number: "112", label: "All emergencies" },
  { number: "108", label: "Ambulance" },
  { number: "101", label: "Fire" },
  { number: "1078", label: "NDMA disaster helpline" },
];
