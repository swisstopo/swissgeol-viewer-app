# Deploy of abbreviator

This is the URL shortener.

## Instances

- dev https://link.dev-viewer.swissgeol.ch/
- int https://link.int-viewer.swissgeol.ch/
- prod https://link.swissgeol.ch/

The data is stored in a sqlite db located in a shared NFS drive.


## Update & Deploy

1. Bump the version of the package in the `Cargo.toml` file of the `camptocamp/abbreviator` [github repository](https://github.com/camptocamp/abbreviator) and create a release. <!-- todo update when moved -->

2. Create a tag starting with `int` or `prod` to trigger the GitHub action to build and push a docker image to `ghcr.io/swisstopo/swissgeol-viewer-app-abbreviator`.

3. Update version in argocd:
   1. Go to [argocd repo](https://git.swisstopo.admin.ch/ngm/argocd)
   2. Checkout branch according to environment (dev / int / prod)
   3. Update image version in apps/urlshortener/values.yaml
   4. Trigger sync in [argocd dashboard](https://dev-argocd.swissgeol.ch/applications)

       ```
