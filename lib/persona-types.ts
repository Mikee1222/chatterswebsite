/**
 * Model Persona field shapes + AI allowlist keys.
 * Physique + Intimate Details are NEVER sent to AI.
 */

export const PERSONA_SECTIONS = [
  "bio",
  "personal_info",
  "chatting",
  "lifestyle",
  "physique",
  "content",
  "intimate_details",
  "socials",
  "live_updates",
] as const;

export type PersonaSectionKey = (typeof PERSONA_SECTIONS)[number];

export const SENSITIVE_PERSONA_SECTIONS = ["physique", "intimate_details"] as const;
export type SensitivePersonaSection = (typeof SENSITIVE_PERSONA_SECTIONS)[number];

export function isSensitivePersonaSection(key: string): key is SensitivePersonaSection {
  return (SENSITIVE_PERSONA_SECTIONS as readonly string[]).includes(key);
}

/** Helper copy shown under section headers. */
export const PERSONA_DESCRIPTIVE_HINT =
  "Be descriptive: the more detail, the better";

export type PersonaAiContextFlags = {
  religion: boolean;
  ideology: boolean;
  relationship: boolean;
  orientation: boolean;
};

export const DEFAULT_AI_CONTEXT_FLAGS: PersonaAiContextFlags = {
  religion: false,
  ideology: false,
  relationship: false,
  orientation: false,
};

export type PersonaPersonalInfo = {
  name?: string;
  nicknames?: string[];
  gender?: string;
  birth_date?: string; // YYYY-MM-DD
  relationship_status?: string;
  orientation?: string;
  country?: string;
  timezone?: string;
  city_area?: string;
  travelling_now?: boolean;
  travelling_where?: string;
  grew_up?: string;
  current_work?: string;
  previous_jobs?: string;
  languages?: Array<{ language: string; level?: string; dialect?: string }>;
  education?: string;
  children?: string;
  pets?: string;
  siblings?: string;
  religious_beliefs?: string;
  ideological_beliefs?: string;
  online_persona_description?: string;
  anything_else?: string;
};

export type PersonaChatting = {
  persona_type?: string;
  chatting_strategy?: string;
  multilingual?: boolean;
  writing_level?: string;
  explicitness_level?: string;
  punctuation_style?: string;
  capitalisation_style?: string;
  laughter_writing?: string;
  slang?: string;
  favourite_emojis?: string[];
  nicknames_for_fans?: string[];
  info_to_collect_about_fans?: string;
  topics_to_avoid?: string;
  topics_to_care?: string;
  words_phrases_to_avoid?: string[];
  topics_she_loves?: string;
  how_fans_should_feel?: string;
  not_creator_claim_replies?: string;
};

export type PersonaLifestyle = {
  dreams_goals?: string;
  hobbies?: string;
  workout?: string;
  typical_day?: string;
  morning_routine?: string;
  night_routine?: string;
  weekends?: string;
  fav_foods?: string;
  fav_drinks?: string;
  fav_color?: string;
  fav_music?: string;
  fav_books?: string;
  fav_movies?: string;
  drinking?: string;
  smoking?: string;
  funny_story?: string;
  unexpected_facts?: string;
  sports_watched?: string;
};

export type PersonaPhysique = {
  body_type?: string;
  ethnic_background?: string;
  hair?: string;
  eyes?: string;
  height?: string;
  weight?: string;
  cup_size?: string;
  tattoos?: boolean;
  tattoos_where?: string;
  piercings?: boolean;
  piercings_where?: string;
  notes?: string;
};

export type PersonaContent = {
  niche?: string;
  custom_gfe?: boolean;
  custom_ratings?: boolean;
  custom_customs?: boolean;
  custom_vip?: boolean;
  custom_wall_post_campaigns?: boolean;
  custom_physical_goods?: boolean;
  content_offered?: string;
  red_lines?: string;
};

export type PersonaIntimateDetails = {
  why_started?: string;
  attraction_who_why?: string;
  turn_ons?: string;
  fetishes?: string;
  experiences?: string;
  open_relationships_view?: string;
};

export type PersonaSocials = {
  other_nsfw_platforms?: string;
  social_platforms?: string;
  handles?: Array<{ platform: string; handle: string }>;
  unavailable_social_content?: string;
  unavailable_example_reply?: string;
};

export type PersonaSectionData = {
  bio: string;
  personal_info: PersonaPersonalInfo;
  chatting: PersonaChatting;
  lifestyle: PersonaLifestyle;
  physique: PersonaPhysique;
  content: PersonaContent;
  intimate_details: PersonaIntimateDetails;
  socials: PersonaSocials;
};

