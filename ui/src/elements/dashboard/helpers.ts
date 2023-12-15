import {CreateProject, Project, Topic} from './ngm-dashboard';

export function isProject(projectOrTopic: Project | CreateProject | Topic | undefined): projectOrTopic is Project {
    const project = <Project> projectOrTopic;
    return !!project?.owner && !!project?.created;
}