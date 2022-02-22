export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/swissgeol
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run: build_local_api
	docker-compose up --remove-orphans --force-recreate

.PHONY: acceptance
acceptance: build_local_api
	docker-compose -f docker-compose.yaml -f docker-compose-tests.yaml up --force-recreate --abort-on-container-exit --exit-code-from tests

.PHONY: build_local_api
build_local_api:
	docker build -f api/DockerfileDev -t $(DOCKER_BASE)_local_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api

.PHONY: build_api
build_api:
	docker build --target builder -t $(DOCKER_BASE)_api_builder:latest --build-arg "GIT_HASH=$(GIT_HASH)" api
	docker build -t $(DOCKER_BASE)_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api
