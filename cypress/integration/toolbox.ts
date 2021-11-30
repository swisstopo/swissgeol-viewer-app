describe('Toolbox', () => {
  const testGstOutput = () => {
    cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').should('not.have.class', 'disabled');
    cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').click();
    cy.get('.ngm-gst-container .ngm-action-btn').click();
    cy.get('.ngm-gst-modal', {timeout: 120000}).should('be.visible');
    cy.get('ngm-gst-modal').then(el => {
      // @ts-ignore
      const url = el[0].imageUrl;
      expect(url).to.match(/pdf/);
    });
    cy.get('.ngm-gst-modal .ngm-cancel-btn').click();
    cy.get('.ngm-section-format').click();
    cy.get('.ngm-section-format .menu .item:nth-child(2)').click();
    cy.get('.ngm-section-format').trigger('change');
    cy.get('.ngm-gst-container .ngm-action-btn').click();
    cy.get('.ngm-gst-modal', {timeout: 120000}).should('be.visible');
    cy.get('ngm-gst-modal').then(el => {
      // @ts-ignore
      const url = el[0].imageUrl;
      expect(url).to.match(/svg/);
    });
  };
  it('GST point', () => {
    cy.visit('/');
    cy.get('.ngm-tools', {timeout: 120000}).click();
    // todo remove when loading test merged
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);
    cy.get('.ngm-vector-icon').click();
    cy.get('.ngm-draw-list-item:first-child').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').should('have.class', 'disabled');
    cy.get('.cesium-widget > canvas').click(450, 275);
    cy.get('.ngm-edit-icon').click();
    cy.get('.ngm-coord-y-input').invoke('val', 46.956).trigger('change');
    cy.get('.ngm-geom-edit-actions > button:first-child').click();
    cy.get('ngm-gst-interaction .ngm-point-draw-icon').click();
    testGstOutput();
  });

  it('GST line', () => {
    cy.visit('/');
    cy.get('.ngm-tools', {timeout: 120000}).click();
    // todo remove when loading test merged
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000);
    cy.get('.ngm-vector-icon').click();
    cy.get('.ngm-draw-list-item:nth-child(3)').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').dblclick(450, 200);
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    testGstOutput();
  });
});
