
SHELL		= bash
PROJECT_NAME	= devhub

#
# Runtime Setup
#
run-holochain:
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -vv
dna_packages:		dnas/dnarepo.dna dnas/happs.dna dnas/webassets.dna
setup:			dna_packages
	node tests/setup.js
setup-%:		dna_packages
	node tests/setup.js $*

dnas:
	mkdir dnas
dnas/%.dna:		dnas
	$(error Download missing DNA ($*.dna) into location ./$@)

copy-dnas-from-local:
	cp ~/projects/devhub-dnas/bundled/dnarepo/dnarepo.dna		dnas/dnarepo.dna
	cp ~/projects/devhub-dnas/bundled/happs/happs.dna		dnas/happs.dna
	cp ~/projects/devhub-dnas/bundled/web_assets/web_assets.dna	dnas/webassets.dna


#
# HTTP Server
#
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
