export DOCKER_TAG ?= latest
export DOCKER_BASE = camptocamp/swissgeol
GIT_HASH := $(shell git rev-parse HEAD)

.PHONY: run
run: build_local_api
	docker-compose up

.PHONY: build_local_api
build_local_api:
	docker build -t $(DOCKER_BASE)_local_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" -f api/DockerfileDev api

.PHONY: build_api
build_api:
	docker build -t $(DOCKER_BASE)_api:latest --build-arg "GIT_HASH=$(GIT_HASH)" api

.PHONY: build_ui
build_ui:
	docker build -t $(DOCKER_BASE)_ui:latest --build-arg "GIT_HASH=$(GIT_HASH)" ui

push: build_api
	for image in api; do \
		[ $(DOCKER_TAG) != 'latest' ] && docker tag $(DOCKER_BASE)_$$image:latest $(DOCKER_BASE)_$$image:$(DOCKER_TAG); \
		docker push $(DOCKER_BASE)_$$image:$(DOCKER_TAG); \
	done;
