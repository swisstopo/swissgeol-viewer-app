import Auth from './auth';
import AuthStore from './store/auth';
import {API_BY_PAGE_HOST} from './constants';
import type {CreateProject, Project} from './elements/ngm-dashboard';
import {Subject} from 'rxjs';


class ApiClient {
    projectsChange = new Subject<void>();
    token = Auth.getAccessToken();
    private apiUrl: string;

    constructor() {
      this.apiUrl = API_BY_PAGE_HOST[window.location.host];

      AuthStore.user.subscribe(() => {
        this.token = Auth.getAccessToken();
        this.projectsChange.next();
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
      })
      .then(response => {
        this.projectsChange.next();
        return response;
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

    duplicateProject(project: CreateProject): Promise<Response> {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      addAuthorization(headers, this.token);

      return fetch(`${this.apiUrl}/projects/duplicate`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(project),
      })
      .then(response => {
        this.projectsChange.next();
        return response;
      });
    }
  }


function addAuthorization(headers: any, token: string|null) {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}

export const apiClient = new ApiClient();
