-- Clean up orphaned data from failed driver creation attempts
DELETE FROM profiles WHERE email = 'mmatambo.mm@gmail.com' AND user_type = 'driver';
DELETE FROM profiles WHERE email = 'daniel.owl91@gmail.com' AND user_type = 'driver';