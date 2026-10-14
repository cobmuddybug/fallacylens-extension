FALLACYLENS_APP ?= ../fallacylens/fallacylens
CHROMIUM ?= chromium
VERSION := $(shell node -p "JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version")

.PHONY: test e2e live check-secrets zip fixtures icons

test:
	node --test 'test/unit/*.test.mjs'

e2e:
	CHROMIUM=$(CHROMIUM) node --test --test-concurrency=1 'test/e2e/*.test.mjs'

live:
	node tools/live.mjs

check-secrets:
	sh tools/check-secrets.sh

zip:
	rm -rf dist && mkdir -p dist
	zip -qr dist/fallacylens-extension-$(VERSION).zip manifest.json src icons -x 'icons/*.svg'
	unzip -l dist/fallacylens-extension-$(VERSION).zip

fixtures:
	python3 tools/make_fixtures.py $(FALLACYLENS_APP)

icons:
	for s in 16 32 48 128; do rsvg-convert -w $$s -h $$s icons/icon.svg -o icons/icon-$$s.png; done
