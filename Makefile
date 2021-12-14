.PHONY: start
start:
	npm start

.PHONY: dist
dist:
	npm ci
	npm run lint
	npm run build
	npm run build-storybook
