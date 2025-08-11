-- Clean up the incomplete user setup
-- Delete auth user that has no profile (this will cascade properly)
DELETE FROM auth.users WHERE email = 'mmatambo.mm@gmail.com';