
SHELL		= bash
PROJECT_NAME	= devhub

#
# Runtime Setup
#
run-holochain:
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -v
reset-holochain:
	rm -rf holochain/databases holochain/config.yaml tests/*_HASH
reset-lair:
	rm -rf holochain/lair tests/AGENT*
reset-all:		reset-holochain reset-lair
dna_packages:		dnas/dnarepo.dna dnas/happs.dna dnas/webassets.dna
setup:			dna_packages
	node tests/setup.js
setup-%:		dna_packages
	node tests/setup.js $*
setup-demo:		setup
	node tests/add_devhub_to_devhub.js
	npm run webpack

dnas:
	mkdir $@
zome_wasm:
	mkdir $@
dnas/%.dna:		dnas
	$(error Download missing DNA ($*.dna) into location ./$@)

copy-dnas-from-local:	dnas
	cp ../devhub-dnas/bundled/dnarepo.dna		dnas/dnarepo.dna
	cp ../devhub-dnas/bundled/happs.dna		dnas/happs.dna
	cp ../devhub-dnas/bundled/web_assets.dna	dnas/webassets.dna
copy-zomes-from-local:	zome_wasm
	cp ../devhub-dnas/zomes/*.wasm			./zome_wasm/

build:			static-links
static-links:\
	static/dependencies\
	static/dependencies/holochain-client.js\
	static/dependencies/holochain-client.js.map\
	static/dependencies/crux-payload-parser.js\
	static/dependencies/crux-payload-parser.js.map\
	static/dependencies/holo-hash.js\
	static/dependencies/holo-hash.js.map\
	static/dependencies/sha256.js\
	static/dependencies/gzip.js\
	static/dependencies/msgpack.js\
	static/dependencies/showdown.js\
	static/dependencies/vue.js\
	static/dependencies/vuex.js\
	static/dependencies/vue-router.js
static/dependencies:
	mkdir -p $@
static/dependencies/holochain-client.js:		node_modules/@whi/holochain-client/dist/holochain-client.js Makefile
	cp $< $@
static/dependencies/holochain-client.js.map:		node_modules/@whi/holochain-client/dist/holochain-client.js.map Makefile
	cp $< $@

static/dependencies/crux-payload-parser.js:		node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js Makefile
	cp $< $@
static/dependencies/crux-payload-parser.js.map:		node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js.map Makefile
	cp $< $@

static/dependencies/holo-hash.js:			node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.js Makefile
	cp $< $@
static/dependencies/holo-hash.js.map:			node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.js.map Makefile
	cp $< $@

static/dependencies/sha256.js:				node_modules/js-sha256/src/sha256.js Makefile
	cp $< $@

static/dependencies/gzip.js:				node_modules/gzip-js/lib/gzip.js Makefile
	cd src/gzip; FILENAME=../../$@ npx webpack
	touch $@

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
test-unit:
	npx mocha --recursive ./tests/unit
test-unit-debug:
	LOG_LEVEL=silly npx mocha --recursive ./tests/unit

test-build-components:
	cd tests/components; npx webpack
test-build-components-watch:
	cd tests/components; npx webpack --watch
test-components-server:
	python3 -m http.server 8765


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
use-local-crux:
	npm uninstall @whi/crux-payload-parser
	npm install ../devhub-dnas/js-crux-payload-parser
use-npm-crux:
	npm uninstall @whi/crux-payload-parser
	npm install @whi/crux-payload-parser
use-local-client:
	npm uninstall @whi/holochain-client
	npm install ../devhub-dnas/js-holochain-client
use-npm-client:
	npm uninstall @whi/holochain-client
	npm install @whi/holochain-client
use-local-hcc:
	npm uninstall @whi/holochain-conductor-cli
	npm install --save-dev ../node-hc-conductor-cli/whi-holochain-conductor-cli-0.1.1.tgz
use-npm-hcc:
	npm uninstall @whi/holochain-conductor-cli
	npm install --save-dev @whi/holochain-conductor-cli
bundled/DevHub.happ:	../devhub-dnas/DevHub.happ
	cp $< $@
bundled/DevHub.webhapp:	web_assets.zip bundled/DevHub.happ
	hc web pack ./bundled
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
web_assets.zip:		static/dist/webpacked.app.js Makefile
	cp node_modules/@whi/holochain-client/dist/holochain-client.prod.js		static/dependencies/holochain-client.js
	cp node_modules/@whi/holochain-client/dist/holochain-client.prod.js.map		static/dependencies/holochain-client.js.map
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.prod.js	static/dependencies/crux-payload-parser.js
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.prod.js.map	static/dependencies/crux-payload-parser.js.map
	cp node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.prod.js	static/dependencies/holo-hash.js
	cp node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.prod.js.map	static/dependencies/holo-hash.js.map
	cp node_modules/js-sha256/build/sha256.min.js					static/dependencies/sha256.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.min.js			static/dependencies/msgpack.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.min.js.map		static/dependencies/msgpack.js.map
	cp node_modules/showdown/dist/showdown.min.js					static/dependencies/showdown.js
	cp node_modules/showdown/dist/showdown.min.js.map				static/dependencies/showdown.js.map
	cp node_modules/vue/dist/vue.global.prod.js					static/dependencies/vue.js
	cp node_modules/vuex/dist/vuex.global.prod.js					static/dependencies/vuex.js
	cp node_modules/vue-router/dist/vue-router.global.prod.js			static/dependencies/vue-router.js
	cd static; zip -r ../web_assets.zip ./*
	cp node_modules/@whi/holochain-client/dist/holochain-client.js			static/dependencies/holochain-client.js
	cp node_modules/@whi/holochain-client/dist/holochain-client.js.map		static/dependencies/holochain-client.js.map
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js		static/dependencies/crux-payload-parser.js
	cp node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js.map	static/dependencies/crux-payload-parser.js.map
	cp node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.js	static/dependencies/holo-hash.js
	cp node_modules/@whi/entity-architect/node_modules/@whi/holo-hash/dist/holo-hash.js.map	static/dependencies/holo-hash.js.map
	cp node_modules/js-sha256/src/sha256.js						static/dependencies/sha256.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js			static/dependencies/msgpack.js
	cp node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js.map			static/dependencies/msgpack.js.map
	cp node_modules/showdown/dist/showdown.js					static/dependencies/showdown.js
	cp node_modules/showdown/dist/showdown.js.map					static/dependencies/showdown.js.map
	cp node_modules/vue/dist/vue.global.js						static/dependencies/vue.js
	cp node_modules/vuex/dist/vuex.global.js					static/dependencies/vuex.js
	cp node_modules/vue-router/dist/vue-router.global.js				static/dependencies/vue-router.js
