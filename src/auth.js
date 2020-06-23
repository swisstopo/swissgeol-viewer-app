
const cognitoState = 'cognito_state';
const cognitoUser = 'cognito_user';

const isResponse = /^#[\w]+=[\w.=-]+(&[\w]+=[\w.=-]+)*$/;
const isToken = /^[\w=-]+.[\w=-]+.[\w=-]+$/;

export default class Auth {

    static initialize() {
        // try parse and store the cognito response
        // and fail silently otherwise
        try {
            const response = this.parseResponse(window.location.hash);
            if (response.token_type === 'Bearer' && response.state === this.state()) {
                const user = this.parseToken(response.access_token);
                this.setUser(user);
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

    static getUser() {
        const value = localStorage.getItem(cognitoUser);
        return JSON.parse(value);
    }

    static setUser(user) {
        const value = JSON.stringify(user);
        localStorage.setItem(cognitoUser, value);
    }

    static removeUser() {
        localStorage.removeItem(cognitoUser);
    }

    static async authenticate() {
        while (localStorage.getItem(cognitoUser) === null) {
            await new Promise((resolve) => {
                setTimeout(() => resolve(), 100);
            });
        }
    }

}
