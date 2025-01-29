import AuthService from '../authService';
import AuthStore from '../store/auth';
import { API_BY_PAGE_HOST } from '../constants';
import type {
  CreateProject,
  Project,
} from '../elements/dashboard/ngm-dashboard';
import { Subject } from 'rxjs';
import { NgmGeometry } from '../toolbox/interfaces';

export class ApiClient {
  projectsChange = new Subject<Project[]>();
  token: string | null = null;
  private readonly apiUrl: string;

  constructor(private readonly authService: AuthService) {
    this.apiUrl = API_BY_PAGE_HOST[window.location.host];
    this.token = this.authService.getAccessToken();

    AuthStore.user.subscribe(() => {
      this.token = this.authService.getAccessToken();
      this.refreshProjects();
    });
  }

  async refreshProjects() {
    const projects = await this.getProjects();
    this.projectsChange.next(projects);
  }

  async updateProject(project: Project): Promise<boolean> {
    const headers = {
      'Content-Type': 'application/json',
    };

    addAuthorization(headers, this.token);
    try {
      await fetch(`${this.apiUrl}/projects/${project.id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(project),
      });
      await this.refreshProjects();
      return true;
    } catch (e) {
      console.error(`Failed to update project: ${e}`);
      return false;
    }
  }

  deleteProject(id: string): Promise<Response> {
    const headers = {};
    addAuthorization(headers, this.token);

    return fetch(`${this.apiUrl}/projects/${id}`, {
      method: 'DELETE',
      headers: headers,
    }).then((response) => {
      this.refreshProjects();
      return response;
    });
  }

  updateProjectGeometries(
    id: string,
    geometries: NgmGeometry[],
  ): Promise<Response> {
    const headers = {
      'Content-Type': 'application/json',
    };

    addAuthorization(headers, this.token);

    return fetch(`${this.apiUrl}/projects/${id}/geometries`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(geometries),
    });
  }

  async getProject(id: string): Promise<Project> {
    const headers = {
      Accept: 'application/json',
    };

    addAuthorization(headers, this.token);
    const response = await fetch(`${this.apiUrl}/projects/${id}`, {
      method: 'GET',
      headers: headers,
    });

    return await response.json();
  }

  async getProjects(): Promise<Project[]> {
    let projects: Project[] = [];
    if (!this.token) {
      return projects;
    }
    const headers = {
      Accept: 'application/json',
    };

    addAuthorization(headers, this.token);
    const response = await fetch(`${this.apiUrl}/projects`, {
      method: 'GET',
      headers: headers,
    });
    if (!response.ok) {
      return projects;
    }
    projects = await response.json();
    return projects;
  }

  duplicateProject(project: CreateProject): Promise<Response> {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    addAuthorization(headers, this.token);

    return fetch(`${this.apiUrl}/projects/duplicate`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(project),
    }).then((response) => {
      this.refreshProjects();
      return response;
    });
  }

  async createProject(project: CreateProject): Promise<Response> {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
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

  async uploadProjectAsset(file: File | Blob) {
    const headers = {};
    const formData = new FormData();
    formData.append('file', file);

    addAuthorization(headers, this.token);

    return fetch(`${this.apiUrl}/projects/upload_asset`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
  }
}

function addAuthorization(headers: any, token: string | null) {
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}
