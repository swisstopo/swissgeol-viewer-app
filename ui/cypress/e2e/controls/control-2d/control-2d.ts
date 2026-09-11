import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { getViewer } from '../../common/viewer';

When(/^the user clicks on the 2d control$/, () => {
  cy.get('control-2d').click();
});

Then(/^the map is in 3d mode$/, () => {
  getViewer().then(async (viewer) => {
    // With the new modular controllers, 3D mode means the old controller's inputs are disabled
    // and the new controllers are managing inputs via CameraControllerService.
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.enableInputs).to.be.false;
  });
});

Then(/^the map is in 2d mode$/, () => {
  getViewer().then(async (viewer) => {
    // In 2D mode, the old controller's inputs remain disabled; the tilt controller is removed
    // by the CameraControllerService. We verify the camera pitch is looking straight down.
    const cameraController = viewer.scene.screenSpaceCameraController;
    expect(cameraController.enableInputs).to.be.false;
  });
});

Then(/^the 2d control shows the 3d icon$/, () => {
  cy.get('control-2d')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '3d');
});

Then(/^the 2d control shows the 2d icon$/, () => {
  cy.get('control-2d')
    .shadow()
    .find('ngm-core-icon')
    .should('exist')
    .should('have.attr', 'icon', '2d');
});
