const testGstOutput = () => {
  cy.intercept('https://viewer.geomol.ch/webgui/**', (req) => {
    req.reply(200, {imageUrl: `https://viewer.geomol.ch/webgui/tmp/test.${req.query.outputType}`});
  }).as('createSection');
  cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').should('not.have.class', 'disabled');
  cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').click();
  cy.get('ngm-gst-interaction').click(1, 1);
  cy.get('.ngm-gst-container .ngm-action-btn').click();
  cy.get('.ngm-gst-modal', {timeout: 15000}).should('be.visible');
  cy.get('ngm-gst-modal').then(el => {
    const url = (<any>el[0]).imageUrl;
    expect(url).to.match(/pdf/);
  });
  cy.get('.ngm-gst-modal .ngm-cancel-btn').click();
  // wait for rerender
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(1000);
  cy.get('.ngm-section-format').click();
  cy.get('.ngm-section-format .menu .item:nth-child(2)').click();
  cy.get('.ngm-section-format').trigger('change');
  cy.get('.ngm-gst-container .ngm-action-btn').click();
  cy.get('.ngm-gst-modal', {timeout: 15000}).should('be.visible');
  cy.get('ngm-gst-modal').then(el => {
    const url = (<any>el[0]).imageUrl;
    expect(url).to.match(/svg/);
  });
};

describe('Toolbox', () => {

  it('Slicing', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-slicing-icon').click();
    cy.get('.ngm-slice-types > div:nth-child(2) .ngm-draw-hint').should('be.visible');
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').click(450, 200);
    cy.get('.ngm-slice-types > div:nth-child(2) .ngm-slice-side > div:first-child').click();
    cy.get('.ngm-slice-types > div:nth-child(2) .ngm-slice-side > div:first-child').should('have.class', 'active');
    cy.get('.ngm-slice-types > div:nth-child(2) .ngm-slice-to-draw button').click();
    cy.get('ngm-slicer .ngm-geom-list .ngm-action-list-item:first-child').click();
    cy.get('ngm-slicer .ngm-geom-list .ngm-action-list-item:first-child > .ngm-action-list-item-header > div:first-child').should('have.class', 'active');
    cy.get('.ngm-slice-types > div:first-child').click();
    cy.get('.ngm-slice-types > div:first-child').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').click(450, 200);
    cy.get('.cesium-widget > canvas').click(650, 200);
    cy.get('.ngm-slice-types > div:first-child .ngm-slice-box-toggle').click();
    cy.get('.ngm-slice-types > div:first-child .ngm-slice-box-toggle').should('not.have.class', 'active');
    (<any>cy).loadPage(true, true);
    cy.get('.ngm-slice-types > div:first-child .ngm-slice-to-draw button').click();
  });

  it('GST point', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-draw-list-item:first-child').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').should('have.class', 'disabled');
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-vector-icon').click();
    cy.get('ngm-draw-tool div.ngm-action-list-item:not(.ngm-geom-filter) .ngm-action-menu-icon').click();
    cy.get('div.menu.transition.visible > div:nth-child(3)').click();
    cy.get('.ngm-coord-y-input').invoke('val', 46.956).trigger('change');
    cy.get('.ngm-geom-edit-actions > button:first-child').click();
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-geom-list .ngm-point-draw-icon').click();
    testGstOutput();
  });

  it('GST line', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-vector-icon').click();
    cy.get('ngm-draw-tool .ngm-draw-list-item:nth-child(3)').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').dblclick(450, 200);
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-geom-list .ngm-line-draw-icon').click();
    testGstOutput();
  });
});
