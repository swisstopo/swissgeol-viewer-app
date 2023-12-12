UPDATE projects
SET project = jsonb_set(project, '{editors}', project->'members') - 'members'
WHERE project ? 'members';