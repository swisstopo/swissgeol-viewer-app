import { ClientConfig } from './client-config';
import { API_BY_PAGE_HOST } from '../constants';

export class ConfigService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = API_BY_PAGE_HOST[window.location.host];
  }

  async getConfig(): Promise<ClientConfig | null> {
    try {
      const response = await fetch(`${this.apiUrl}/client-config`, {
        method: 'GET',
      });
      return (await response.json()) as ClientConfig;
    } catch (e) {
      console.error(`Failed to update project: ${e}`);
      return null;
    }
  }
}
