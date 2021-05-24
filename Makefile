
SHELL		= bash

AGENT		= ./tests/AGENT
DNAREPO_HASH	= ./tests/DNAREPO_HASH
LAIR_DIR	= ./tests/lair
HC_DIR		= ./tests/conductor-storage
HC_CONF		= $(HC_DIR)/conductor-config.yml
HC_ADMIN_PORT	= 35678
DNA_DNAREPO	= dnas/dnarepo.dna


#
# Lair Keystore
#
lair:			$(LAIR_DIR)/socket
$(LAIR_DIR)/socket:
	nix-shell --run "RUST_LOG=trace lair-keystore --lair-dir $(LAIR_DIR) > lair.log 2>&1 &"
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
	rm $(DNAREPO_HASH)
conductor:		$(HC_DIR)/pid
$(HC_DIR):
	mkdir -p $(HC_DIR)
$(HC_CONF):		$(HC_DIR) tests/genconfig.js
	node tests/genconfig.js $(HC_ADMIN_PORT) $(HC_CONF)
$(HC_DIR)/pid:
	make $(HC_CONF)
	RUST_LOG=trace holochain --config-path $(HC_DIR)/conductor-config.yml > conductor.log 2>&1 & echo $$! | tee $(HC_DIR)/pid
stop-conductor:
	kill $$(cat $(HC_DIR)/pid) && rm -f $(HC_DIR)/pid && rm -rf $(HC_DIR)/databases
check-conductor:	check-holochain
check-holochain:
	@ps -efH | grep -v grep | grep -E "holochain.*config.yml"
	@pgrep holochain
conductor.log:
	touch $@

CCLI_OPTS	= -p $(HC_ADMIN_PORT) -vvvvvv
$(AGENT):
	npx conductor-cli -q $(CCLI_OPTS) gen-agent > $@ || rm $@
$(DNAREPO_HASH):	$(DNA_DNAREPO)
	npx conductor-cli $(CCLI_OPTS) register dnas/dnarepo.dna > $@ || rm $@
install-dnas:		$(AGENT) $(DNAREPO_HASH)
	npx conductor-cli $(CCLI_OPTS) install -a "$$(cat $(AGENT))" devhub-app "$$(cat $(DNAREPO_HASH)):dnarepo"	|| true
	npx conductor-cli $(CCLI_OPTS) activate devhub-app	|| true
	npx conductor-cli $(CCLI_OPTS) attach-interface 44001

$(DNA_DNAREPO):		../devhub-happ/bundled/dnas/dnas.dna
	cp ../devhub-happ/bundled/dnas/dnas.dna $@
	make stop-conductor reset-hcc conductor
