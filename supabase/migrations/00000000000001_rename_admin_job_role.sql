BEGIN;

-- Rename job role code
UPDATE public.job_roles
SET code = 'BACKOFFICE', name = 'Office Staff'
WHERE code = 'ADMIN';

-- Update employees referencing ADMIN
UPDATE public.employees
SET job_role = 'BACKOFFICE'
WHERE job_role = 'ADMIN';

-- Update rubrics referencing ADMIN
UPDATE public.rubrics
SET role_code = 'BACKOFFICE'
WHERE role_code = 'ADMIN';

COMMIT;
