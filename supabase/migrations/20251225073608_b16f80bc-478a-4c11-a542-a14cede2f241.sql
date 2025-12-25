-- Create a function to increment sort_order for multiple photos at once
CREATE OR REPLACE FUNCTION increment_photo_sort_orders(photo_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profile_photos
  SET sort_order = sort_order + 1
  WHERE id = ANY(photo_ids);
END;
$$;