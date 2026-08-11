import { BaseService } from 'src/services/base.service';
import { clientConfigContext } from 'src/context';
import { ClientConfig } from 'src/api/client-config';
import { User } from 'src/features/session/user.model';
import { getCognitoVariables } from 'src/constants';
import { Role } from '@swissgeol/ui-core';
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  skip,
  take,
} from 'rxjs';
import {
  CognitoIdentityCredentials,
  fromCognitoIdentityPool,
} from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';

const STORAGE_STATE_KEY = 'swissgeol-viewer/Session.state';
const STORAGE_USER_KEY = 'swissgeol-viewer/Session.user';
const STORAGE_TOKEN_KEY = 'swissgeol-viewer/Session.accessToken';

export class SessionService extends BaseService {
  private cognitoVariables = getCognitoVariables(globalThis.location.host);
  private clientConfig!: ClientConfig;

  private readonly sessionSubject = new BehaviorSubject<Session | null>(null);

  private state = readOrMakeState();

  private sessionExpiryTimeout: number | null = null;

  private readonly subjectForIsInitialized = new BehaviorSubject<boolean>(
    false,
  );

  constructor() {
    super();

    BaseService.inject$(clientConfigContext).subscribe((clientConfig) => {
      this.clientConfig = clientConfig;
    });

    this.sessionSubject.pipe(skip(1)).subscribe((session) => {
      if (this.sessionExpiryTimeout !== null) {
        clearTimeout(this.sessionExpiryTimeout);
        this.sessionExpiryTimeout = null;
      }

      if (session === null) {
        localStorage.removeItem(STORAGE_STATE_KEY);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        this.state = readOrMakeState();
      } else {
        localStorage.setItem(STORAGE_STATE_KEY, this.state);
        localStorage.setItem(STORAGE_TOKEN_KEY, session.token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(session.user));

        this.sessionExpiryTimeout = setTimeout(() => {
          this.signOut();
        }, session.user.expiresAt.getTime() - Date.now()) as unknown as number;
      }
    });

    BaseService.onReady(() => this.initialize());
  }

  get session(): Session | null {
    return this.sessionSubject.value;
  }

