const { Logger }			= require('@whi/weblogger');
const log				= new Logger("common");

const { HoloHashes }			= require('@holochain/devhub-entities');
const { HoloHash,
	AgentPubKey }			= HoloHashes;


const _debounce_timers			= {};

function fallbackCopyTextToClipboard ( text ) {
    let textArea			= document.createElement("textarea");
    textArea.value			= text;

    textArea.style.bottom		= "0";
    textArea.style.right		= "0";
    textArea.style.position		= "fixed";

    document.body.appendChild( textArea );
    textArea.focus();
    textArea.select();

    try {
	if ( !document.execCommand('copy') )
	    throw new Error(`Unable to copy to clipboard`);
    } finally {
	document.body.removeChild( textArea );
    }
}

module.exports = {
    sort_by_object_key ( list_of_objects, key ) {
	return list_of_objects.sort( (a,b) => {
	    if ( a[key] === undefined )
		return b[key] === undefined ? 0 : -1;
	    return a[key] < b[key]
		? -1
		: a[key] > b[key] ? 1 : 0;
	} );
    },

    copy ( src, dest = {}, ...keys ) {
	log.trace("Copying object keys: %s", () => [ (keys.length ? keys : Object.keys(src)).join(", ") ]);

	if ( keys.length === 0 ) // intention is to copy the whole source
	    return Object.assign( dest, src );

	let fkey			= keys.pop();

	keys.forEach( key => {
	    if ( src === null || typeof src !== "object" )
		log.error("Source object is type '%s'; must be an object", typeof src );
	    if ( dest === null || typeof dest !== "object" )
		log.error("Destination object is type '%s'; must be an object", typeof dest );

	    src				= src[key];

	    if ( dest[key] === undefined ) // create the path for destination object
		dest[key]		= {};

	    dest			= dest[key];
	});

	dest[fkey]			= src[fkey];

	return dest;
    },

    async copyToClipboard ( text ) {
	if ( !navigator.clipboard )
	    return fallbackCopyTextToClipboard( text );

	await navigator.clipboard.writeText( text );
    },

    load_file ( file ) {
	log.normal("Load file:", file );
	return new Promise((f,r) => {
	    let reader			= new FileReader();

	    reader.readAsArrayBuffer( file );
	    reader.onerror		= function (err) {
		log.error("FileReader error event:", err );

		r( err );
	    };
	    reader.onload		= function (evt) {
		log.info("FileReader load event:", evt );
		let result		= new Uint8Array( evt.target.result );
		log.debug("FileReader result:", result );

		f( result );
	    };
	    reader.onprogress		= function (p) {
		log.trace("progress:", p );
	    };
	});
    },

    download ( filename, ...bytes ) {
	const blob			= new Blob( bytes );
	log.normal("Downloading bytes (%s bytes) as '%s'", blob.size, filename );

	const link			= document.createElement("a");
	link.href			= URL.createObjectURL( blob );
	link.download			= filename;

	link.click();
    },

    debounce ( callback, delay = 1_000, id ) {
	if ( id === undefined )
	    id				= String(callback);

	const toid			= _debounce_timers[id];

	if ( toid ) {
	    clearTimeout( toid );
	    delete _debounce_timers[id];
	}

	_debounce_timers[id] = setTimeout( () => {
	    callback.bind(this);
	    delete _debounce_timers[id];
	}, delay );
    },

    isMyPubKey ( hash ) {
	if ( !this.$root.agent )
	    return false;

	if ( hash instanceof Uint8Array )
	    hash			= new AgentPubKey( hash )
	if ( hash instanceof HoloHash )
	    hash			= hash.toString();

	if ( typeof hash !== "string" )
	    throw new TypeError(`Invalid AgentPubKey; expected string or Uint8Array`);

	return hash === String( this.$root.agent.pubkey.initial );
    },

    isAgentPubKey ( hash ) {
	try {
	    new AgentPubKey( hash );
	} catch (err) {
	    return false;
	}
	return true;
    },

    toHex ( uint8_array ) {
	return [].map.call( uint8_array, n => n.toString(16).padStart(2,"0") ).join("");
    },

    delay ( ms = 0 ) {
	return new Promise( f => setTimeout(f,ms) );
    },

    snip ( str, length = 4 ) {
	return str.slice( 0, length ) + "\u2026" + str.slice( -Math.abs(length) );
    }
};
