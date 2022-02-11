export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/ngm
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run: build_api
	docker-compose up

.PHONY: build_api
build_api:
	docker build -t $(DOCKER_BASE)_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api

.PHONY: build_ui
build_ui:
	docker build -t $(DOCKER_BASE)_ui:latest --build-arg "GIT_HASH=$(GIT_HASH)" ui
