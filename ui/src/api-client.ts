import Auth from './auth';
import AuthStore from './store/auth';

import type {Project} from './elements/ngm-dashboard';


export class ApiClient {
    token = Auth.getAccessToken();

    constructor() {
      AuthStore.user.subscribe(() => {
        this.token = Auth.getAccessToken();
      });
    }

    updateProject(project: Project): Promise<Response> {
      const headers = {
        'Content-Type': 'application/json'
      };

      addAuthorization(headers, this.token);

      return fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(project),
      });
    }


    getProject(id: string): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
      };

      addAuthorization(headers, this.token);

      return fetch(`/api/projects/${id}`, {
        method: 'GET',
        headers: headers,
      });
    }


    getProjects(): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
      };

      addAuthorization(headers, this.token);

      return fetch('/api/projects', {
        method: 'GET',
        headers: headers,
      });
    }

    duplicateProject(project: Project): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      addAuthorization(headers, this.token);

      return fetch('/api/projects/duplicate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(project),
      });
    }
  }


function addAuthorization(headers: any, token: string) {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}
