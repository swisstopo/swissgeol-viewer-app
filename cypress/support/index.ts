Cypress.Commands.add('loadPage', () => {
  cy.visit('/');
  cy.get('.ngm-main-load-dimmer .ngm-determinate-loader > .loader', {timeout: 4000}).should('have.class', 'determinate');
  cy.get('.ngm-main-load-dimmer').not('.active', {timeout: 60000});
  cy.get('ngm-tracking-consent').contains(
    /Continue without data acquisition|Continuer sans acquisition de données/).click();
});
