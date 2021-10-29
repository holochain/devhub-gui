
SHELL		= bash
PROJECT_NAME	= devhub

#
# Project
#
package-lock.json:	package.json
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
#
# Runtime Setup
#
run-holochain:		node_modules
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -vv
reset-holochain:	node_modules
	rm -rf holochain tests/AGENT* tests/*_HASH
dna_packages:		dnas/dnarepo.dna dnas/happs.dna dnas/web_assets.dna
setup:			dna_packages node_modules
	node tests/setup.js
setup-%:		dna_packages node_modules
	node tests/setup.js $*

dnas:
	mkdir $@
zome_wasm:
	mkdir $@
dnas/%.dna:		dnas
	$(error Download missing DNA ($*.dna) into location ./$@ (eg. run `make copy-from-local`))

copy-dnas-from-local:	dnas
	cp ../devhub-dnas/bundled/*.dna			./dnas/
	touch dnas/*.dna
copy-zomes-from-local:	zome_wasm
	cp ../devhub-dnas/zomes/*.wasm			./zome_wasm/
	touch zome_wasm/*.wasm

copy-from-local: copy-dnas-from-local copy-zomes-from-local

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
web_assets.zip:		dist/webpacked.app.js
	rm -f dist/src_templates_*
	zip -r web_assets.zip ./dist
