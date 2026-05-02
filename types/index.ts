export type Mode = "debate" | "cowrite" | "interview" | "negotiate" | "story";

export type Speaker = "model1" | "model2" | "system" | "interrupt";

export interface ChatMessage {
  id: string;
  speaker: Speaker;
  content: string;
  modelId?: string;
  personaId?: string;
  pending?: boolean;
  createdAt: number;
  /** Co-write only: the parsed edit summary (the EDIT: line). */
  editSummary?: string;
  /** Co-write only: the body of the message with the EDIT: line stripped. */
  bodyText?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
  top_provider?: {
    is_moderated?: boolean;
  };
}

export interface Persona {
  id: string;
  name: string;
  short: string;
  prompt: string;
}

/**
 * The "no persona" sentinel. Treated specially throughout — when selected,
 * no persona instructions are injected at all.
 */
export const PERSONA_NONE = "none";
export const PERSONA_RANDOM = "random";

export interface DebateConfig {
  motion: string;
  sideA: string;
  sideB: string;
}

export interface CoWriteConfig {
  artifactKind: string;
  brief: string;
  startingDraft: string;
}

export interface InterviewConfig {
  topic: string;
  /** Which side asks. The other side answers. */
  interviewerSide: "model1" | "model2";
  subjectPerspective: string;
}

export interface NegotiateConfig {
  scenario: string;
  partyA: { name: string; goals: string; walkaway: string };
  partyB: { name: string; goals: string; walkaway: string };
}

export interface StoryConfig {
  opening: string;
  style: string;
  turnLength: "sentence" | "paragraph";
}

export interface ModeConfigs {
  debate: DebateConfig;
  cowrite: CoWriteConfig;
  interview: InterviewConfig;
  negotiate: NegotiateConfig;
  story: StoryConfig;
}

export type Artifact =
  | {
      kind: "verdict";
      motion: string;
      ruling: string;
      reasoning: string;
      strongest: string;
      weakest: string;
    }
  | { kind: "cowrite-final"; artifactKind: string; text: string }
  | { kind: "story-final"; text: string }
  | { kind: "negotiate-memo"; outcome: "agreement" | "impasse"; text: string };
