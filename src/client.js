const { Logger }			= require('@whi/weblogger');
const log				= new Logger("client");

const { DnaHash,
	AgentPubKey }			= holohash;
const { AgentClient }			= HolochainClient;
const { CruxConfig }			= CruxPayloadParser;
const entity_types			= require('./entity_architecture.js');


const DNAREPO_HASH			= new DnaHash( process.env.DNAREPO_HASH );
const HAPPS_HASH			= new DnaHash( process.env.HAPPS_HASH );
const WEBASSETS_HASH			= new DnaHash( process.env.WEBASSETS_HASH );

const AGENT_HASH			= localStorage.getItem("AGENT_PUBKEY");
const HOST_VALUE			= localStorage.getItem("APP_HOST");
const PORT_VALUE			= localStorage.getItem("APP_PORT");
const APP_PORT				= parseInt( PORT_VALUE ) || 44001;
const APP_HOST				= HOST_VALUE || "localhost";
const CONDUCTOR_URI			= `${APP_HOST}:${APP_PORT}`;

if ( isNaN( APP_PORT ) )
    throw new Error(`Invalid 'APP_PORT' (${PORT_VALUE}); run 'localStorage.setItem( "APP_PORT", "<port number>" );`);


module.exports = async function () {
    const crux_config			= new CruxConfig( entity_types, [] );

    let  client;
    try {
	const resp			= await fetch("./.launcher-env.json");
	const launcher_config		= await resp.json();

	client				= await AgentClient.createFromAppInfo(
	    launcher_config.INSTALLED_APP_ID,
	    launcher_config.APP_INTERFACE_PORT
	);
    } catch (err) {
	log.warn("Using hard-coded configuration because launcher config produced error: %s", err.toString() );
    }

    if ( !client ) {
	if ( typeof AGENT_HASH !== "string" )
	    throw new Error(`Missing "AGENT_PUBKEY" in local storage; run 'localStorage.setItem( "AGENT_PUBKEY", "<holo hash>" );`);

	log.warn("Using Agent hash: %s", AGENT_HASH );
	const AGENT_PUBKEY		= new AgentPubKey( AGENT_HASH );

	client				=  new AgentClient( AGENT_PUBKEY, {
	    "dnarepo":         DNAREPO_HASH,
	    "happs":           HAPPS_HASH,
	    "web_assets":       WEBASSETS_HASH,
	}, CONDUCTOR_URI );
    }

    log.normal("App schema");
    log.level.normal && Object.entries( client._app_schema._dnas ).forEach( ([nick, schema]) => {
	log.normal("  %s : %s", nick.padStart( 10 ), String( schema._hash ) );

	log.level.info && Object.entries( schema._zomes ).forEach( ([name, zome_api]) => {
	    log.info("  %s : %s", name.padStart( 10 ), zome_api._name );
	});
    });

    client.addProcessor("input", async function (input) {
	let keys			= input ? ` ${Object.keys( input ).join(", ")} ` : "";
	log.trace("Calling %s::%s->%s(%s)", this.dna, this.zome, this.func, keys );
	return input;
    });
    client.addProcessor("output", async function (output) {
	log.trace("Response for %s::%s->%s(%s)", this.dna, this.zome, this.func, this.input ? " ... " : "", output );
	return output;
    });

    crux_config.upgrade( client );

    return client;
}
