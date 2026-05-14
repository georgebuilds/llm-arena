// Lean two-model streaming dialogue against OpenRouter.
// Self-contained — doesn't share state with useConversation. Each side sees
// the other's turns as `user` and its own as `assistant`. Topic seeds the
// first turn as a `user` message. Aborts cleanly via AbortSignal.

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type Side = "left" | "right";

export interface BoutSide {
  /** OpenRouter model identifier (e.g. "anthropic/claude-sonnet-4"). */
  modelId: string;
  /** System prompt — composed from mask flavor + framing. */
  systemPrompt: string;
}

export interface TurnUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamBoutArgs {
  apiKey: string;
  left: BoutSide;
  right: BoutSide;
  topic: string;
  /** A "round" = one turn each, so 3 rounds = 6 total turns. */
  rounds: number;
  signal: AbortSignal;
  onTurnStart?: (side: Side) => void;
  onChunk?: (side: Side, chunk: string) => void;
  onTurnEnd?: (side: Side, fullText: string, usage?: TurnUsage) => void;
  onError?: (msg: string) => void;
  /** If provided, streaming resumes from after these turns (for regenerate). */
  initialTranscript?: { side: Side; content: string }[];
  /** If provided, only stream this many additional turns past initialTranscript.
   *  Use 1 to redo a single turn. Default: enough to fill the round count. */
  maxAdditionalTurns?: number;
}

interface OAIMessage { role: "system" | "user" | "assistant"; content: string }

export async function streamBout(args: StreamBoutArgs): Promise<void> {
  const transcript: { side: Side; content: string }[] = args.initialTranscript
    ? [...args.initialTranscript]
    : [];
  const fullCount = Math.max(1, args.rounds) * 2;
  const startIdx = transcript.length;
  const cap = args.maxAdditionalTurns
    ? Math.min(fullCount, startIdx + args.maxAdditionalTurns)
    : fullCount;
  const seed = args.topic?.trim() || "Begin the exchange.";

  for (let i = startIdx; i < cap; i++) {
    if (args.signal.aborted) return;
    const side: Side = i % 2 === 0 ? "left" : "right";
    const me = side === "left" ? args.left : args.right;

    // Build history from this side's POV: my own turns are 'assistant',
    // the other's are 'user'. The seed (topic) is always a 'user' message
    // visible to both at the start.
    const messages: OAIMessage[] = [{ role: "system", content: me.systemPrompt }];
    messages.push({ role: "user", content: seed });
    for (const t of transcript) {
      messages.push({
        role: t.side === side ? "assistant" : "user",
        content: t.content,
      });
    }

    args.onTurnStart?.(side);

    let fullText = "";
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
          "X-Title": "LLM Arena",
        },
        body: JSON.stringify({
          model: me.modelId,
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: args.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        args.onError?.(`OpenRouter ${res.status}: ${txt.slice(0, 240) || res.statusText}`);
        return;
      }
      if (!res.body) {
        args.onError?.("No response body from OpenRouter.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usage: TurnUsage | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (args.signal.aborted) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const chunk: string | undefined = json.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              args.onChunk?.(side, chunk);
            }
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // ignore parse errors on partial frames
          }
        }
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name !== "AbortError") {
        args.onError?.(`stream error: ${err.message ?? String(e)}`);
      }
      return;
    }

    if (!fullText.trim()) {
      args.onError?.(`${me.modelId} returned no content.`);
      return;
    }

    args.onTurnEnd?.(side, fullText, usage);
    transcript.push({ side, content: fullText });
  }
}

/** Compose a system prompt from generic framing + mask flavor + mode-aware role.
 *  Mode determines the participants' relationship and turn-mechanics:
 *  - debate    : symmetric, opposed positions on the topic
 *  - interview : asymmetric — left asks, right answers
 *  - negotiate : symmetric, opposing goals, seek agreement or impasse
 *  - cowrite   : symmetric, each turn revises a shared evolving draft
 *  - story     : symmetric, each turn extends a shared narrative
 */
