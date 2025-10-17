-- =============================================
-- 360-Degree Reputation System for Ahrom Platform
-- =============================================

-- 1. Enum for rating types
CREATE TYPE rating_type AS ENUM (
  'customer_to_contractor',
  'contractor_to_customer',
  'staff_to_contractor',
  'contractor_to_staff',
  'customer_to_staff',
  'staff_to_customer'
);

-- 2. Enum for rating contexts
CREATE TYPE rating_context AS ENUM (
  'project_completion',
  'service_quality',
  'communication',
  'professionalism',
  'punctuality'
);

-- 3. Table: Rating Criteria (معیارهای امتیازدهی)
CREATE TABLE public.rating_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_type rating_type NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight NUMERIC(3,2) DEFAULT 1.0, -- وزن معیار در محاسبه نهایی
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rating_type, key)
);

-- 4. Table: Ratings (امتیازات)
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects_v3(id) ON DELETE CASCADE,
  rating_type rating_type NOT NULL,
  rater_id UUID REFERENCES profiles(user_id) NOT NULL, -- امتیاز‌دهنده
  rated_id UUID REFERENCES profiles(user_id) NOT NULL, -- امتیاز‌گیرنده
  overall_score NUMERIC(3,2) CHECK (overall_score >= 1 AND overall_score <= 5),
  criteria_scores JSONB, -- {"quality": 5, "punctuality": 4, "communication": 5}
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false, -- تایید شده توسط سیستم
  helpful_count INTEGER DEFAULT 0, -- تعداد "مفید بود"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, rater_id, rated_id, rating_type)
);

-- 5. Table: Rating Responses (پاسخ به امتیازات - حق پاسخگویی)
CREATE TABLE public.rating_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES ratings(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES profiles(user_id) NOT NULL,
  response TEXT NOT NULL,
  is_official BOOLEAN DEFAULT true, -- پاسخ رسمی
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rating_id, responder_id)
);

-- 6. Table: Reputation Scores (نمایه اعتبار)
CREATE TABLE public.reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) UNIQUE NOT NULL,
  overall_score NUMERIC(4,2) DEFAULT 0, -- میانگین کلی (0-5)
  total_ratings INTEGER DEFAULT 0,
  customer_score NUMERIC(4,2), -- امتیاز به عنوان مشتری
  contractor_score NUMERIC(4,2), -- امتیاز به عنوان پیمانکار
  staff_score NUMERIC(4,2), -- امتیاز به عنوان پرسنل
  trust_level TEXT DEFAULT 'new', -- new, bronze, silver, gold, platinum
  verified_projects INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Table: Rating Helpful Votes (رای‌های مفید بودن)
CREATE TABLE public.rating_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES ratings(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES profiles(user_id) NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rating_id, voter_id)
);

-- =============================================
-- Functions
-- =============================================

