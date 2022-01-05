
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
	cp ~/projects/devhub-dnas/bundled/dnarepo.dna		dnas/dnarepo.dna
	cp ~/projects/devhub-dnas/bundled/happs.dna		dnas/happs.dna
	cp ~/projects/devhub-dnas/bundled/web_assets.dna	dnas/webassets.dna
copy-zomes-from-local:	zome_wasm
	cp ~/projects/devhub-dnas/zomes/*.wasm			./zome_wasm/


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
use-local-devhub-entities:
	npm uninstall @holochain/devhub-entities
	npm install ../devhub-dnas/js-devhub-entities/holochain-devhub-entities-0.4.2.tgz
use-npm-devhub-entities:
	npm uninstall @holochain/devhub-entities
	npm install @holochain/devhub-entities
bundled/DevHub.happ:	../devhub-dnas/DevHub.happ
	cp $< $@
bundled/DevHub.webhapp:	web_assets.zip bundled/DevHub.happ
	hc web pack ./bundled


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
web_assets.zip:		dist/* Makefile
	cd dist; zip -r ../web_assets.zip ./*
