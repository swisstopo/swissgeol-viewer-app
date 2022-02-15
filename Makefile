export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/swissgeol
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run:
	docker-compose --env-file ./api/.env up

.PHONY: build_ui
build_ui:
	docker build -t $(DOCKER_BASE)_ui:latest --build-arg "GIT_HASH=$(GIT_HASH)" ui
