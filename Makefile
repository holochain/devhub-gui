.PHONY:			FORCE
SHELL			= bash
PROJECT_NAME		= devhub
SETUP_DEPS		= node_modules build download-assets-v0.13.0

#
# Runtime Setup
#
run-holochain:		node_modules
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -v
reset-holochain:
	rm -rf holochain/databases holochain/config.yaml tests/*_HASH
reset-lair:
	rm -rf holochain/lair tests/AGENT*
reset-all:		reset-holochain reset-lair
setup:			$(SETUP_DEPS)
	node tests/setup.js
setup-%:		$(SETUP_DEPS)
	node tests/setup.js $*
setup-demo:		setup
	node tests/add_devhub_to_devhub.js
	make build-watch

copy-dnas-from-local:
	cp ../devhub-dnas/bundled/*.dna		./tests/assets/
copy-zomes-from-local:
	cp ../devhub-dnas/zomes/*.wasm		./tests/assets/

download-assets-v0.13.0:
download-assets-v%:				FORCE download-happs-v% download-dnas-v% download-zomes-v%
	@echo -e "\x1b[0;37mDownloaded assets for version v$*\x1b[0m"
download-happs-v%:				FORCE
	VERSION=$* make -C tests/assets	\
		devhub.happ
download-dnas-v%:				FORCE
	VERSION=$* make -C tests/assets	\
		dnarepo.dna		\
		happs.dna		\
		web_assets.dna
download-zomes-v%:				FORCE
	VERSION=$* make -C tests/assets	\
		dnarepo_core.wasm	\
		dna_library.wasm	\
		happs_core.wasm		\
		happ_library.wasm	\
		reviews.wasm		\
		web_assets_core.wasm	\
		web_assets.wasm		\
		mere_memory.wasm	\
		mere_memory_api.wasm

build:			static-links
	WEBPACK_MODE=development npx webpack
static-links:		node_modules\
	static/dependencies\
	static/dependencies/holochain-client/holochain-client.js\
	static/dependencies/crux-payload-parser.js\
	static/dependencies/crux-payload-parser.js.map\
	static/dependencies/holo-hash.js\
	static/dependencies/holo-hash.js.map\
	static/dependencies/sha256.js\
	static/dependencies/mere-memory-sdk.js\
	static/dependencies/gzip.js\
	static/dependencies/msgpack.js\
	static/dependencies/showdown.js\
	static/dependencies/vue.js\
	static/dependencies/vuex.js\
	static/dependencies/vue-router.js
static/dependencies:
	mkdir -p $@
static/dependencies/holochain-client/holochain-client.js:	node_modules/@whi/holochain-client/dist/holochain-client.js Makefile
	ln -fs ../../node_modules/@whi/holochain-client/dist/ static/dependencies/holochain-client

static/dependencies/crux-payload-parser.js:		node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js Makefile
	cp $< $@
static/dependencies/crux-payload-parser.js.map:		node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js.map Makefile
	cp $< $@

static/dependencies/holo-hash.js:			node_modules/@whi/holo-hash/dist/holo-hash.js Makefile
	cp $< $@
static/dependencies/holo-hash.js.map:			node_modules/@whi/holo-hash/dist/holo-hash.js.map Makefile
	cp $< $@

static/dependencies/sha256.js:				node_modules/js-sha256/src/sha256.js Makefile
	cp $< $@

static/dependencies/mere-memory-sdk.js:			node_modules/@spartan-hc/mere-memory-sdk/dist/mere-memory-sdk.js Makefile
	cp $< $@
static/dependencies/gzip.js:				node_modules/pako/dist/pako.esm.mjs Makefile
	cp $< $@

static/dependencies/msgpack.js:				node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/showdown.js:			node_modules/showdown/dist/showdown.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/vue.js:				node_modules/vue/dist/vue.global.js Makefile
	cp $< $@

static/dependencies/vuex.js:				node_modules/vuex/dist/vuex.global.js Makefile
	cp $< $@

static/dependencies/vue-router.js:			node_modules/vue-router/dist/vue-router.global.js Makefile
	cp $< $@


#
# Testing
#
build-watch:		static-links
	WEBPACK_MODE=development npx webpack --watch
test-unit:			node_modules
	npx mocha --recursive ./tests/unit
test-unit-debug:		node_modules
	LOG_LEVEL=silly npx mocha --recursive ./tests/unit

test-build-components:		node_modules
	cd tests/components; npx webpack
test-build-components-watch:	node_modules
	cd tests/components; npx webpack --watch
test-components-server:
	python3 -m http.server 8765

tests/DevHub-urls.happ:
	hc app pack -o $@ ./tests/happ-with-urls/

#
# HTTP Server
#
run-simple-http-server:
	cd dist; python3 -m http.server 8765;
/etc/nginx/sites-available/$(PROJECT_NAME):	tests/nginx/$(PROJECT_NAME)
	sed -e "s|PWD|$(shell pwd)|g" \
	    < $< | sudo tee $@;
	echo " ... Wrote new $@ (from $<)";
	sudo ln -fs ../sites-available/$(PROJECT_NAME) /etc/nginx/sites-enabled/
	sudo systemctl reload nginx.service
	systemctl status nginx


#
# Project
#
use-local-crux:		node_modules
	npm uninstall @whi/crux-payload-parser
	npm install ../js-crux-payload-parser
use-npm-crux:		node_modules
	npm uninstall @whi/crux-payload-parser
	npm install @whi/crux-payload-parser
use-local-backdrop:	node_modules
	npm uninstall @whi/holochain-backdrop
	npm install --save-dev ../node-holochain-backdrop
use-npm-backdrop:	node_modules
	npm uninstall @whi/holochain-backdrop
	npm install --save-dev @whi/holochain-backdrop
use-local-client:	node_modules
	npm uninstall @whi/holochain-client
	npm install --save ../js-holochain-client/whi-holochain-client-0.78.0.tgz
use-npm-client:		node_modules
	npm uninstall @whi/holochain-client
	npm install --save @whi/holochain-client
use-local-hcc:		node_modules
	npm uninstall @whi/holochain-conductor-cli
	npm install --save-dev ../node-hc-conductor-cli/whi-holochain-conductor-cli-0.1.1.tgz
use-npm-hcc:		node_modules
	npm uninstall @whi/holochain-conductor-cli
	npm install --save-dev @whi/holochain-conductor-cli

use-local:		use-local-client use-local-backdrop
use-npm:		  use-npm-client   use-npm-backdrop

tests/assets/devhub.happ:	../devhub-dnas/devhub.happ
	cp $< $@
devhub.webhapp:			web_assets.zip tests/assets/devhub.happ
	hc web pack -o $@ ./bundled
	cp $@ ~/
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
dist:				static-links static/dist/webpacked.app.js
static/dist/webpacked.app.js:	node_modules webpack.config.js Makefile
	npm run build
	touch $@


#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx
web_assets.zip:		Makefile static/* static/*/*
	npm run build
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.prod.js	static/dependencies/crux-payload-parser.js
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.prod.js.map	static/dependencies/crux-payload-parser.js.map
	cp node_modules/@whi/holo-hash/dist/holo-hash.prod.js				static/dependencies/holo-hash.js
	cp node_modules/@whi/holo-hash/dist/holo-hash.prod.js.map			static/dependencies/holo-hash.js.map
	cp node_modules/js-sha256/build/sha256.min.js					static/dependencies/sha256.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.min.js			static/dependencies/msgpack.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.min.js.map		static/dependencies/msgpack.js.map
	cp node_modules/showdown/dist/showdown.min.js					static/dependencies/showdown.js
	cp node_modules/showdown/dist/showdown.min.js.map				static/dependencies/showdown.js.map
	cp node_modules/vue/dist/vue.global.prod.js					static/dependencies/vue.js
	cp node_modules/vuex/dist/vuex.global.prod.js					static/dependencies/vuex.js
	cp node_modules/vue-router/dist/vue-router.global.prod.js			static/dependencies/vue-router.js
	cd static; zip -r ../web_assets.zip ./*
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js		static/dependencies/crux-payload-parser.js
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js.map	static/dependencies/crux-payload-parser.js.map
	cp node_modules/@whi/holo-hash/dist/holo-hash.js				static/dependencies/holo-hash.js
	cp node_modules/@whi/holo-hash/dist/holo-hash.js.map				static/dependencies/holo-hash.js.map
	cp node_modules/js-sha256/src/sha256.js						static/dependencies/sha256.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js			static/dependencies/msgpack.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js.map			static/dependencies/msgpack.js.map
	cp node_modules/showdown/dist/showdown.js					static/dependencies/showdown.js
	cp node_modules/showdown/dist/showdown.js.map					static/dependencies/showdown.js.map
	cp node_modules/vue/dist/vue.global.js						static/dependencies/vue.js
	cp node_modules/vuex/dist/vuex.global.js					static/dependencies/vuex.js
	cp node_modules/vue-router/dist/vue-router.global.js				static/dependencies/vue-router.js

BEFORE_STRING	= modwc
AFTER_STRING	= openstate
GG_REPLACE_LOCATIONS = ':(exclude)*.lock' src/

update-string:
	git grep -l $(BEFORE_STRING) -- $(GG_REPLACE_LOCATIONS) | xargs sed -i 's/$(BEFORE_STRING)/$(AFTER_STRING)/g'
