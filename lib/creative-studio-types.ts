export type CreativeIdeaType = "caption" | "text_on_screen" | "video_analysis";

export type CreativeIdea = {
  id: string;
  model_id: string;
  idea_type: CreativeIdeaType;
  platform: string;
  title: string;
  content: string;
  meta: Record<string, unknown>;
  is_favourite: boolean;
  thumbs: -1 | 0 | 1;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type VideoAnalysisJson = {
  setting?: string;
  outfit?: string;
  activity?: string;
  mood_vibe?: string;
  objects_props?: string[];
  visible_text?: string[];
  quality_flags?: {
    blur?: boolean;
    dark?: boolean;
    wrong_orientation?: boolean;
    not_9_16?: boolean;
    watermark?: boolean;
  };
  suggested_hooks?: string[];
  suggested_caption_angles?: string[];
  refusal?: boolean;
  refusal_message?: string;
};
