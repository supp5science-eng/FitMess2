import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Jarvis v1 action catalog (2026-08-25) — the agent's hands.
 *
 * v1 actions are all NAVIGATIONAL: Jarvis answers, and when the user's
 * message is a request to DO something, she brings the right flow as a card
 * instead of explaining where to tap. The model only ever picks action IDS
 * from this list (constrained by the response schema); the route resolves
 * them through `AGENT_ACTIONS` so a hallucinated id simply drops out, and
 * the card's copy comes from i18n on the client — the model cannot write a
 * button.
 *
 * v2 (planned, not here): mutating actions — "izbriši mi ručak", "promeni
 * cilj" — each behind an explicit in-chat confirmation. Keep them OUT of
 * this catalog until that confirmation UI exists.
 */
export const AGENT_ACTION_IDS = [
  "prizma_unos",
  "slikaj_obrok",
  "gric",
  "deklaracija",
  "trening",
  "danas",
  "analitika",
  "merenje",
  "podesavanja",
] as const;

export type AgentActionId = (typeof AGENT_ACTION_IDS)[number];

export interface AgentActionDef {
  id: AgentActionId;
  href: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  /** What the MODEL reads about this action (Serbian, goes into the system
   * prompt) — when to offer it. */
  promptHint: string;
}

export const AGENT_ACTIONS: Record<AgentActionId, AgentActionDef> = {
  prizma_unos: {
    id: "prizma_unos",
    href: "/dodaj/najtacnije",
    titleKey: "agent.action.prizma_unos.title",
    descKey: "agent.action.prizma_unos.desc",
    promptHint:
      "Jarvis — najtačniji unos obroka (dve fotke + pitanja); prva ponuda kad korisnik hoće da loguje pravi obrok (i kad kaže 'otvori Jarvisa')",
  },
  slikaj_obrok: {
    id: "slikaj_obrok",
    href: "/dodaj/obrok",
    titleKey: "agent.action.slikaj_obrok.title",
    descKey: "agent.action.slikaj_obrok.desc",
    promptHint: "najbrži unos obroka — jedna fotografija, bez pitanja",
  },
  gric: {
    id: "gric",
    href: "/dodaj/gric",
    titleKey: "agent.action.gric.title",
    descKey: "agent.action.gric.desc",
    promptHint:
      "izgovoren/ukucan unos ('dva jaja i jogurt') — za sitnice i kad nema slike",
  },
  deklaracija: {
    id: "deklaracija",
    href: "/dodaj/deklaracija",
    titleKey: "agent.action.deklaracija.title",
    descKey: "agent.action.deklaracija.desc",
    promptHint: "slikanje deklaracije proizvoda sa pakovanja",
  },
  trening: {
    id: "trening",
    href: "/dodaj/trening",
    titleKey: "agent.action.trening.title",
    descKey: "agent.action.trening.desc",
    promptHint: "upis treninga/aktivnosti",
  },
  danas: {
    id: "danas",
    href: "/danas",
    titleKey: "agent.action.danas.title",
    descKey: "agent.action.danas.desc",
    promptHint: "današnji pregled (ring, obroci, voda, koraci)",
  },
  analitika: {
    id: "analitika",
    href: "/analitika",
    titleKey: "agent.action.analitika.title",
    descKey: "agent.action.analitika.desc",
    promptHint: "nedeljna analitika, trendovi, istorija obroka i merenja",
  },
  merenje: {
    id: "merenje",
    href: "/merenje",
    titleKey: "agent.action.merenje.title",
    descKey: "agent.action.merenje.desc",
    promptHint: "upis telesne težine (nedeljno merenje)",
  },
  podesavanja: {
    id: "podesavanja",
    href: "/profil",
    titleKey: "agent.action.podesavanja.title",
    descKey: "agent.action.podesavanja.desc",
    promptHint: "podešavanja: cilj, podaci, podsetnici, nalog",
  },
};

/** The catalog as the system prompt states it — one line per action. */
export function describeAgentActions(): string {
  return AGENT_ACTION_IDS.map(
    (id) => `- ${id}: ${AGENT_ACTIONS[id].promptHint}`
  ).join("\n");
}
