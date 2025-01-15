const testGstOutput = () => {
  cy.intercept('https://gst-viewer.swissgeol.ch/webgui/**', (req) => {
    req.reply(200, {imageUrl: `https://gst-viewer.swissgeol.ch/webgui/tmp/test.${req.query.outputType}`});
  }).as('createSection');
  cy.get('ngm-gst-interaction .ngm-action-list-item.ngm-geom-item').should('not.have.class', 'disabled');
  cy.get('ngm-gst-interaction .ngm-action-list-item.ngm-geom-item').click();
  cy.get('ngm-gst-interaction .ngm-geom-item .ngm-action-list-item-header > div:first-child').click(5, 5);
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

  it.only('Slicing', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-slicing-icon').click();
    cy.get('.ngm-slice-types > div:nth-child(2) .ngm-hint').should('be.visible');
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').click(450, 200);
    cy.get('.ngm-geom-list > div:nth-child(1) .ngm-slice-side > div:first-child').click();
    cy.get('.ngm-geom-list > div:nth-child(1) .ngm-slice-side > div:first-child').should('have.class', 'active');
    cy.get('ngm-slicer .ngm-geom-filter').click();
    cy.get('ngm-slicer .ngm-geom-filter > .ngm-action-list-item-header > div:first-child').should('have.class', 'active');
    cy.get('.ngm-slice-types > div:first-child').click();
    cy.get('.ngm-slice-types > div:first-child').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').click(450, 200);
    cy.get('.cesium-widget > canvas').click(650, 200);
    cy.get('.ngm-geom-list > div:nth-child(2) .ngm-slice-box-toggle').click();
    cy.get('.ngm-geom-list > div:nth-child(2) .ngm-slice-box-toggle').should('not.have.class', 'active');
  });

  it('GST point', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-action-list-item:first-child').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('ngm-gst-interaction .ngm-action-list-item:not(.ngm-geom-filter)').should('have.class', 'disabled');
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-vector-icon').click();
    cy.get('ngm-draw-tool div.ngm-action-list-item:not(.ngm-geom-filter) .ngm-action-menu-icon').click();
    cy.get('div.menu.transition.visible > div:nth-child(3)').click();
    cy.get('.ngm-coord-y-input').invoke('val', 1234316).trigger('change');
    cy.get('.ngm-geom-edit-actions > button:first-child').click();
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-geom-filter .ngm-point-draw-icon').click();
    testGstOutput();
  });

  it('GST line', () => {
    (<any>cy).loadPage();
    cy.get('.ngm-tools').click();
    cy.get('.ngm-vector-icon').click();
    cy.get('ngm-draw-tool .ngm-action-list-item:nth-child(2)').click();
    cy.get('.cesium-widget > canvas').click(450, 280);
    cy.get('.cesium-widget > canvas').dblclick(450, 200);
    cy.get('.ngm-back-icon').click();
    cy.get('.ngm-gst-icon').click();
    cy.get('ngm-gst-interaction .ngm-geom-filter .ngm-line-draw-icon').click();
    testGstOutput();
  });
});
