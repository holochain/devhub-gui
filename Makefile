
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
dist:			dist/webpacked.app.js
dist/webpacked.app.js:	node_modules
	npm run build


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
web_assets.zip:		dist Makefile
	cd dist; zip -r ../web_assets.zip ./*
