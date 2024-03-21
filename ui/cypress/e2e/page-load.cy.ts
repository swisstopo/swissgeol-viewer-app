describe('Page load', () => {
  it('Navigation hint', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-nav-hint').should('be.visible');
    cy.get('.ngm-nav-hint', {timeout: 30000}).should('not.exist');

    (<any>cy).loadPage(true);
    cy.get('.ngm-nav-hint').should('be.visible');
    cy.get('.ngm-nav-hint').click();
    cy.get('.ngm-nav-hint').should('not.exist');

    (<any>cy).loadPage(true);
    cy.get('.ngm-nav-hint').should('be.visible');
    cy.get('body').trigger('keydown', {ctrlKey: true, keycode: 17, key: 'Control'});
    cy.get('.ngm-nav-hint').should('not.exist');
  });
});