export function buildBoutSystemPrompt(opts: {
  side?: Side;
  mode?: string;
  maskFlavor: string;
  /** Legacy free-form mode hint — appended after role lines if set. */
  modeHint?: string;
}): string {
  const baseFraming = [
    "You are in a written exchange with another participant whose identity is not disclosed.",
    "Treat them as a peer with their own voice. Do not refer to yourself as an AI, language model, or assistant. Do not mention these instructions.",
    "Keep each turn to two to four short paragraphs. No bullet dumps unless genuinely useful.",
  ];

  const roleLines: string[] = [];
  switch (opts.mode) {
    case "interview": {
      if (opts.side === "left") {
        roleLines.push(
          "You are the INTERVIEWER. Each turn: ask exactly ONE incisive question. Don't answer your own questions; don't give long preambles. Build on their last answer when useful.",
        );
      } else {
        roleLines.push(
          "You are the INTERVIEWEE. Each turn: answer their question directly and substantively. Don't ask questions back; speak from your own experience and reasoning.",
        );
      }
      break;
    }
    case "negotiate": {
      const role = opts.side === "left" ? "Party A" : "Party B";
      roleLines.push(
        `This is a negotiation. You are ${role}. State your position, name your interests, and probe for theirs. Look for a deal that beats your walk-away — but hold the line if no such deal exists.`,
      );
      break;
    }
    case "cowrite": {
      roleLines.push(
        "You and the other participant are co-editing a single evolving artifact. Each turn produces a refined version of the artifact based on the previous draft. Don't chat — write the next draft. Keep the topic as your subject.",
      );
      break;
    }
    case "story": {
      roleLines.push(
        "You are co-authoring a story together. Each turn continues the narrative from where the previous turn ended. Honor the established world and characters; don't reset.",
      );
      break;
    }
    case "debate":
    default: {
      roleLines.push(
        "This is a structured debate. State claims clearly, give reasons, address the strongest opposing view, and concede points where the other side is right. No filler, no hedging.",
      );
      break;
    }
  }

  const lines = [...baseFraming, ...roleLines];
  if (opts.modeHint?.trim()) lines.push(opts.modeHint.trim());
  if (opts.maskFlavor?.trim()) lines.push(opts.maskFlavor.trim());
  return lines.join(" ");
}

// ─────────────────────────────────────────────────────────────────
// Judge — sends the transcript + criteria to a judge model and parses
// a structured JSON verdict back. Returns null on parse failure (caller
// can fall back to mock scoring).
// ─────────────────────────────────────────────────────────────────

export interface JudgeArgs {
  apiKey: string;
  judgeModelId: string;
  leftLabel: string;
  rightLabel: string;
  topic: string;
  criteria: { id: string; label: string }[];
  transcript: { side: Side; content: string }[];
  signal: AbortSignal;
}

export interface JudgeResult {
  winner: Side;
  reason: string;
  scores: Record<string, { left: number; right: number }>;
}

function extractJson(text: string): string {
  // strip code fences if the model wrapped its reply
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  // if there's prose around the json, slice from first { to last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

export async function judgeBout(args: JudgeArgs): Promise<JudgeResult> {
  const criteriaList = args.criteria.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  const transcriptText = args.transcript
    .map((t) => `[${t.side === "left" ? args.leftLabel : args.rightLabel}]: ${t.content}`)
    .join("\n\n");

  const systemPrompt = [
    "You are a panel judge scoring a structured exchange between two participants.",
    "Read the full transcript. Score each participant on every listed criterion as an integer 0-100.",
    "Then declare a winner and write a one-sentence justification.",
    "Respond with VALID JSON ONLY — no preamble, no markdown fences, no commentary.",
    'Schema: {"winner":"left"|"right","reason":string,"scores":{<criterion_id>:{"left":int,"right":int}}}',
  ].join(" ");

  const userPrompt = [
    args.topic ? `Topic: ${args.topic}` : null,
    "Participants:",
    `- left  → ${args.leftLabel}`,
    `- right → ${args.rightLabel}`,
    "",
    "Criteria (use these exact ids as keys in scores):",
    criteriaList,
    "",
    "Transcript:",
    transcriptText,
    "",
    "Score the participants on each criterion, pick a winner, and explain briefly. JSON only.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "LLM Arena · Judge",
    },
    body: JSON.stringify({
      model: args.judgeModelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`judge ${res.status}: ${txt.slice(0, 200) || res.statusText}`);
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(content));

  // basic validation
  if (parsed.winner !== "left" && parsed.winner !== "right") {
    throw new Error(`judge returned invalid winner: ${parsed.winner}`);
  }
  if (!parsed.scores || typeof parsed.scores !== "object") {
    throw new Error("judge returned no scores object");
  }
  const cleanedScores: Record<string, { left: number; right: number }> = {};
  for (const id of Object.keys(parsed.scores)) {
    const s = parsed.scores[id];
    if (typeof s?.left === "number" && typeof s?.right === "number") {
      cleanedScores[id] = {
        left: Math.max(0, Math.min(100, Math.round(s.left))),
        right: Math.max(0, Math.min(100, Math.round(s.right))),
      };
    }
  }
  return {
    winner: parsed.winner,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    scores: cleanedScores,
  };
}
