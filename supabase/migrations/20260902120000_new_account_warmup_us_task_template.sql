-- Seed task template: New Account Warm-Up (US)
-- Idempotent: skips if template name already exists.

DO $$
DECLARE
  v_template_id uuid;
  v_phase_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.task_templates WHERE name = 'New Account Warm-Up (US)' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'Template "New Account Warm-Up (US)" already exists (%), skipping.', v_existing;
    RETURN;
  END IF;

  INSERT INTO public.task_templates (template_id, name, description, category, is_active, created_at)
  VALUES ('tpl_new_account_warmup_us', 'New Account Warm-Up (US)', '7-day gradual warm-up protocol for newly-created accounts before resuming normal daily posting cadence. Days 1-4: engagement-only, no posting, no follows. Days 4-7: engagement + first content + follows. After Day 7, manager decides next steps.', 'marketing', true, now())
  RETURNING id INTO v_template_id;

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_1_warmup_us', ARRAY[v_template_id], 1, 'Stage 1 - Days 1-4 (11am-2pm)', 'Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (20m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 30 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 3', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_4_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (20m)', '', false, 4, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_5_warmup_us', ARRAY[v_phase_id], 'Facebook Like 30 posts', 'Niche-relevant only', false, 5, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_6_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 3', '', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_7_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_8_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (20m)', '', false, 8, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_9_warmup_us', ARRAY[v_phase_id], 'TikTok Like 30 posts', 'Niche-relevant only', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_10_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 3', '', false, 10, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_11_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_12_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (20m)', '', false, 12, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_13_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 30 posts', 'Niche-relevant only', false, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_14_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 3', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_1_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 15, 'Engagement');

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_2_warmup_us', ARRAY[v_template_id], 2, 'Stage 1 - Days 1-4 (3pm-6pm)', 'Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (20m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 30 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 3', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_4_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (20m)', '', false, 4, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_5_warmup_us', ARRAY[v_phase_id], 'Facebook Like 30 posts', 'Niche-relevant only', false, 5, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_6_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 3', '', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_7_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_8_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (20m)', '', false, 8, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_9_warmup_us', ARRAY[v_phase_id], 'TikTok Like 30 posts', 'Niche-relevant only', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_10_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 3', '', false, 10, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_11_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_12_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (20m)', '', false, 12, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_13_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 30 posts', 'Niche-relevant only', false, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_14_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 3', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_2_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 15, 'Engagement');

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_3_warmup_us', ARRAY[v_template_id], 3, 'Stage 1 - Days 1-4 (7pm-9pm)', 'Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (20m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 30 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 3', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_4_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (20m)', '', false, 4, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_5_warmup_us', ARRAY[v_phase_id], 'Facebook Like 30 posts', 'Niche-relevant only', false, 5, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_6_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 3', '', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_7_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_8_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (20m)', '', false, 8, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_9_warmup_us', ARRAY[v_phase_id], 'TikTok Like 30 posts', 'Niche-relevant only', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_10_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 3', '', false, 10, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_11_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_12_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (20m)', '', false, 12, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_13_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 30 posts', 'Niche-relevant only', false, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_14_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 3', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_3_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (3)', '3 comments on other accounts'' content to boost engagement', true, 15, 'Engagement');

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_4_warmup_us', ARRAY[v_template_id], 4, 'Stage 2 - Days 4-7 (11am-2pm)', 'Days 4-7 ramp — increased engagement, follows, and first content (post + daily story).')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (25m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 35 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 4', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_4_warmup_us', ARRAY[v_phase_id], 'Instagram Follow 10 accounts', '', false, 4, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_5_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (25m)', '', false, 5, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_6_warmup_us', ARRAY[v_phase_id], 'Facebook Like 35 posts', 'Niche-relevant only', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_7_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 4', '', false, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_8_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 8, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_9_warmup_us', ARRAY[v_phase_id], 'Facebook Follow 10 accounts', '', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_10_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (25m)', '', false, 10, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_11_warmup_us', ARRAY[v_phase_id], 'TikTok Like 35 posts', 'Niche-relevant only', false, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_12_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 4', '', false, 12, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_13_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_14_warmup_us', ARRAY[v_phase_id], 'TikTok Follow 10 accounts', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (25m)', '', false, 15, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_16_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 35 posts', 'Niche-relevant only', false, 16, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_17_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 4', '', false, 17, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_18_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 18, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_19_warmup_us', ARRAY[v_phase_id], 'Snapchat Follow 10 accounts', '', false, 19, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_20_warmup_us', ARRAY[v_phase_id], 'Post Instagram Content', '', false, 20, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_21_warmup_us', ARRAY[v_phase_id], 'Post Facebook Content', '', false, 21, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_22_warmup_us', ARRAY[v_phase_id], 'Post TikTok Content', '', false, 22, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_23_warmup_us', ARRAY[v_phase_id], 'Post Snapchat Content', '', false, 23, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_24_warmup_us', ARRAY[v_phase_id], 'Post Instagram Story (Daily)', '', false, 24, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_25_warmup_us', ARRAY[v_phase_id], 'Post Facebook Story (Daily)', '', false, 25, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_26_warmup_us', ARRAY[v_phase_id], 'Post TikTok Story (Daily)', '', false, 26, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_4_27_warmup_us', ARRAY[v_phase_id], 'Post Snapchat Story (Daily)', '', false, 27, 'Posting');

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_5_warmup_us', ARRAY[v_template_id], 5, 'Stage 2 - Days 4-7 (3pm-6pm)', 'Days 4-7 ramp — increased engagement and follows.')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (25m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 35 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 4', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_4_warmup_us', ARRAY[v_phase_id], 'Instagram Follow 10 accounts', '', false, 4, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_5_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (25m)', '', false, 5, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_6_warmup_us', ARRAY[v_phase_id], 'Facebook Like 35 posts', 'Niche-relevant only', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_7_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 4', '', false, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_8_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 8, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_9_warmup_us', ARRAY[v_phase_id], 'Facebook Follow 10 accounts', '', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_10_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (25m)', '', false, 10, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_11_warmup_us', ARRAY[v_phase_id], 'TikTok Like 35 posts', 'Niche-relevant only', false, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_12_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 4', '', false, 12, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_13_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_14_warmup_us', ARRAY[v_phase_id], 'TikTok Follow 10 accounts', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (25m)', '', false, 15, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_16_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 35 posts', 'Niche-relevant only', false, 16, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_17_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 4', '', false, 17, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_18_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 18, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_5_19_warmup_us', ARRAY[v_phase_id], 'Snapchat Follow 10 accounts', '', false, 19, 'Engagement');

  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)
  VALUES ('phase_tpl_6_warmup_us', ARRAY[v_template_id], 6, 'Stage 2 - Days 4-7 (7pm-9pm)', 'Days 4-7 ramp — increased engagement, follows, CTA stories, and comment replies.')
  RETURNING id INTO v_phase_id;

  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_0_warmup_us', ARRAY[v_phase_id], 'Instagram Scroll Time (25m)', '', false, 0, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_1_warmup_us', ARRAY[v_phase_id], 'Instagram Like 35 posts', 'Niche-relevant only', false, 1, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_2_warmup_us', ARRAY[v_phase_id], 'Instagram Repost 4', '', false, 2, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_3_warmup_us', ARRAY[v_phase_id], 'Instagram Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 3, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_4_warmup_us', ARRAY[v_phase_id], 'Instagram Follow 10 accounts', '', false, 4, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_5_warmup_us', ARRAY[v_phase_id], 'Facebook Scroll Time (25m)', '', false, 5, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_6_warmup_us', ARRAY[v_phase_id], 'Facebook Like 35 posts', 'Niche-relevant only', false, 6, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_7_warmup_us', ARRAY[v_phase_id], 'Facebook Repost 4', '', false, 7, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_8_warmup_us', ARRAY[v_phase_id], 'Facebook Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 8, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_9_warmup_us', ARRAY[v_phase_id], 'Facebook Follow 10 accounts', '', false, 9, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_10_warmup_us', ARRAY[v_phase_id], 'TikTok Scroll Time (25m)', '', false, 10, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_11_warmup_us', ARRAY[v_phase_id], 'TikTok Like 35 posts', 'Niche-relevant only', false, 11, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_12_warmup_us', ARRAY[v_phase_id], 'TikTok Repost 4', '', false, 12, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_13_warmup_us', ARRAY[v_phase_id], 'TikTok Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 13, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_14_warmup_us', ARRAY[v_phase_id], 'TikTok Follow 10 accounts', '', false, 14, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_15_warmup_us', ARRAY[v_phase_id], 'Snapchat Scroll Time (25m)', '', false, 15, 'Warm-up');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_16_warmup_us', ARRAY[v_phase_id], 'Snapchat Like 35 posts', 'Niche-relevant only', false, 16, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_17_warmup_us', ARRAY[v_phase_id], 'Snapchat Repost 4', '', false, 17, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_18_warmup_us', ARRAY[v_phase_id], 'Snapchat Engagement Comments (4)', '4 comments on other accounts'' content to boost engagement', true, 18, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_19_warmup_us', ARRAY[v_phase_id], 'Snapchat Follow 10 accounts', '', false, 19, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_20_warmup_us', ARRAY[v_phase_id], 'Post Instagram Story (CTA)', '', false, 20, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_21_warmup_us', ARRAY[v_phase_id], 'Post Facebook Story (CTA)', '', false, 21, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_22_warmup_us', ARRAY[v_phase_id], 'Post TikTok Story (CTA)', '', false, 22, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_23_warmup_us', ARRAY[v_phase_id], 'Post Snapchat Story (CTA)', '', false, 23, 'Posting');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_24_warmup_us', ARRAY[v_phase_id], 'Instagram Reply to Comments (if any)', '', true, 24, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_25_warmup_us', ARRAY[v_phase_id], 'Facebook Reply to Comments (if any)', '', true, 25, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_26_warmup_us', ARRAY[v_phase_id], 'TikTok Reply to Comments (if any)', '', true, 26, 'Engagement');
  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)
  VALUES ('item_tpl_6_27_warmup_us', ARRAY[v_phase_id], 'Snapchat Reply to Comments (if any)', '', true, 27, 'Engagement');

END $$;
