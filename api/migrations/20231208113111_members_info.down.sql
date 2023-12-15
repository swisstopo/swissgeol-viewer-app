UPDATE projects
SET project = jsonb_set(
        project,
        '{owner}',
        to_jsonb(project->'owner'->>'email')
);