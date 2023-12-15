UPDATE projects
SET project = jsonb_set(project, '{members}', project->'editors') - 'editors'
WHERE project ? 'editors';