# Deploy of the viewer

## Instances

- dev https://dev-viewer.swissgeol.ch/
- int https://int-viewer.swissgeol.ch/
- prod https://viewer.swissgeol.ch/

## S3 buckets

### Sysadmin configurations

https://git.swisstopo.admin.ch/camptocamp/terraform-swisstopo-ngm

### Used buckets
```bash
export DEV_BUCKET="ngmpub-dev-bgdi-ch" # where the dev UI files are deployed
export INT_BUCKET="ngmpub-int-bgdi-ch" # where the int UI files are deployed
export REVIEW_BUCKET="ngmpub-review-bgdi-ch" # where the PRs UI files are deployed
export PROD_BUCKET="ngmpub-prod-viewer-bgdi-ch" # where the prod-viewer UI files are deployed
export PROTECTED_BUCKET="ngm-protected-prod" # for tilesets restricted by cognito
export DOWNLOAD_BUCKET="ngmpub-download-bgdi-ch" # for publishing dataset sources
export DATA_EXCHANGE="ngm-data-exchange" # internal, for exchanging data (not accessible)
export RELEASES_BUCKET="ngmpub-releases-bgdi-ch" # where the UI releases are published
export PROD_PROJECT_FILES_BUCKET="ngmpub-prod-project-files-bgdi-ch" # prod bucket where the project files saved
export INT_PROJECT_FILES_BUCKET="ngmpub-int-project-files-bgdi-ch" # int bucket where the project files saved
export DEV_PROJECT_FILES_BUCKET="ngmpub-dev-project-files-bgdi-ch" # dev bucket where the project files saved
```

### Listing content of a bucket:
```bash
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=$(gopass show ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass show ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)
aws s3 ls s3://$INT_BUCKET
```


## RDS instances

### Dev/int

see gopass

### Prod

see gopass


## Deployments

### Master (CI)

- the UI is built and copied to S3;
- the API is built, published to github packages and deployed to the dev and reviews environments.

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
git push origin $VERSION
scripts/release_ui.sh
export CR_PAT=<your personal github access token (classic)>
echo $CR_PAT | docker login ghcr.io -u <github login> --password-stdin
scripts/release_api.sh # (on macos: scripts/release_api.sh mac
```

For parallel ui and api releases:

```bash
tmux new-session 'scripts/release_ui.sh; bash' \; split-window -h 'scripts/release_api.sh; bash'
```

#### Deployment of a new version

```bash
export VERSION="" # the version (like 2022.02.0)
git checkout $VERSION
export CR_PAT=<your personal github access token (classic)>
echo $CR_PAT | docker login ghcr.io -u <github login> --password-stdin
scripts/deploy_viewer.sh int
```

Go to the [ArgoCD dashboard](#argocd) to check if everything went well.

### Prod-viewer (manual)

The version should have been created and tested on int first.

```bash
export VERSION="" # the version (like 2022.02.0)
git checkout $VERSION
export CR_PAT=<your personal github access token (classic)>
echo $CR_PAT | docker login ghcr.io -u <github login> --password-stdin
scripts/deploy_viewer.sh prod
```
Go to the [ArgoCD dashboard](#argocd) to check if everything went well.

## Argo CD <a name="argocd"></a>

* Argo CD dashboard: https://dev-argocd.swissgeol.ch/applications
* Argo CD repository: https://git.swisstopo.admin.ch/ngm/argocd/

## Invalidating some paths from cloudfront

See https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html

```
aws cloudfront create-invalidation --distribution-id $THE_DISTRIB_ID --paths /somepath
```

## Display last deployed logs

```bash
./scripts/get_api_logs.sh dev
./scripts/get_api_logs.sh int
./scripts/get_api_logs.sh prod
```
