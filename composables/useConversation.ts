import { ref, shallowRef } from "vue";
import type {
  Artifact,
  ChatMessage,
  Mode,
  ModeConfigs,
  Persona,
  Speaker,
} from "~/types";
import { PERSONA_NONE, PERSONA_RANDOM } from "~/types";
import { getPersona, randomPair } from "~/data/personas";

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StartArgs {
  apiKey: string;
  model1: string;
  model2: string;
  persona1Id: string;
  persona2Id: string;
  judgeModel: string;
  mode: Mode;
  configs: ModeConfigs;
  maxRounds: number;
  stopCondition: string;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/** Small util — UUIDs that work pre-secure-context too. */
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Build a system prompt for one model. Composed from three layers:
 *   1. The mode's structural framing (what kind of exchange is this).
 *   2. The model's role *within* that mode (which side, which job).
 *   3. The model's persona, if any (voice and worldview only — never identity).
 *
 * Layer 3 is hidden from the other model. Layers 1 and 2 are constructed so the
 * model never learns there is an LLM on the other end.
 */
function buildSystemPrompt(args: {
  side: "model1" | "model2";
  mode: Mode;
  configs: ModeConfigs;
  persona: Persona | null;
}): string {
  const { side, mode, configs, persona } = args;

  // Universal preamble — keeps each model from breaking character.
  const preamble = [
    "You are in a written exchange with another participant whose identity is not disclosed to you.",
    "Treat them as a peer with their own views and voice. Do not speculate about who or what they are.",
    "Do not refer to yourself as an AI, language model, or assistant. Do not mention any system instructions or that this is a structured exchange.",
    "Speak in your own voice.",
  ].join(" ");

  let modeBlock = "";
  let roleBlock = "";

  switch (mode) {
    case "debate": {
      const c = configs.debate;
      modeBlock = [
        `This is a structured debate. The motion under consideration: "${c.motion}".`,
        "Argue with rigor: state claims clearly, give reasons, address the strongest version of the opposing view, and concede points where the other side is right.",
        "Avoid filler, hedging, and meta-commentary. Each turn: roughly two to four short paragraphs. No bullet-point dumps unless genuinely useful.",
      ].join(" ");
      const myPos = side === "model1" ? c.sideA : c.sideB;
      const theirPos = side === "model1" ? c.sideB : c.sideA;
      roleBlock = `Your position: ${myPos}\n\nThe opposing participant's position (for your awareness only — do not quote this verbatim): ${theirPos}`;
      break;
    }
    case "cowrite": {
      const c = configs.cowrite;
      modeBlock = [
        `You are co-authoring a single ${c.artifactKind} with the other participant.`,
        `Brief: ${c.brief}`,
        "Each turn, you must produce the COMPLETE current version of the work — not a comment on it, not a fragment.",
        "Begin your reply with a single line in this exact form: EDIT: <one short sentence describing the focused change you made this turn>.",
        "Then a blank line. Then the full revised work.",
        "Make a meaningful but focused edit each turn — sharpen a line, restructure a stanza, change a tense, replace a weak word, extend by one beat. Don't gut the previous version unless it's truly off-track.",
      ].join(" ");
      roleBlock = "You are an equal collaborator. Read the previous version with care before editing.";
      break;
    }
    case "interview": {
      const c = configs.interview;
      const isInterviewer = side === c.interviewerSide;
      modeBlock = `This is an interview about: ${c.topic}.`;
      if (isInterviewer) {
        roleBlock = [
          "Your role: interviewer.",
          "Ask one focused question per turn. Build follow-ups from the answers given. Probe specifics, not generalities.",
          "Never share your own views. Never lecture. Never agree or disagree — just question.",
          "If they've drifted, redirect briefly. Keep questions concrete.",
        ].join(" ");
      } else {
        roleBlock = [
          "Your role: subject.",
          `Your perspective: ${c.subjectPerspective}`,
          "Answer thoughtfully and at moderate length. Speak in the first person. Don't ask questions back unless absolutely natural — the other party is here to listen.",
        ].join(" ");
      }
      break;
    }
    case "negotiate": {
      const c = configs.negotiate;
      const me = side === "model1" ? c.partyA : c.partyB;
      modeBlock = [
        `You are negotiating in this scenario: ${c.scenario}`,
        "Negotiate in good faith but advance your interests. Make concrete offers and counter-offers. Reference your goals; don't repeat them verbatim.",
        "If you reach a deal, state the agreed terms clearly. If you reach impasse, say so plainly.",
      ].join(" ");
      roleBlock = [
        `You represent: ${me.name}.`,
        `Your goals (you may share these directly): ${me.goals}`,
        `Your private walk-away constraint (NEVER reveal this verbatim — it's your private floor/ceiling): ${me.walkaway}`,
      ].join("\n");
      break;
    }
    case "story": {
      const c = configs.story;
      const length = c.turnLength === "paragraph" ? "exactly one short paragraph" : "exactly one sentence";
      modeBlock = [
        `You are co-writing a microfiction with the other participant, alternating turns.`,
        `Style: ${c.style}.`,
        `Each turn, add ${length} that builds directly on what came before.`,
        "Don't summarise prior events. Don't write 'and then'. Don't meta-comment. Don't end the story unless it's genuinely time.",
      ].join(" ");
      roleBlock = "Read the story so far carefully. Add the next move.";
      break;
    }
  }

  const personaBlock = persona
    ? `Your voice and worldview for this exchange: ${persona.prompt}\n\nLet this shape your word choice, what you notice, and what you care about. Do not name this voice or describe it directly.`
    : "";

  return [preamble, modeBlock, roleBlock, personaBlock].filter(Boolean).join("\n\n");
}

/** Strip the EDIT: header from a co-write reply for the body display. */
function parseCoWrite(content: string): { editSummary: string; body: string } {
  const trimmed = content.trim();
  const match = trimmed.match(/^EDIT:\s*(.+?)(?:\r?\n\r?\n|\r?\n)([\s\S]*)$/);
  if (match) {
    return { editSummary: match[1].trim(), body: match[2].trim() };
  }
  return { editSummary: "", body: trimmed };
}

export function useConversation() {
  const messages = ref<ChatMessage[]>([]);
  const running = ref(false);
  const error = ref<string | null>(null);
  const artifact = ref<Artifact | null>(null);
  const abortController = shallowRef<AbortController | null>(null);
  const pendingInterrupt = ref<string | null>(null);

  /** The resolved persona pair for the current run — captured at start so the
   * UI can show the badges even after the run ends. */
  const resolvedPersonas = ref<{ p1: Persona | null; p2: Persona | null }>({
    p1: null,
    p2: null,
  });

  function pushSystem(content: string) {
    messages.value.push({
      id: uuid(),
      speaker: "system",
      content,
      createdAt: Date.now(),
    });
  }

  function pushInterrupt(content: string) {
    messages.value.push({
      id: uuid(),
      speaker: "interrupt",
      content,
      createdAt: Date.now(),
    });
  }

  function pushPending(speaker: Speaker, modelId: string, personaId?: string): string {
    const id = uuid();
    messages.value.push({
      id,
      speaker,
      content: "",
      modelId,
      personaId,
      pending: true,
      createdAt: Date.now(),
    });
    return id;
  }

  function appendToMessage(id: string, chunk: string) {
    const m = messages.value.find((x) => x.id === id);
    if (m) m.content += chunk;
  }

  function finalizeMessage(id: string, mode: Mode) {
    const m = messages.value.find((x) => x.id === id);
    if (!m) return;
    m.pending = false;
    if (mode === "cowrite" && (m.speaker === "model1" || m.speaker === "model2")) {
      const { editSummary, body } = parseCoWrite(m.content);
      m.editSummary = editSummary;
      m.bodyText = body;
    }
  }

  function reset() {
    messages.value = [];
    error.value = null;
    artifact.value = null;
    pendingInterrupt.value = null;
  }

  function stop() {
    abortController.value?.abort();
    abortController.value = null;
    running.value = false;
  }

  /**
   * The user is interrupting mid-conversation. The interrupt is appended as
   * a visible system-style note AND will land in both models' histories on
   * their next turn (as a `user` role message), so they actually respond to
   * it — not just decorate the transcript with it.
   */
  function interrupt(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    pendingInterrupt.value = trimmed;
    pushInterrupt(trimmed);
  }

  /**
   * Build the chat history *as that side sees it*. Their own past turns are
   * `assistant`; the other side's turns are `user`; interrupts are `user`
   * (visible to both). System messages don't appear in history.
   */
  function buildHistoryFor(side: "model1" | "model2"): OpenAIChatMessage[] {
    const out: OpenAIChatMessage[] = [];
    for (const m of messages.value) {
      if (m.pending) continue;
      if (!m.content.trim()) continue;
      if (m.speaker === "system") continue;
      if (m.speaker === "interrupt") {
        out.push({ role: "user", content: `[Organiser interjects]: ${m.content}` });
      } else if (m.speaker === side) {
        out.push({ role: "assistant", content: m.content });
      } else {
        out.push({ role: "user", content: m.content });
      }
    }
    return out;
  }

  async function callModel(
    apiKey: string,
    modelId: string,
    systemPrompt: string,
    history: OpenAIChatMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal,
  ): Promise<string> {
    const body = {
      model: modelId,
      stream: true,
      messages: [{ role: "system" as const, content: systemPrompt }, ...history],
    };

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "LLM Arena",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 240)}`);
    }
    if (!res.body) {
      throw new Error("OpenRouter returned no response body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              full += delta;
              onChunk(delta);
            }
          } catch {
            /* heartbeat / comment line — ignore */
          }
        }
      }
    }

    return full.trim();
  }

  /** Non-streaming call for judge/summarizer/stop-condition evaluators. */
  async function callModelOnce(
    apiKey: string,
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "LLM Arena",
      },
      body: JSON.stringify({
        model: modelId,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 240)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  }

  async function evaluateStopCondition(args: {
    apiKey: string;
    model: string;
    condition: string;
    signal: AbortSignal;
  }): Promise<{ met: boolean; reason: string }> {
    // Send only the last few non-pending turns to keep this cheap.
    const tail = messages.value
      .filter((m) => !m.pending && m.content.trim() && (m.speaker === "model1" || m.speaker === "model2" || m.speaker === "interrupt"))
      .slice(-4)
      .map((m) => {
        const tag =
          m.speaker === "interrupt" ? "Organiser" : m.speaker === "model1" ? "Speaker A" : "Speaker B";
        return `${tag}: ${m.content}`;
      })
      .join("\n\n");

    const sys =
      "You are a terse evaluator. Decide whether a stop condition has been met by the latest turns of a conversation. Reply with EXACTLY one of:\n" +
      "  YES: <one short sentence reason>\n" +
      "  NO\n" +
      "No other text. Default to NO when uncertain.";
    const usr = `Stop condition: ${args.condition}\n\nLatest turns:\n${tail}`;

    try {
      const out = await callModelOnce(args.apiKey, args.model, sys, usr, args.signal);
      const m = out.match(/^\s*YES\s*[:\-—]\s*(.+)/i);
      if (m) return { met: true, reason: m[1].trim() };
      return { met: false, reason: "" };
    } catch {
      // If the evaluator fails, don't terminate the conversation prematurely.
      return { met: false, reason: "" };
    }
  }

  async function runDebateVerdict(args: {
    apiKey: string;
    judgeModel: string;
    motion: string;
    signal: AbortSignal;
  }) {
    const transcript = messages.value
      .filter((m) => !m.pending && m.content.trim() && (m.speaker === "model1" || m.speaker === "model2" || m.speaker === "interrupt"))
      .map((m) => {
        const tag =
          m.speaker === "interrupt"
            ? "Organiser"
            : m.speaker === "model1"
              ? "Side A"
              : "Side B";
        return `${tag}: ${m.content}`;
      })
      .join("\n\n");

    const sys =
      "You are an impartial judge ruling on a structured debate. Read the transcript and respond in EXACTLY this format, with these labels and nothing else:\n\n" +
      "RULING: <Side A wins | Side B wins | Undecided>\n" +
      "REASONING: <2-3 sentence rationale>\n" +
      "STRONGEST: <which side, what the argument was, in one sentence>\n" +
      "WEAKEST: <which side, what went wrong, in one sentence>";
    const usr = `Motion: ${args.motion}\n\nTranscript:\n${transcript}`;

    const out = await callModelOnce(args.apiKey, args.judgeModel, sys, usr, args.signal);
    const grab = (label: string) => {
      const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`, "i");
      return out.match(re)?.[1]?.trim() ?? "";
    };
    artifact.value = {
      kind: "verdict",
      motion: args.motion,
      ruling: grab("RULING") || "Undecided",
      reasoning: grab("REASONING"),
      strongest: grab("STRONGEST"),
      weakest: grab("WEAKEST"),
    };
  }

  async function runNegotiateMemo(args: {
    apiKey: string;
    judgeModel: string;
    scenario: string;
    signal: AbortSignal;
  }) {
    const transcript = messages.value
      .filter((m) => !m.pending && m.content.trim() && (m.speaker === "model1" || m.speaker === "model2" || m.speaker === "interrupt"))
      .map((m) => {
        const tag =
          m.speaker === "interrupt"
            ? "Organiser"
            : m.speaker === "model1"
              ? "Party A"
              : "Party B";
        return `${tag}: ${m.content}`;
      })
      .join("\n\n");

    const sys =
      "You are summarising the outcome of a negotiation transcript. Reply in EXACTLY this format:\n\n" +
      "OUTCOME: <agreement | impasse>\n" +
      "MEMO: <a short, neutral memo. If agreement: list the agreed terms as a tidy bulleted list. If impasse: list what each party held firm on and what blocked the deal.>";
    const usr = `Scenario: ${args.scenario}\n\nTranscript:\n${transcript}`;
    const out = await callModelOnce(args.apiKey, args.judgeModel, sys, usr, args.signal);
    const outcome = /OUTCOME:\s*(agreement|impasse)/i.exec(out)?.[1]?.toLowerCase();
    const memo =
      out
        .match(/MEMO:\s*([\s\S]*)$/i)?.[1]
        ?.trim() ?? out.trim();

    artifact.value = {
      kind: "negotiate-memo",
      outcome: outcome === "agreement" ? "agreement" : "impasse",
      text: memo,
    };
  }

  function gatherStoryArtifact() {
    const sentences: string[] = [];
    for (const m of messages.value) {
      if ((m.speaker === "model1" || m.speaker === "model2") && !m.pending) {
        const t = m.content.trim();
        if (t) sentences.push(t);
      }
    }
    artifact.value = {
      kind: "story-final",
      text: sentences.join(" "),
    };
  }

  function gatherCoWriteArtifact(artifactKind: string) {
    // The latest model turn IS the artifact.
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const m = messages.value[i];
      if ((m.speaker === "model1" || m.speaker === "model2") && !m.pending) {
        const text = m.bodyText ?? parseCoWrite(m.content).body;
        artifact.value = { kind: "cowrite-final", artifactKind, text };
        return;
      }
    }
  }

  function resolvePersonas(persona1Id: string, persona2Id: string): { p1: Persona | null; p2: Persona | null } {
    const resolveOne = (id: string, otherId: string): Persona | null => {
      if (id === PERSONA_NONE) return null;
      if (id.startsWith("custom:")) {
        const text = id.slice("custom:".length).trim();
        if (!text) return null;
        return {
          id: "custom",
          name: "Custom voice",
          short: "custom voice",
          prompt: text,
        };
      }
      if (id === PERSONA_RANDOM) {
        const [a, b] = randomPair();
        return otherId && otherId !== PERSONA_RANDOM && getPersona(otherId)?.id === a.id ? b : a;
      }
      return getPersona(id);
    };
    // Resolve both. Re-roll if both happen to land on the same persona.
    let p1 = resolveOne(persona1Id, persona2Id);
    let p2 = resolveOne(persona2Id, persona1Id);
    if (p1 && p2 && p1.id === p2.id) {
      const [a, b] = randomPair();
      p1 = a;
      p2 = b;
    }
    return { p1, p2 };
  }

  async function start(args: StartArgs) {
    if (running.value) return;
    if (!args.apiKey || !args.model1 || !args.model2) {
      error.value = "API key and both models are required.";
      return;
    }

    reset();
    running.value = true;
    abortController.value = new AbortController();
    const signal = abortController.value.signal;

    const personas = resolvePersonas(args.persona1Id, args.persona2Id);
    resolvedPersonas.value = personas;

    const sys1 = buildSystemPrompt({
      side: "model1",
      mode: args.mode,
      configs: args.configs,
      persona: personas.p1,
    });
    const sys2 = buildSystemPrompt({
      side: "model2",
      mode: args.mode,
      configs: args.configs,
      persona: personas.p2,
    });

    // Mode-specific opener
    pushModeHeader(args);

    // For co-write: seed the shared draft as a synthetic user-visible message
    // so both sides have something to edit on turn 1.
    if (args.mode === "cowrite" && args.configs.cowrite.startingDraft.trim()) {
      messages.value.push({
        id: uuid(),
        speaker: "interrupt",
        content: `Starting draft:\n\n${args.configs.cowrite.startingDraft.trim()}`,
        createdAt: Date.now(),
      });
    }
    if (args.mode === "story") {
      const opening = args.configs.story.opening.trim();
      if (opening) {
        messages.value.push({
          id: uuid(),
          speaker: "interrupt",
          content: `Opening: ${opening}`,
          createdAt: Date.now(),
        });
      }
    }

    // For interview: a "round" is question + answer. The interviewer always
    // speaks first regardless of which side they are.
    const interviewerFirst =
      args.mode === "interview" && args.configs.interview.interviewerSide === "model2";
    const orderEachRound: ("model1" | "model2")[] = interviewerFirst
      ? ["model2", "model1"]
      : ["model1", "model2"];

    try {
      let stoppedEarly = false;
      for (let round = 1; round <= args.maxRounds; round++) {
        if (signal.aborted) break;
        if (stoppedEarly) break;
        pushSystem(`— round ${round} of ${args.maxRounds} —`);

        for (const speaker of orderEachRound) {
          if (signal.aborted) break;
          const modelId = speaker === "model1" ? args.model1 : args.model2;
          const sys = speaker === "model1" ? sys1 : sys2;
          const persona = speaker === "model1" ? personas.p1 : personas.p2;
          const msgId = pushPending(speaker, modelId, persona?.id);
          const history = buildHistoryFor(speaker);
          await callModel(
            args.apiKey,
            modelId,
            sys,
            history,
            (chunk) => appendToMessage(msgId, chunk),
            signal,
          );
          finalizeMessage(msgId, args.mode);

          // Apply any pending interrupt — it was already pushed visibly when
          // the user typed it; here we just clear the latch so it doesn't
          // get treated as new state on the *next* turn either.
          pendingInterrupt.value = null;

          // Stop condition check (after each turn, not each round)
          if (args.stopCondition.trim() && !signal.aborted) {
            const { met, reason } = await evaluateStopCondition({
              apiKey: args.apiKey,
              model: args.judgeModel || args.model1,
              condition: args.stopCondition.trim(),
              signal,
            });
            if (met) {
              pushSystem(`— stop condition met: ${reason} —`);
              stoppedEarly = true;
              break;
            }
          }
        }
      }

      if (!signal.aborted) {
        pushSystem(stoppedEarly ? "— conversation closed —" : "— end of conversation —");

        // Mode-specific terminal step
        const judgeModel = args.judgeModel || args.model1;
        if (args.mode === "debate") {
          await runDebateVerdict({
            apiKey: args.apiKey,
            judgeModel,
            motion: args.configs.debate.motion,
            signal,
          });
        } else if (args.mode === "negotiate") {
          await runNegotiateMemo({
            apiKey: args.apiKey,
            judgeModel,
            scenario: args.configs.negotiate.scenario,
            signal,
          });
        } else if (args.mode === "story") {
          gatherStoryArtifact();
        } else if (args.mode === "cowrite") {
          gatherCoWriteArtifact(args.configs.cowrite.artifactKind);
        }
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        error.value = msg;
        pushSystem(`error: ${msg}`);
      } else {
        pushSystem("— stopped by user —");
      }
      for (const m of messages.value) {
        if (m.pending) m.pending = false;
      }
    } finally {
      running.value = false;
      abortController.value = null;
    }
  }

  function pushModeHeader(args: StartArgs) {
    switch (args.mode) {
      case "debate":
        pushSystem(`Debate · motion: "${args.configs.debate.motion}"`);
        break;
      case "cowrite":
        pushSystem(`Co-write · ${args.configs.cowrite.artifactKind}`);
        break;
      case "interview":
        pushSystem(`Interview · ${args.configs.interview.topic}`);
        break;
      case "negotiate":
        pushSystem(`Negotiation · ${args.configs.negotiate.scenario}`);
        break;
      case "story":
        pushSystem(`Story · ${args.configs.story.style}`);
        break;
    }
  }

  return {
    messages,
    running,
    error,
    artifact,
    resolvedPersonas,
    start,
    stop,
    reset,
    interrupt,
  };
}
