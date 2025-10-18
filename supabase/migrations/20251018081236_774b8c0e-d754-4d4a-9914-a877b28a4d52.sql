-- Update profile names for test phone numbers to match their positions
UPDATE profiles 
SET full_name = 'مدیریت کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09111111111';

UPDATE profiles 
SET full_name = 'مدیریت خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09011111111';

UPDATE profiles 
SET full_name = 'مدیر اجرایی کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09222222222';

UPDATE profiles 
SET full_name = 'مدیر اجرایی خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09012121212';

UPDATE profiles 
SET full_name = 'مدیر فروش کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09333333333';

UPDATE profiles 
SET full_name = 'مدیر فروش خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09013131313';

UPDATE profiles 
SET full_name = 'مدیر مالی کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09444444444';

UPDATE profiles 
SET full_name = 'مدیر مالی خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09014141414';

UPDATE profiles 
SET full_name = 'مدیر انبارداری کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09555555555';

UPDATE profiles 
SET full_name = 'مدیر انبارداری خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09015151515';

UPDATE profiles 
SET full_name = 'مدیر پشتیبانی و خواست کل'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09666666666';

UPDATE profiles 
SET full_name = 'مدیر پشتیبانی و خواست خدمات اجرای داربست به همراه اجناس'
FROM customers c
WHERE profiles.user_id = c.user_id 
AND profiles.phone_number = '09016161616';