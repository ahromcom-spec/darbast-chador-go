-- Convert all scheduled orders to pending_execution
UPDATE projects_v3 
SET status = 'pending_execution'::project_status_v3
WHERE status = 'scheduled';