-- Function: محاسبه امتیاز اعتبار
CREATE OR REPLACE FUNCTION calculate_reputation_score(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overall NUMERIC;
  v_total INTEGER;
  v_customer NUMERIC;
  v_contractor NUMERIC;
  v_staff NUMERIC;
  v_verified INTEGER;
  v_trust TEXT;
BEGIN
  -- محاسبه میانگین کلی
  SELECT 
    COALESCE(AVG(overall_score), 0),
    COUNT(*)
  INTO v_overall, v_total
  FROM ratings
  WHERE rated_id = _user_id AND is_verified = true;

  -- امتیاز به عنوان مشتری
  SELECT AVG(overall_score) INTO v_customer
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('contractor_to_customer', 'staff_to_customer')
    AND is_verified = true;

  -- امتیاز به عنوان پیمانکار
  SELECT AVG(overall_score) INTO v_contractor
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('customer_to_contractor', 'staff_to_contractor')
    AND is_verified = true;

  -- امتیاز به عنوان پرسنل
  SELECT AVG(overall_score) INTO v_staff
  FROM ratings
  WHERE rated_id = _user_id 
    AND rating_type IN ('customer_to_staff', 'contractor_to_staff')
    AND is_verified = true;

  -- تعداد پروژه‌های تایید شده
  SELECT COUNT(DISTINCT project_id) INTO v_verified
  FROM ratings
  WHERE rated_id = _user_id AND is_verified = true;

  -- تعیین سطح اعتماد
  v_trust := CASE
    WHEN v_total >= 50 AND v_overall >= 4.5 THEN 'platinum'
    WHEN v_total >= 25 AND v_overall >= 4.0 THEN 'gold'
    WHEN v_total >= 10 AND v_overall >= 3.5 THEN 'silver'
    WHEN v_total >= 3 AND v_overall >= 3.0 THEN 'bronze'
    ELSE 'new'
  END;

  -- ثبت یا به‌روزرسانی
  INSERT INTO reputation_scores (
    user_id, overall_score, total_ratings, 
    customer_score, contractor_score, staff_score,
    trust_level, verified_projects, last_calculated_at
  ) VALUES (
    _user_id, v_overall, v_total,
    v_customer, v_contractor, v_staff,
    v_trust, v_verified, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    total_ratings = EXCLUDED.total_ratings,
    customer_score = EXCLUDED.customer_score,
    contractor_score = EXCLUDED.contractor_score,
    staff_score = EXCLUDED.staff_score,
    trust_level = EXCLUDED.trust_level,
    verified_projects = EXCLUDED.verified_projects,
    last_calculated_at = now(),
    updated_at = now();
END;
$$;

-- Function: Trigger برای به‌روزرسانی خودکار reputation
CREATE OR REPLACE FUNCTION update_reputation_on_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- به‌روزرسانی امتیاز امتیاز‌گیرنده
  PERFORM calculate_reputation_score(NEW.rated_id);
  
  -- تایید خودکار امتیازات از پروژه‌های بسته شده
  IF EXISTS (
    SELECT 1 FROM projects_v3 
    WHERE id = NEW.project_id AND status = 'closed'
  ) THEN
    NEW.is_verified := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function: به‌روزرسانی helpful_count
CREATE OR REPLACE FUNCTION update_rating_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ratings
  SET helpful_count = (
    SELECT COUNT(*) 
    FROM rating_helpful_votes 
    WHERE rating_id = NEW.rating_id AND is_helpful = true
  )
  WHERE id = NEW.rating_id;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- Triggers
-- =============================================

CREATE TRIGGER on_rating_insert_or_update
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_reputation_on_rating();

CREATE TRIGGER on_helpful_vote_change
AFTER INSERT OR UPDATE OR DELETE ON rating_helpful_votes
FOR EACH ROW
EXECUTE FUNCTION update_rating_helpful_count();

CREATE TRIGGER update_ratings_timestamp
BEFORE UPDATE ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rating_responses_timestamp
BEFORE UPDATE ON rating_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Initial Rating Criteria (معیارهای پیش‌فرض)
-- =============================================

INSERT INTO rating_criteria (rating_type, key, title, description, weight) VALUES
-- مشتری به پیمانکار
('customer_to_contractor', 'quality', 'کیفیت کار', 'کیفیت اجرای پروژه', 1.5),
('customer_to_contractor', 'punctuality', 'زمان‌بندی', 'رعایت زمان‌بندی پروژه', 1.2),
('customer_to_contractor', 'communication', 'ارتباطات', 'کیفیت ارتباطات و پاسخگویی', 1.0),
('customer_to_contractor', 'professionalism', 'حرفه‌ای بودن', 'رفتار حرفه‌ای و اخلاق کاری', 1.0),
('customer_to_contractor', 'safety', 'ایمنی', 'رعایت استانداردهای ایمنی', 1.3),

-- پیمانکار به مشتری
('contractor_to_customer', 'payment', 'پرداخت', 'به‌موقع بودن پرداخت‌ها', 1.5),
('contractor_to_customer', 'communication', 'ارتباطات', 'وضوح در ارتباطات', 1.0),
('contractor_to_customer', 'cooperation', 'همکاری', 'میزان همکاری در پروژه', 1.0),
('contractor_to_customer', 'requirements', 'شفافیت', 'شفافیت در بیان نیازها', 1.2),

-- پرسنل به پیمانکار
('staff_to_contractor', 'management', 'مدیریت پروژه', 'کیفیت مدیریت و هماهنگی', 1.3),
('staff_to_contractor', 'payment', 'پرداخت', 'به‌موقع بودن پرداخت حقوق', 1.5),
('staff_to_contractor', 'work_environment', 'محیط کار', 'کیفیت محیط کار', 1.0),
('staff_to_contractor', 'support', 'پشتیبانی', 'پشتیبانی و تجهیزات', 1.2),

-- پیمانکار به پرسنل
('contractor_to_staff', 'skill', 'مهارت', 'سطح مهارت فنی', 1.5),
('contractor_to_staff', 'reliability', 'قابلیت اطمینان', 'قابل اعتماد بودن', 1.3),
('contractor_to_staff', 'teamwork', 'کار تیمی', 'همکاری با تیم', 1.0),
('contractor_to_staff', 'initiative', 'ابتکار عمل', 'خلاقیت و حل مسئله', 1.0),

-- مشتری به پرسنل
('customer_to_staff', 'service', 'خدمات', 'کیفیت خدمات ارائه شده', 1.3),
('customer_to_staff', 'communication', 'ارتباطات', 'ارتباطات موثر', 1.0),
('customer_to_staff', 'professionalism', 'حرفه‌ای بودن', 'رفتار حرفه‌ای', 1.2),

-- پرسنل به مشتری
('staff_to_customer', 'respect', 'احترام', 'رفتار محترمانه', 1.0),
('staff_to_customer', 'cooperation', 'همکاری', 'همکاری در انجام کار', 1.2),
('staff_to_customer', 'clarity', 'شفافیت', 'شفافیت در درخواست‌ها', 1.0);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE rating_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_helpful_votes ENABLE ROW LEVEL SECURITY;

-- Rating Criteria: همه می‌توانند ببینند
CREATE POLICY "Anyone can view active criteria"
ON rating_criteria FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage criteria"
ON rating_criteria FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ratings: 
CREATE POLICY "Users can view ratings for themselves"
ON ratings FOR SELECT
USING (auth.uid() = rated_id OR auth.uid() = rater_id);

CREATE POLICY "Users can view public ratings of others"
ON ratings FOR SELECT
USING (is_anonymous = false AND is_verified = true);

CREATE POLICY "Users can create ratings for completed projects"
ON ratings FOR INSERT
WITH CHECK (
  auth.uid() = rater_id AND
  EXISTS (
    SELECT 1 FROM projects_v3 
    WHERE id = project_id 
      AND status IN ('completed', 'paid', 'closed')
      AND (
        -- مشتری می‌تواند به پیمانکار و پرسنل امتیاز دهد
        (EXISTS (SELECT 1 FROM customers WHERE id = customer_id AND user_id = auth.uid()))
        OR
        -- پیمانکار می‌تواند به مشتری امتیاز دهد
        (EXISTS (SELECT 1 FROM contractors WHERE id = contractor_id AND user_id = auth.uid()))
        OR
        -- پرسنل می‌تواند امتیاز دهد
        (has_role(auth.uid(), 'scaffold_supervisor'::app_role))
      )
  )
);

CREATE POLICY "Users can update their own ratings within 7 days"
ON ratings FOR UPDATE
USING (auth.uid() = rater_id AND created_at > now() - INTERVAL '7 days');

CREATE POLICY "Admins can manage all ratings"
ON ratings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Rating Responses:
CREATE POLICY "Anyone can view responses"
ON rating_responses FOR SELECT
USING (true);

CREATE POLICY "Rated users can respond to their ratings"
ON rating_responses FOR INSERT
WITH CHECK (
  auth.uid() = responder_id AND
  EXISTS (
    SELECT 1 FROM ratings 
    WHERE id = rating_id AND rated_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own responses"
ON rating_responses FOR UPDATE
USING (auth.uid() = responder_id);

-- Reputation Scores:
CREATE POLICY "Anyone can view reputation scores"
ON reputation_scores FOR SELECT
USING (true);

CREATE POLICY "System can manage reputation scores"
ON reputation_scores FOR ALL
USING (true); -- محاسبه خودکار توسط trigger

-- Helpful Votes:
CREATE POLICY "Authenticated users can vote"
ON rating_helpful_votes FOR INSERT
WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "Users can update their votes"
ON rating_helpful_votes FOR UPDATE
USING (auth.uid() = voter_id);

CREATE POLICY "Users can view vote counts"
ON rating_helpful_votes FOR SELECT
USING (true);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX idx_ratings_rated_id ON ratings(rated_id);
CREATE INDEX idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX idx_ratings_project_id ON ratings(project_id);
CREATE INDEX idx_ratings_verified ON ratings(is_verified);
CREATE INDEX idx_reputation_scores_user_id ON reputation_scores(user_id);
CREATE INDEX idx_reputation_scores_trust_level ON reputation_scores(trust_level);
CREATE INDEX idx_rating_responses_rating_id ON rating_responses(rating_id);
CREATE INDEX idx_helpful_votes_rating_id ON rating_helpful_votes(rating_id);