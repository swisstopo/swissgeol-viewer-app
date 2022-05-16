export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/swissgeol
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run: build_local_api ui/node_modules/.timestamp
	docker-compose up --remove-orphans --force-recreate --renew-anon-volumes

.PHONY: acceptance
acceptance: build_local_api ui/node_modules/.timestamp
	docker-compose -f docker-compose.yaml -f docker-compose-tests.yaml up --renew-anon-volumes --force-recreate --abort-on-container-exit --exit-code-from tests

.PHONY: build_local_api
build_local_api:
	docker build -f api/DockerfileDev -t $(DOCKER_BASE)_local_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api --pull

.PHONY: build_api
build_api:
	docker build --target builder -t $(DOCKER_BASE)_api_builder:latest --build-arg "GIT_HASH=$(GIT_HASH)" api --pull
	docker build -t $(DOCKER_BASE)_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api

ui/node_modules/.timestamp: ui/package-lock.json
	cd ui; npm ci --no-audit --ignore-scripts
	touch $@
