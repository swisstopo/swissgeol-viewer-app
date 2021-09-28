describe('The Home Page', () => {
  it('sucessfully loads', () => {
    cy.visit('/');
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(15000);
    cy.get('ngm-tracking-consent').contains('Continue without data acquisition').click();
  });
});
