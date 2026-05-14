// Bout modes shown in the briefing card. Each one frames the exchange
// differently — see useBoutStream's buildBoutSystemPrompt for the
// per-mode role logic that goes with these.

export type Mode = "debate" | "cowrite" | "interview" | "negotiate" | "story";

export interface ModeMeta {
  id: Mode;
  name: string;
  blurb: string;
}

export const MODES: ModeMeta[] = [
  {
    id: "debate",
    name: "Debate",
    blurb: "Two fixed positions on a motion. A judge rules at the end.",
  },
  {
    id: "cowrite",
    name: "Co-write",
    blurb: "They co-edit a single artifact. Each turn produces a new full draft.",
  },
  {
    id: "interview",
    name: "Interview",
    blurb: "Locked roles. One asks, one answers. A clean Q/A.",
  },
  {
    id: "negotiate",
    name: "Negotiate",
    blurb: "Opposing goals and walk-aways. Ends in agreement or impasse.",
  },
  {
    id: "story",
    name: "Story",
    blurb: "Co-author a narrative. Each turn extends what came before.",
  },
];
