export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/swissgeol
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run: build_local_api
	docker-compose --env-file ./api/.env up

.PHONY: build_ui
build_ui:
	docker build -t $(DOCKER_BASE)_ui:latest --build-arg "GIT_HASH=$(GIT_HASH)" ui

.PHONY: build_local_api
build_local_api:
	docker build -f api/DockerfileDev -t $(DOCKER_BASE)_local_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api

.PHONY: build_api
build_api:
	docker build -t $(DOCKER_BASE)_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api
