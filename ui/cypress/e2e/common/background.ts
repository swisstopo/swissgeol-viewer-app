import { Given } from '@badeball/cypress-cucumber-preprocessor';

//@ts-ignore
import type { ClientConfig } from '../../../src/api/client-config';
import { getViewer } from './viewer';

let cachedConfig: ClientConfig | null = null;
const trackingConsent = encodeURIComponent(
  JSON.stringify({ v: 1, isAllowed: false }),
);

before(() => {
  cy.request('http://localhost:8000/api/client-config').then((res) => {
    cachedConfig = res.body;
  });
});

beforeEach(() => {
  cy.intercept('GET', 'http://localhost:8000/api/client-config', (req) => {
    req.reply(cachedConfig);
  });
});

Given(/^the viewer is fully loaded$/, () => {
  cy.visit('/?lang=en', {
    onBeforeLoad(win) {
      win.document.cookie = `swissgeol_consent=${trackingConsent}; Path=/; SameSite=Lax`;
    },
  });
  cy.get('.cesium-widget > canvas', { timeout: 10_000 }).should('be.visible');
  cy.get('ngm-layout-sidebar', { timeout: 60_000 }).should('be.visible');
});

Given(/^the data panel is open$/, () => {
  cy.get('ngm-layout-sidebar').should('exist');
  cy.get('ngm-layout-sidebar > ul:nth(0)').should('exist');
  cy.get('ngm-layout-sidebar > ul:nth(0) > li:first-child').should('exist');

  cy.get(
    'ngm-layout-sidebar > ul:nth(0) > li:first-child > ngm-layout-sidebar-item',
  )
    .shadow()
    .find('.box')
    .click();
  cy.get('ngm-catalog', { timeout: 10_000 }).should('be.visible');
});

Given(/^the map has been loaded in$/, () => {
  // Wait for the first tile load.
  // This can take quite some time, sadly.
  getViewer().then({ timeout: 60_000 }, (viewer) => {
    return new Cypress.Promise((resolve) => {
      const handle = (count: number) => {
        if (count === 0) {
          viewer.scene.globe.tileLoadProgressEvent.removeEventListener(handle);
          resolve();
        }
      };
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(handle);
    });
  });
});
