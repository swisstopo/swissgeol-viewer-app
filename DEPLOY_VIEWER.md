# Deploy of the viewer

## Instances

- dev https://dev.swissgeol.ch/
- int https://int.swissgeol.ch/
- prod https://viewer.swissgeol.ch/

## S3 buckets

### Sysadmin configurations

https://git.swisstopo.admin.ch/camptocamp/terraform-swisstopo-ngm

### Used buckets
export DEV_BUCKET="ngmpub-dev-bgdi-ch" # where the dev UI files are deployed
export INT_BUCKET="ngmpub-int-bgdi-ch" # where the int UI files are deployed
export REVIEW_BUCKET="ngmpub-review-bgdi-ch" # where the PRs UI files are deployed
export PROD_BUCKET="ngmpub-prod-viewer-bgdi-ch" # where the prod-viewr UI files are deployed
export PROTECTED_BUCKET="ngm-protected-prod" # for tilesets restricted by cognito
export DOWNLOAD_BUCKET="ngmpub-download-bgdi-ch" # for publishing dataset sources
export DATA_EXCHANGE="ngm-data-exchange" # internal, for exchanging data (not accessible)
export RELEASES_BUCKET="ngmpub-review-bgdi-ch" # FIXME: create a dedicated bucket

### Listing content of a bucket:
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=$(gopass show ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass show ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)
aws s3 ls s3://$INT_BUCKET

## Deployments

### Master (CI)

- the UI is built and copied to S3;
- the API is built, published to docker hub and deployed to the dev and reviews environments.

This is handled in .github/workflows/ci.yml

### Reviews (CI)

- the UI is build and copied to S3;
- the UI uses the existing "dev" api.

This is handled in .github/workflows/ci.yml

### Int (manual)

#### Creation of a new release

```bash
git checkout XXX # the commit you want to release
export VERSION="" # the version (like 2022.02.0)
git tag $VERSION -m $VERSION
cd ui; scripts/release_ui.sh; cd -
cd api; scripts/release_api.sh; cd -
```
```

#### Deployment of a new version

```bash
export VERSION="" # the version (like 2022.02.0)
git checkout $VERSION
scripts/deploy_viewer.sh int
```

### Prod-viewer (manual)

The version should have been created and tested on int first.

```bash
export VERSION="" # the version (like 2022.02.0)
git checkout $VERSION
scripts/deploy_viewer.sh prod
```

## Invalidating some paths from cloudfront

See https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html

```
aws cloudfront create-invalidation --distribution-id $THE_DISTRIB_ID --paths /somepath
```
