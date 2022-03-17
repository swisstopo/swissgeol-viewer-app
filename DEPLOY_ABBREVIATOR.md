# Deploy of abbreviator

This is the URL shortener.

## Instances

- dev https://link.dev.swissgeol.ch/
- int https://link.int.swissgeol.ch/
- prod https://link.swissgeol.ch/

The data is stored in a sqlite db located in a shared NFS drive.


## Update & Deploy

1. Bump the version of the package in the `Cargo.toml` file of the `camptocamp/abbreviator` [github repository](https://github.com/camptocamp/abbreviator) and create a release.

2. Create a tag starting with `int` or `prod` to trigger the gihub action to build and push a docker image to `camptocamp/abbreviator` on [dockerhub](https://hub.docker.com/repository/docker/camptocamp/abbreviator).

3. Redeploy the instances on Fargate.

    The aws credetials are stored in the [ngm gopass password store](https://git.swisstopo.admin.ch/ngm/password-store-ngm).

    ```bash
    export AWS_REGION=eu-west-1
    export AWS_ACCESS_KEY_ID=$(gopass cat ngm/fargate/urlshortener/AWS_ACCESS_KEY_ID)
    export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/fargate/urlshortener/AWS_SECRET_ACCESS_KEY)
    ```

    ```bash
    # development
    aws ecs update-service --cluster urlshortener_dev --service urlshortener_dev --force-new-deployment
    watch --interval=5 curl -s https://link.dev.swissgeol.ch/health_check
    # integration
    aws ecs update-service --cluster urlshortener_int --service urlshortener_int --force-new-deployment
    watch --interval=5 curl -s https://link.int.swissgeol.ch/health_check
    # production
    aws ecs update-service --cluster urlshortener_prod --service urlshortener_prod --force-new-deployment
    watch --interval=5 curl -s https://link.swissgeol.ch/health_check
    ```
