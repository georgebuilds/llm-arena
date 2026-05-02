import type { Mode, ModeConfigs } from "~/types";

export interface ModeMeta {
  id: Mode;
  name: string;
  blurb: string;
  /** Whether the artifact (verdict / final draft / memo / story) replaces the
   * transcript on print, or supplements it. */
  printShowsTranscript: boolean;
  /** Per-mode CTA on the Begin button — voice does identity work that fonts
   * and colors can't. */
  cta: string;
  /** Short editorial label that appears in the masthead / broadcast strip
   * when this mode is active. Set in small caps. */
  marquee: string;
}

export const MODES: ModeMeta[] = [
  {
    id: "debate",
    name: "Debate",
    blurb: "Two fixed positions on a motion. A judge rules at the end.",
    printShowsTranscript: true,
    cta: "Open the floor",
    marquee: "The motion before the house",
  },
  {
    id: "cowrite",
    name: "Co-write",
    blurb: "They co-edit a single artifact. Each turn produces a new full draft.",
    printShowsTranscript: false,
    cta: "Pick up the pen",
    marquee: "A draft in progress",
  },
  {
    id: "interview",
    name: "Interview",
    blurb: "Locked roles. One asks, one answers. A clean Q/A.",
    printShowsTranscript: true,
    cta: "Roll tape",
    marquee: "On the record",
  },
  {
    id: "negotiate",
    name: "Negotiate",
    blurb: "Opposing goals and walk-aways. Ends in agreement or impasse.",
    printShowsTranscript: true,
    cta: "Take your seats",
    marquee: "Across the table",
  },
  {
    id: "story",
    name: "Story",
    blurb: "One sentence each, building a microfiction.",
    printShowsTranscript: false,
    cta: "Strike the match",
    marquee: "A story unfolding",
  },
];

export const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));

export const DEFAULT_MODE_CONFIGS: ModeConfigs = {
  debate: {
    motion: "Boredom is necessary for creativity.",
    sideA: "Defends the motion: real creative work depends on stretches of unstimulated time.",
    sideB: "Opposes the motion: boredom is at best incidental and at worst corrosive to creative work.",
  },
  cowrite: {
    artifactKind: "short poem",
    brief: "A short poem about a kitchen at 6am.",
    startingDraft: "",
  },
  interview: {
    topic: "What it's like to live alone for a long time",
    interviewerSide: "model1",
    subjectPerspective:
      "Someone who has lived alone for the past eleven years and is, on balance, fine with it.",
  },
  negotiate: {
    scenario:
      "A small bookshop and its landlord are renegotiating the shop's lease after five years of tenancy.",
    partyA: {
      name: "The bookshop owner",
      goals:
        "Keep rent flat for at least three more years; secure a clause requiring 90 days' notice on any future rent increase.",
      walkaway: "Won't accept any rent increase above 8%, and won't sign for less than a 2-year term.",
    },
    partyB: {
      name: "The landlord",
      goals:
        "Raise rent meaningfully — local market suggests 15-20% — and shorten any future flat-rent period.",
      walkaway: "Won't accept a rent increase below 10%, and prefers a 1-year term so they can revisit again soon.",
    },
  },
  story: {
    opening: "The lighthouse keeper had not received post in seven weeks.",
    style: "spare, atmospheric, faintly ominous",
    turnLength: "sentence",
  },
};