export type ModelPersona = PersonaSectionData & {
  id: string;
  model_id: string;
  ai_context_flags: PersonaAiContextFlags;
  draft: PersonaSectionData | null;
  last_updated_by: string;
  last_updated_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ModelPersonaLiveUpdate = {
  id: string;
  persona_id: string;
  content: string;
  status: string;
  starts_at: string;
  ends_at: string;
  is_live: boolean;
  show_when_inactive: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ModelPersonaRevision = {
  id: string;
  persona_id: string;
  snapshot: Record<string, unknown>;
  saved_by: string;
  saved_by_name: string;
  created_at: string;
};

export const MAX_ACTIVE_LIVE_UPDATES = 7;

/** Keys allowed in AI Creative Studio / Gunzo get_model_persona context. */
export const AI_PERSONA_ALLOWLIST_KEYS = [
  "bio",
  "personal_info.name",
  "personal_info.nicknames",
  "personal_info.gender",
  "personal_info.birth_date", // age check only; value may be age band in builder
  "personal_info.country",
  "personal_info.timezone",
  "personal_info.city_area",
  "personal_info.travelling_now",
  "personal_info.travelling_where",
  "personal_info.grew_up",
  "personal_info.current_work",
  "personal_info.previous_jobs",
  "personal_info.languages",
  "personal_info.education",
  "personal_info.children",
  "personal_info.pets",
  "personal_info.siblings",
  "personal_info.online_persona_description",
  "personal_info.anything_else",
  // Opt-in only (flagged):
  "personal_info.relationship_status",
  "personal_info.orientation",
  "personal_info.religious_beliefs",
  "personal_info.ideological_beliefs",
  "chatting.persona_type",
  "chatting.chatting_strategy",
  "chatting.multilingual",
  "chatting.writing_level",
  "chatting.punctuation_style",
  "chatting.capitalisation_style",
  "chatting.laughter_writing",
  "chatting.slang",
  "chatting.favourite_emojis",
  "chatting.nicknames_for_fans",
  "chatting.topics_to_avoid",
  "chatting.topics_to_care",
  "chatting.words_phrases_to_avoid",
  "chatting.topics_she_loves",
  "chatting.how_fans_should_feel",
  "chatting.not_creator_claim_replies",
  // Note: chatting.explicitness_level is chatting-only — NOT in social AI allowlist
  "lifestyle",
  "content.niche",
  "content.content_offered",
  "content.red_lines",
  "content.custom_gfe",
  "content.custom_ratings",
  "content.custom_customs",
  "content.custom_vip",
  "content.custom_wall_post_campaigns",
  "content.custom_physical_goods",
  "socials.social_platforms",
  "socials.handles",
  "socials.unavailable_social_content",
  "socials.unavailable_example_reply",
  "live_updates",
] as const;

/** Never included in AI context. */
export const AI_PERSONA_BLOCKED_KEYS = [
  "physique",
  "intimate_details",
  "chatting.explicitness_level",
  "socials.other_nsfw_platforms",
] as const;

export const EMPTY_PERSONA_SECTIONS: PersonaSectionData = {
  bio: "",
  personal_info: {},
  chatting: {},
  lifestyle: {},
  physique: {},
  content: {},
  intimate_details: {},
  socials: {},
};

export const PERSONA_SECTION_LABELS: Record<PersonaSectionKey, string> = {
  bio: "Bio",
  personal_info: "Personal Info",
  chatting: "Chatting",
  lifestyle: "Lifestyle",
  physique: "Physique",
  content: "Content",
  intimate_details: "Intimate Details",
  socials: "Socials",
  live_updates: "Live Updates",
};

/** List-page summary — never includes sensitive section content. */
export type PersonaListSummary = {
  id: string;
  model_id: string;
  updated_at: string;
  last_updated_by_name: string;
  has_birth_date: boolean;
  is_adult: boolean;
  persona_type: string;
  has_live_updates: boolean;
  live_update_count: number;
  /** 0–1 using non-sensitive sections only (safe for all viewers). */
  completeness: number;
  /** Per-section scores; sensitive keys omitted from payload. */
  section_scores: Record<string, number>;
};

/** Fields that feed AI (for UI tooltips). Sensitive sections never listed. */
export const PERSONA_AI_FEED_HINTS: Partial<Record<PersonaSectionKey, string>> = {
  bio: "Feeds AI captions & text-on-screen voice",
  personal_info: "Feeds AI when filled; religion/ideology/relationship/orientation only if tagged usable",
  chatting: "Writing voice + avoid words feed AI (explicitness stays chatting-only)",
  lifestyle: "Feeds AI for lifestyle-flavoured captions",
  content: "Niche, offerings & red lines feed AI guardrails",
  socials: "Handles & unavailable-content replies feed AI",
  live_updates: "Active live entries feed AI context",
  physique: "Never sent to AI",
  intimate_details: "Never sent to AI",
};
