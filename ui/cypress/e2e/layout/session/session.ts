import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { Role } from '@swissgeol/ui-core';
import { filter, firstValueFrom } from 'rxjs';

const getSessionService = (): Cypress.Chainable<any> =>
  cy.get('ngm-session').then((sideBar$) => {
    const { sessionService } = sideBar$[0] as unknown as {
      sessionService: any;
    };
    return sessionService;
  });
const trackingConsent = encodeURIComponent(
  JSON.stringify({ v: 1, isAllowed: false }),
);

const expiresAtTimestamp = Date.now() / 1_000 + 3_600;
const user = {
  id: crypto.randomUUID(),
  email: 'petermaximilian.vonderweide@example.com',
  firstName: 'Peter Maximilian',
  lastName: 'von der Weide',
  groups: ['example', 'nothing'],
  expiresAt: new Date(expiresAtTimestamp * 1_000),
  role: Role.Reader,
};

const interceptSignInRequests = () => {
  cy.intercept(
    'POST',
    'https://cognito-identity.eu-west-1.amazonaws.com/',
    (req) => {
      switch (req.headers['x-amz-target']) {
        case 'AWSCognitoIdentityService.GetId':
          req.reply({
            IdentityId: 'eu-west-1:b58b4eb5-c9bc-ca5e-297d-f9b0f2eff4f4',
          });
          return;
        case 'AWSCognitoIdentityService.GetCredentialsForIdentity':
          req.reply({
            Credentials: {
              AccessKeyId: crypto.randomUUID(),
              Expiration: Date.now() / 1_000 + 3_600,
              SecretKey: crypto.randomUUID(),
              SessionToken: crypto.randomUUID(),
            },
            IdentityId: 'eu-west-1:b58b4eb5-c9bc-ca5e-297d-f9b0f2eff4f4',
          });
          return;
        default:
          req.reply(404);
      }
    },
  );

  cy.intercept('GET', '/api/projects', (req) => {
    req.reply([]);
  });
};

Given(/^that no user is signed in$/, () => {
  getSessionService().then((sessionService) => {
    expect(sessionService.user).to.be.null;
  });
});

When(/^the user clicks on the session button$/, () => {
  cy.get('ngm-session')
    .shadow()
    .find('sgc-session')
    .shadow()
    .find('sgc-button')
    .click();
});

Then(/^the user is redirected to the external eIAM login page$/, () => {
  cy.origin('https://feds-r.eiam.admin.ch', () => {
    // Click #continueButton if it exists.
    // That button can appear if a maintenance message is in place.
    // Note that we need to wait here for a short while so that the continue button has time to render.
    cy.wait(1_000);
    cy.get('body', { timeout: 10_000 })
      .then(($body) => {
        const $btn = $body.find('#continueButton');
        console.log($btn);
        if ($btn.length) {
          cy.wrap($btn).click();
        }
      })
      .then(() => {
        cy.location('pathname').should('match', new RegExp('^/app/home/.+'));
      });
  });
});

When(/^the page is accessed with eIAM response query parameters$/, () => {
  const accessToken =
    '.' +
    btoa(
      JSON.stringify({
        username: 'Peter Maximilian von der Weide',
        'cognito:groups': user.groups,
        auth_time: Date.now() / 1_000,
        client_id: 'Viewer',
        exp: expiresAtTimestamp,
        iat: Date.now() / 1_000,
        iss: 'https://some-external-service.example.com',
        jti: crypto.randomUUID(),
        scope: 'some scopes here',
        sub: user.id,
        token_use: 'access',
      }),
    );
  const idToken = crypto.randomUUID();
  const state = crypto.randomUUID();

  cy.window().then((window) => {
    window.localStorage.setItem('swissgeol-viewer/Session.state', state);
  });

  interceptSignInRequests();

  cy.intercept(
    'GET',
    'https://ngm-dev.auth.eu-west-1.amazoncognito.com/oauth2/userInfo',
    (req) => {
      expect(req.headers).to.have.property(
        'authorization',
        `Bearer ${accessToken}`,
      );
      req.reply({
        sub: user.id,
        email: user.email,
        given_name: user.firstName,
        family_name: user.lastName,
      });
    },
  );

  const params = new URLSearchParams({
    access_token: accessToken,
    id_token: idToken,
    state,
    token_type: 'Bearer',
  });
  cy.visit(`#${params}`, {
    onBeforeLoad(win) {
      win.document.cookie = `swissgeol_consent=${trackingConsent}; Path=/; SameSite=Lax`;
    },
  });
});

Then(/^signed in user's profile is loaded$/, () => {
  getSessionService().then((sessionService) => {
    cy.wrap(
      firstValueFrom(sessionService.token$.pipe(filter((it) => it != null))),
      {
        timeout: 60_000,
      },
    ).then((token) => {
      expect(token).to.exist;
    });
  });

  getSessionService().then((sessionService) => {
    expect(sessionService.user).to.deep.equal(user);
  });
});

Given(/^that a user is signed in$/, () => {
  getSessionService().then((sessionService) => {
    sessionService.setSession({
      token: crypto.randomUUID(),
      user,
      cognitoIdentityCredentials: {
        identityId: crypto.randomUUID(),
        accessKeyId: crypto.randomUUID(),
        secretAccessKey: crypto.randomUUID(),
        sessionToken: crypto.randomUUID(),
        credentialScope: 'some scope here',
        accountId: crypto.randomUUID(),
      },
    });
  });
});

When(/^the user clicks the sign out button$/, () => {
  cy.get('sgc-session-info')
    .as('sessionInfo')
    .shadow()
    .find('sgc-button')
    .click();
});

When(/^the page is reloaded$/, () => {
  interceptSignInRequests();
  cy.visit('/', {
    onBeforeLoad(win) {
      win.document.cookie = `swissgeol_consent=${trackingConsent}; Path=/; SameSite=Lax`;
    },
  });
});

When(/^the user's session expires$/, () => {
  getSessionService().then((sessionService) => {
    const { session } = sessionService;
    expect(session).to.not.be.null;

    sessionService.setSession({
      ...session,
      user: {
        ...session.user,
        expiresAt: new Date(Date.now() + 250),
      },
    });
  });
  cy.wait(500);
});

Then(/^the session dropdown opens$/, () => {
  cy.get('sgc-session-info').as('sessionInfo').should('be.visible');
});

Then(/^the user's name is shown in the session dropdown$/, () => {
  cy.get('@sessionInfo')
    .shadow()
    .find('.name')
    .should('have.text', `${user.firstName} ${user.lastName}`);
});

Then(/^the user is signed out$/, () => {
  getSessionService().then((sessionService) => {
    cy.wrap(
      firstValueFrom(sessionService.token$.pipe(filter((it) => it === null))),
      {
        timeout: 60_000,
      },
    ).then((token) => {
      expect(token).to.be.null;
    });
  });

  getSessionService().then((sessionService) => {
    expect(sessionService.user).to.be.null;
  });
});
