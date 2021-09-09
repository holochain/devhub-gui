
SHELL		= bash

PROJECT_NAME	= devhub
AGENT		= ./tests/AGENT
DNAREPO_HASH	= ./tests/DNAREPO_HASH
HAPPS_HASH	= ./tests/HAPPS_HASH
WEBASSETS_HASH	= ./tests/WEBASSETS_HASH
LAIR_DIR	= ./tests/lair
HC_DIR		= ./tests/conductor-storage
HC_CONF		= $(HC_DIR)/conductor-config.yml
HC_ADMIN_PORT	= 35678
DNA_DNAREPO	= dnas/dnarepo.dna
DNA_HAPPS	= dnas/happs.dna
DNA_WEBASSETS	= dnas/webassets.dna
NGINX_CONF	= /etc/nginx/sites-available/$(PROJECT_NAME)
RUST_LOG_LVL	= info

.PRECIOUS:	$(AGENT) $(AGENT)_% $(DNAREPO_HASH) # prevent Makefile from auto-removing these files


#
# HTTP Server
#
$(NGINX_CONF):		tests/nginx/$(PROJECT_NAME)
	sed -e "s|PWD|$(shell pwd)|g"					\
	    < $< | sudo tee $@;
	echo " ... Wrote new $@ (from $<)";
	sudo ln -fs ../sites-available/$(PROJECT_NAME) /etc/nginx/sites-enabled/
	sudo systemctl reload nginx.service
	systemctl status nginx


nix-%:
	nix-shell --run "make $*"

#
# Lair Keystore
#
reset-lair:
	rm $(LAIR_DIR) -rf
	rm $(AGENT) -f
lair:			$(LAIR_DIR)/socket
$(LAIR_DIR)/socket:
	RUST_LOG=$(RUST_LOG_LVL) lair-keystore --lair-dir $(LAIR_DIR) > lair.log 2>&1 &
stop-lair:
	kill $$(cat $(LAIR_DIR)/pid) && rm -f $(LAIR_DIR)/pid $(LAIR_DIR)/socket $(LAIR_DIR)/store
check-lair:
	@ps -efH | grep -v grep | grep lair-keystore
	@pgrep lair-keystore


#
# Holochain Conductor
#
reset-hcc:
	rm $(HC_DIR)/databases/ -rf
	rm $(DNAREPO_HASH) -f
conductor:		$(HC_DIR)/pid
$(HC_DIR):
	mkdir -p $(HC_DIR)
$(HC_CONF):		$(HC_DIR) tests/genconfig.js
	node tests/genconfig.js $(HC_ADMIN_PORT) $(HC_CONF)
$(HC_DIR)/pid:
	make $(HC_CONF)
	RUST_LOG=$(RUST_LOG_LVL) holochain --config-path $(HC_DIR)/conductor-config.yml > conductor.log 2>&1 & echo $$! | tee $(HC_DIR)/pid
stop-conductor:
	kill $$(cat $(HC_DIR)/pid) && rm -f $(HC_DIR)/pid
check-conductor:	check-holochain
check-holochain:
	@ps -efH | grep -v grep | grep -E "holochain.*config.yml"
	@pgrep holochain
conductor.log:
	touch $@


#
# Runtime Setup
#
reset-dnas:
	rm -f tests/*_HASH
	rm -f dnas/*.dna
	rm -fr holochain/databases/*
	make dnas
reset-all:		reset-hcc reset-lair
	rm dnas/*.dna
CCLI_OPTS	= -p $(HC_ADMIN_PORT) -vvvvvv
$(AGENT):
	npx conductor-cli -q $(CCLI_OPTS) gen-agent > $@ || rm $@
$(DNAREPO_HASH):	$(DNA_DNAREPO)
	npx conductor-cli $(CCLI_OPTS) register dnas/dnarepo.dna > $@ || rm $@
$(HAPPS_HASH):		$(DNA_HAPPS)
	npx conductor-cli $(CCLI_OPTS) register dnas/happs.dna > $@ || rm $@
$(WEBASSETS_HASH):	$(DNA_WEBASSETS) $(HAPPS_HASH)
	npx conductor-cli $(CCLI_OPTS) register dnas/webassets.dna > $@ || rm $@
install-dnas:		$(AGENT) $(DNAREPO_HASH) $(HAPPS_HASH) $(WEBASSETS_HASH)
	npx conductor-cli $(CCLI_OPTS) install -a "$$(cat $(AGENT))" devhub-app		\
		"$$(cat $(DNAREPO_HASH)):dnarepo"					\
		"$$(cat $(HAPPS_HASH)):happs"						\
		"$$(cat $(WEBASSETS_HASH)):webassets"					|| true
	npx conductor-cli $(CCLI_OPTS) activate devhub-app	|| true
	npx conductor-cli $(CCLI_OPTS) attach-interface 44001

dnas:			$(DNA_DNAREPO) $(DNA_HAPPS) $(DNA_WEBASSETS)
$(DNA_DNAREPO):		../devhub-dnas/bundled/dnarepo/dnarepo.dna
	cp $< $@
$(DNA_HAPPS):		../devhub-dnas/bundled/happs/happs.dna
	cp $< $@
$(DNA_WEBASSETS):	../devhub-dnas/bundled/web_assets/web_assets.dna
	cp $< $@
# make stop-conductor reset-hcc conductor

$(AGENT)_%:
	npx conductor-cli -q $(CCLI_OPTS) gen-agent > $@
install-dnas-%:		$(AGENT)_% $(DNAREPO_HASH)
	npx conductor-cli $(CCLI_OPTS) install -a "$$(cat $(AGENT)_$*)" $*-devhub-app "$$(cat $(DNAREPO_HASH)):dnarepo"	|| true
	npx conductor-cli $(CCLI_OPTS) activate $*-devhub-app	|| true


#
# Testing
#
test:
	npx mocha --recursive ./tests
test-debug:
	LOG_LEVEL=silly npx mocha --recursive ./tests

test-unit:
	npx mocha ./tests/unit
test-unit-debug:
	LOG_LEVEL=silly npx mocha ./tests/unit


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