  get token(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  get token$(): Observable<string | null> {
    return this.sessionSubject.pipe(
      map((session) => session?.token ?? null),
      distinctUntilChanged(),
    );
  }

  get user(): User | null {
    return this.sessionSubject.value?.user ?? null;
  }

  get user$(): Observable<User | null> {
    return this.sessionSubject.pipe(
      map((session) => session?.user ?? null),
      distinctUntilChanged(),
    );
  }

  get isInitialized$(): Observable<boolean> {
    return this.subjectForIsInitialized.asObservable();
  }

  get initialized$(): Observable<void> {
    return this.isInitialized$.pipe(
      filter((it) => it),
      map(() => {}),
      take(1),
    );
  }

  get cognitoIdentityCredentials(): CognitoIdentityCredentials | null {
    return this.sessionSubject.value?.cognitoIdentityCredentials ?? null;
  }

  get cognitoIdentityCredentials$(): Observable<CognitoIdentityCredentials | null> {
    return this.sessionSubject.pipe(
      map((it) => it?.cognitoIdentityCredentials ?? null),
    );
  }

  setSession(session: Session): void {
    this.sessionSubject.next(session);
  }

  signIn(): void {
    const url =
      `https://ngm-${this.cognitoVariables.env}.auth.eu-west-1.amazoncognito.com/oauth2/authorize?` +
      'response_type=token' +
      `&client_id=${this.cognitoVariables.clientId}` +
      `&redirect_uri=${location.origin}${location.pathname}` +
      '&scope=openid+profile' +
      `&state=${this.state}`;

    globalThis.location.assign(url);
  }

  signOut(): void {
    this.sessionSubject.next(null);
  }

  private async initialize(): Promise<void> {
    // First, check if the current request is a response from eIAM.
    await this.initializeFromUrl();

    // If we have not received a new session, we check if we have one stored.
    if (this.user === null) {
      await this.initializeFromStorage();
    }

    // If we have no user present anywhere, we clear our session cache.
    if (this.user === null) {
      this.signOut();
    }

    this.subjectForIsInitialized.next(true);
  }

  private async initializeFromUrl(): Promise<void> {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
    if (!globalThis.location.hash.startsWith('#')) {
      return;
    }

    const response = globalThis.location.hash.substring(1);
    const params = new URLSearchParams(response);

    if (params.has('error')) {
      throw new Error(`Auth error: ${params.get('error_description')}`);
    }

    if (
      !params.has('access_token') ||
      !params.has('id_token') ||
      params.get('token_type') !== 'Bearer' ||
      params.get('state') !== this.state
    ) {
      return;
    }

    const accessToken = params.get('access_token') ?? '';
    const payload = atob(accessToken.split('.')[1]);
    const claims: CognitoUser = JSON.parse(payload);
    const token = params.get('id_token') ?? '';

    // Remove tokens from the URL to avoid exposing them in the address bar and browser history.
    globalThis.history.replaceState(
      null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    );

    const [user, cognitoIdentityCredentials] = await Promise.all([
      this.fetchUser(claims, accessToken),
      this.fetchCognito(token),
    ]);
    this.sessionSubject.next({
      token,
      user,
      cognitoIdentityCredentials,
    });
  }

  private async initializeFromStorage(): Promise<void> {
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const storedUserString = localStorage.getItem(STORAGE_USER_KEY);
    if (storedToken === null || storedUserString === null) {
      return;
    }

    const storedUser: User = JSON.parse(storedUserString);
    storedUser.expiresAt = new Date(storedUser.expiresAt);
    if (storedUser.expiresAt.getTime() < Date.now()) {
      // The session has expired.
      return;
    }

    this.sessionSubject.next({
      token: storedToken,
      user: storedUser,
      cognitoIdentityCredentials: await this.fetchCognito(storedToken),
    });
  }

  private async fetchCognito(
    accessToken: string,
  ): Promise<CognitoIdentityCredentials> {
    const { cognito_pool_id, cognito_identity_pool_id, cognito_aws_region } =
      this.clientConfig.auth;
    return await fromCognitoIdentityPool({
      client: new CognitoIdentityClient({
        region: cognito_aws_region,
      }),
      identityPoolId: cognito_identity_pool_id,
      logins: {
        [`cognito-idp.${cognito_aws_region}.amazonaws.com/${cognito_pool_id}`]:
          accessToken,
      },
    })();
  }

  private async fetchUser(
    cognitoUser: CognitoUser,
    accessToken: string,
  ): Promise<User> {
    const res = await fetch(
      `https://ngm-${this.cognitoVariables.env}.auth.eu-west-1.amazoncognito.com/oauth2/userInfo`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      throw new Error(
        `Failed to read userInfo: [${res.status} ${res.statusText}] ${await res.text()}`,
      );
    }
    const body = await res.json();
    return {
      id: body.sub,
      email: body.email,
      firstName: body.given_name,
      lastName: body.family_name,
      groups: cognitoUser['cognito:groups'],
      expiresAt: new Date(cognitoUser.exp * 1000),

      // The Viewer doesn't have roles, so we just use the lowest ranking role.
      role: Role.Reader,
    };
  }
}

interface CognitoUser {
  username: string;
  'cognito:groups': string[];
  auth_time: number;
  client_id: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  scope: string;
  sub: string;
  token_use: string;
}

interface Session {
  token: string;
  user: User;
  cognitoIdentityCredentials: CognitoIdentityCredentials;
}

const readOrMakeState = (): string => {
  const storedState = localStorage.getItem(STORAGE_STATE_KEY);
  if (storedState !== null) {
    return storedState;
  }

  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const state = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  localStorage.setItem(STORAGE_STATE_KEY, state);
  return state;
};
