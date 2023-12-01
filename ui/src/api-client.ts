import Auth from './auth';
import AuthStore from './store/auth';
import {API_BY_PAGE_HOST} from './constants';
import type {CreateProject, Project} from './elements/dashboard/ngm-dashboard';
import {Subject} from 'rxjs';
import {NgmGeometry} from './toolbox/interfaces';


class ApiClient {
    projectsChange = new Subject<Project[]>();
    token = Auth.getAccessToken();
    private apiUrl: string;

    constructor() {
      this.apiUrl = API_BY_PAGE_HOST[window.location.host];

      AuthStore.user.subscribe(() => {
        this.token = Auth.getAccessToken();
        this.refreshProjects();
      });
    }

    async refreshProjects() {
        const response = await this.getProjects();
        const projects = await response.json();
        this.projectsChange.next(projects);
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
        this.refreshProjects();
        return response;
      });
    }

    updateProjectGeometries(id: string, geometries: NgmGeometry[]): Promise<Response> {
        const headers = {
            'Content-Type': 'application/json'
        };

        addAuthorization(headers, this.token);

        return fetch(`${this.apiUrl}/projects/${id}/geometries`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(geometries),
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
        this.refreshProjects();
        return response;
      });
    }

    async createProject(project: CreateProject): Promise<Response> {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        addAuthorization(headers, this.token);

        const response = await fetch(`${this.apiUrl}/projects`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(project),
        });
        this.refreshProjects();
        return response;
    }

    async uploadProjectAsset(file: File) {
        const headers = {};
        const formData = new FormData();
        formData.append('file', file);

        addAuthorization(headers, this.token);

        return fetch(`${this.apiUrl}/projects/upload_asset`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
    }
}


function addAuthorization(headers: any, token: string|null) {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}

export const apiClient = new ApiClient();
