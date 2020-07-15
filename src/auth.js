
const cognitoState = 'cognito_state';
const cognitoAccessToken = 'cognito_access_token';
const cognitoIdToken = 'cognito_id_token';

// example: #access_token=header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature&token_type=Bearer&state=1234
const isResponse = /^#[\w]+=[\w.=-]+(&[\w]+=[\w.=-]+)*$/;

// example: header.eyJuYW1lIjoiSm9obiBEb2UifQ.signature
const isToken = /^[\w=-]+.[\w=-]+.[\w=-]+$/;

export default class Auth {

    static initialize() {
        // try parse and store the cognito response
        // and fail silently otherwise
        try {
            const response = this.parseResponse(window.location.hash);
            if (response.token_type === 'Bearer' && response.state === this.state()) {
                this.parseToken(response.access_token);
                this.parseToken(response.id_token)
                this.setAccessToken(response.access_token);
                this.setIdToken(response.id_token);
            }
        } catch (e) {
            // do nothing
        }
    }

    static parseResponse(response) {
        if (response === undefined || !isResponse.test(response)) {
            throw new Error('Malformed response');
        }
        const entries = response.substring(1).split('&')
            .filter(entry => entry !== '')
            .map(entry => entry.split('='));
        return Object.fromEntries(entries);
    }

    static parseToken(token) {
        if (token === undefined || !isToken.test(token)) {
            throw new Error('Malformed token');
        }
        try {
            const arr = token.split('.');
            const payload = atob(arr[1]);
            return JSON.parse(payload);
        } catch (e) {
            throw new Error('Malformed token');
        }
    }

    static state(state) {
        if (state !== undefined) {
            localStorage.setItem(cognitoState, state);
        }
        if (localStorage.getItem(cognitoState) === null) {
            localStorage.setItem(cognitoState, Math.random().toString(36).substring(2));
        }
        return localStorage.getItem(cognitoState);
    }

    static getAccessToken() {
        return localStorage.getItem(cognitoAccessToken);
    }

    static setAccessToken(token) {
        localStorage.setItem(cognitoAccessToken, token);
    }

    static getIdToken() {
        return localStorage.getItem(cognitoIdToken);
    }

    static setIdToken(token) {
        localStorage.setItem(cognitoIdToken, token);
    }

    static clear() {
        localStorage.removeItem(cognitoState);
        localStorage.removeItem(cognitoAccessToken);
        localStorage.removeItem(cognitoIdToken);
    }

    static getUser() {
        try {
            const token = this.getAccessToken();
            return this.parseToken(token);
        } catch (e) {
            return null;
        }
    }

    static async waitForAuthenticate() {
        while (this.getUser() === null) {
            await new Promise((resolve) => {
                setTimeout(() => resolve(), 100);
            });
        }
    }

}
