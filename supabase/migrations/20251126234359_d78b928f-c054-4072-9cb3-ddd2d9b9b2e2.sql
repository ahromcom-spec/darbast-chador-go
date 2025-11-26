-- حذف policy قدیمی که امکان حذف همه media را می‌داد
DROP POLICY IF EXISTS "Users can delete own project media" ON public.project_media;

-- policy جدید که فقط media تایید نشده را حذف می‌کند از قبل وجود دارد و کافی است