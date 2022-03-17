import Auth from './auth';
import AuthStore from './store/auth';
import {API_BY_PAGE_HOST} from './constants';
import type {Project} from './elements/ngm-dashboard';


export class ApiClient {
    token = Auth.getAccessToken();
    private apiUrl: string;

    constructor() {
      this.apiUrl = API_BY_PAGE_HOST[window.location.host];

      AuthStore.user.subscribe(() => {
        this.token = Auth.getAccessToken();
      });
    }

    updateProject(project: Project): Promise<Response> {
      const headers = {
        'Content-Type': 'application/json'
      };

      addAuthorization(headers, this.token);

      return fetch(`${this.apiUrl}/projects/${project.id}`, {
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

      return fetch(`${this.apiUrl}/projects/${id}`, {
        method: 'GET',
        headers: headers,
      });
    }


    getProjects(): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
      };

      addAuthorization(headers, this.token);

      return fetch(`${this.apiUrl}/projects`, {
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

      return fetch(`${this.apiUrl}/projects/duplicate`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(project),
      });
    }
  }


function addAuthorization(headers: any, token: string|null) {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}