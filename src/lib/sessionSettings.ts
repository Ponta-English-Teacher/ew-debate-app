export interface SessionSettings {
  feature_how_to_say:      boolean;
  feature_edit_english:    boolean;
  feature_explain_post:    boolean;
  feature_talk_it_through: boolean;
  feature_model_debate:    boolean;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  feature_how_to_say:      true,
  feature_edit_english:    true,
  feature_explain_post:    false,
  feature_talk_it_through: true,
  feature_model_debate:    true,
};

// Merge DB value (may be partial / null) with defaults
export function mergeSettings(raw: Partial<SessionSettings> | null | undefined): SessionSettings {
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}
