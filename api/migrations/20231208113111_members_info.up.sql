UPDATE projects
SET project = jsonb_set(
        project,
        '{owner}',
        jsonb_build_object('name', project->>'owner', 'email', project->>'owner', 'surname', '')
);