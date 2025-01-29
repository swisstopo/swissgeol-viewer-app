Cypress.Commands.add('loadPage', (doNotHideCookie = false, reload = false) => {
  reload ? cy.reload() : cy.visit('/');
  cy.get('.ngm-main-load-dimmer .ngm-determinate-loader > .loader', {
    timeout: 7000,
  }).should('have.class', 'determinate');
  cy.get('.ngm-main-load-dimmer').not('.active', { timeout: 60000 });
  if (!doNotHideCookie) cy.get('[data-cy="tracking-agree-btn"]').click();
});
