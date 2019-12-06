GPG_KEYS := 0875810F CF8E9976 3EA11D26

.PHONY: secrets.txt.gpg
secrets.txt.gpg:
	gpg --keyserver pgp.mit.edu --keyserver-options timeout=20 --recv-keys $(GPG_KEYS) || true
	rm -f $@
	gpg --output $@ --encrypt $(addprefix --recipient ,$(GPG_KEYS)) secrets.txt

.PHONY: secrets.txt
secrets.txt:
	rm -f $@
	gpg --output $@ --decrypt secrets.txt.gpg

.PHONY: dist
dist:
	npm ci
	npm run lint
	npm run build
