/** One line of "which models ran this call": every call of one role to one model, from the budget ledger. */
export interface TraceRow {
  /** The ledger's name for the role (`character-turn`, `audit`, ...); the interface turns it into a label. */
  kind: string;
  model: string;
  /** Where it ran: Meta's hosted API or an open-weights host. */
  served: string;
  /** Open weights: the model Meta published, served by a partner. */
  open: boolean;
  calls: number;
  /** Median time of a call; null where the ledger's time is not a latency (speech recognition records the length of the audio). */
  medianMs: number | null;
  costUsd: number;
}
