import {getAccessToken} from './auth';

import type {Project} from './elements/ngm-dashboard';

export class ApiClient {
    token: string | null;

    constructor() {
      this.token = getAccessToken();
    }

    addAuthorization(headers: any) {
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
    }

    getProject(id: string): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
      };

      this.addAuthorization(headers);

      return fetch(`/api/projects/${id}`, {
        method: 'GET',
        headers: headers,
      });
    }


    getProjects(): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
      };

      this.addAuthorization(headers);

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

      this.addAuthorization(headers);

      return fetch('/api/projects/duplicate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(project),
      });
    }
  }
