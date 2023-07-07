const { Logger }			= require('@whi/weblogger');
const log				= new Logger("common");

const { HoloHash,
	AgentPubKey }			= holohash;

const md_converter			= new showdown.Converter({
    "headerLevelStart": 3,
});

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


const RATING_TERMS = {
    "accuracy": [
	"Anti-truth",
	"Inaccurate", // Wrong, False, Untrue
	"Vague", // Ambiguous, Unclear
	"Clear", // Factual, Appropriate
	"Thorough", // Proper, Good
	"Meticulous", // Detailed, Precise, Exceptional
    ],
    "efficiency": [
	"Sadistic",
	"Wasteful", // Wasteful, Heavy
	"Costly", // Costly, Expensive, Substantial
	"Expected", // Practical
	"Efficient", // Economical, Cost-effective, Frugal, Prudent
	"Optimal", // Light-weight, Slender
    ],
};


const common				= {
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

    async load_html ( src ) {
	return await (await fetch( src )).text();
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

    download ( filename, ...byte_arrays ) {
	const blob			= new Blob( byte_arrays );
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

    hashesAreEqual ( hash1, hash2 ) {
	if ( hash1 instanceof Uint8Array )
	    hash1		= new HoloHash( hash1 )
	if ( hash1 instanceof HoloHash )
	    hash1		= hash1.toString();

	if ( hash2 instanceof Uint8Array )
	    hash2		= new HoloHash( hash2 )
	if ( hash2 instanceof HoloHash )
	    hash2		= hash2.toString();

	if ( typeof hash1 !== "string" )
	    throw new TypeError(`Invalid first argument; expected string or Uint8Array; not type of ${typeof hash1}`);

	if ( typeof hash2 !== "string" )
	    throw new TypeError(`Invalid second argument; expected string or Uint8Array; not type of ${typeof hash2}`);

	return hash1 === hash2;
    },

    toHex ( uint8_array ) {
	return [].map.call( uint8_array, n => n.toString(16).padStart(2,"0") ).join("");
    },

    randomHex ( length = 8 ) {
	let hex = "";
	while ( hex.length < length )
	    hex		       += Math.random().toString( 16 ).slice(2);
	return hex.slice(0,length);
    },

    delay ( ms = 0 ) {
	return new Promise( f => setTimeout(f,ms) );
    },

    later ( fn, ms = 0 ) {
	return new Promise( (f,r) => {
	    setTimeout( async () => {
		try {
		    return f( await fn() );
		}
		catch (err) {
		    r( err );
		}
	    }, ms );
	});
    },

    once ( fn ) {
	let P;

	return async () => {
	    if ( P === undefined ) {
		P = new Promise( async (f,r) => {
		    try {
			f( await fn() );
		    } catch (err) {
			r( err );
		    }
		});
	    }

	    return await P;
	};
    },

    snip ( str, length = 4 ) {
	return str.slice( 0, length ) + "\u2026" + str.slice( -Math.abs(length) );
    },

    compareText ( text1, text2, case_sensitive = false ) {
	// 0 = no match
	// 1 = partial match
	// 2 = full match
	if ( case_sensitive === false ) {
	    text1			= text1.toLowerCase();
	    text2			= text2.toLowerCase();
	}

	if ( text1 === text2 )
	    return 2;

	return text2.includes( text1 ) ? 1 : 0;
    },

    toKebabCase ( str ) {
	return str.split('').map( (letter, i) => {
	    return letter.toUpperCase() === letter
		? `${ i !== 0 ? '-' : '' }${ letter.toLowerCase() }`
		: letter;
	}).join('');
    },

    digest ( ...chunks ) {
	const hash			= sha256.create();
	chunks.forEach( bytes => hash.update( bytes ) );
	return new Uint8Array( hash.digest() );
    },

    array_move ( arr, from_index, to_index ) {
	if ( arr[from_index] === undefined )
	    throw new Error(`Cannot move undefined index (${from_index}); array has ${arr.length} items`);

	if ( arr[to_index-1] === undefined )
	    throw new Error(`Cannot move to destination index (${from_index}) because array length is ${arr.length}`);

	return arr.splice( to_index, 0, arr.splice( from_index, 1 )[0] );
    },

    array_compare ( a, b ) {
	let i = 0;
	while ( a[i] == b[i] ) {
	    if ( a[i] === undefined || b[i] === undefined )
		break;

	    i++;
	}

	if ( a[i] == b[i] )
	    return 0;

	return a[i] > b[i] ? 1 : -1;
    },

    sort_version ( reverse = false ) {
	return (a,b) => {
	    if( a.ordering > b.ordering )
		return reverse ? -1 : 1;
	    if( a.ordering < b.ordering )
		return reverse ? 1 : -1;

	    if( a.published_at > b.published_at )
		return reverse ? -1 : 1;
	    if( a.published_at < b.published_at )
		return reverse ? 1 : -1;

	    return 0;
	};
    },

    sort_published_at ( reverse = false ) {
	return (a,b) => {
	    if( a.published_at > b.published_at )
		return reverse ? -1 : 1;
	    if( a.published_at < b.published_at )
		return reverse ? 1 : -1;

	    return 0;
	};
    },

    sort_by_key ( key, reverse = false ) {
	return (a,b) => {
	    if( a[key] > b[key] )
		return reverse ? -1 : 1;
	    if( a[key] < b[key] )
		return reverse ? 1 : -1;

	    return 0;
	};
    },

    mdHTML ( md_text ) {
	return md_converter.makeHtml( md_text );
    },

    async http_info( url ) {
	log.info("Fetching URL info for: {}", url );
	const resp		= await fetch(`https://api.codetabs.com/v1/proxy/?quest=${url}`, {
	});

	const parser		= new DOMParser();
	const doc		= parser.parseFromString( await resp.text(), "text/html" );

	const title		= doc.querySelector("title");
	const favicon		= doc.querySelector("link[rel=icon]");
	const metas		= doc.querySelectorAll("meta");

	log.debug("URL info title: {}", title );

	const metadata		= {};
	const metaprop		= {};

	for ( let el of metas ) {
	    const attr		= el.attributes;

	    if ( attr.name && attr.content ) {
		const name	= attr.name.value;
		const content	= attr.content.value;

		metadata[name]	= content;
	    }
	    else if ( attr.property && attr.content ) {
		const name	= attr.property.value;
		const content	= attr.content.value;

		metaprop[name]	= content;
	    }
	}

	return {
	    "title":		title.textContent,
	    "description":	metadata.description,
	    "favicon":		favicon ? favicon.href : null,
	    "image":		metaprop["og:image"] || metadata["twitter:image"] || null,
	    "meta":		metadata,
	};
    },

    capitalize ( str ) {
	return str.charAt(0).toUpperCase() + str.slice(1);
    },

    rating_term ( rtype, rating ) {
	if ( isNaN(rating) )
	    return "None";

	if ( RATING_TERMS[ rtype ] === undefined )
	    throw new Error(`No terms defined for type: ${rtype}`);

	const terms			= RATING_TERMS[ rtype ];
	const i				= Math.round( rating );

	if ( terms[ i ] === undefined )
	    throw new Error(`No '{{ rtype }}' term for rating: ${i}`);

	return terms[ i ];
    },


    //
    // Math
    //
    average ( ...numbers ) {
	return common.sum( ...numbers ) / numbers.length;
    },

    sum ( ...numbers ) {
	return numbers.reduce( (a,v) => a + v, 0 );
    },


    //
    // Date
    //
    pastTime ( hours_ago ) {
	return Date.now() - (1000 * 60 * 60 * hours_ago);
    },

    scopedPath ( openstate, path, name = null ) {
	const state_name		= name ? `${name}`		: "state";
	const metastate_name		= name ? `$${name}`		: "metastate";
	const errors_name		= name ? `${name}_errors`	: "errors";
	const mutable_name		= name ? `${name}$`		: "mutable";
	const rejections_name		= name ? `${name}_rejections`	: "rejections";

	const scoped_obj		= {
	    get [state_name] () {
		return openstate.state[ path ];
	    },
	    get [metastate_name] () {
		return openstate.metastate[ path ];
	    },
	    get [errors_name] () {
		return openstate.errors[ path ];
	    },
	};

	const handler			= openstate.getPathHandler( path );

	console.log( handler, handler.readonly );
	if ( !handler.readonly ) {
	    Object.defineProperties( scoped_obj, {
		[mutable_name]: {
		    "enumerable": true,
		    get () {
			return openstate.mutable[ path ];
		    },
		},
		[rejections_name]: {
		    "enumerable": true,
		    get () {
			return openstate.rejections[ path ];
		    },
		},
	    });
	}

	return scoped_obj;
    },

    scopedPathComputed ( path, name, opts = {} ) {
	const state_name		= name ? `${name}`		: "state";
	const metastate_name		= name ? `$${name}`		: "metastate";
	const errors_name		= name ? `${name}_errors`	: "errors";
	const mutable_name		= name ? `${name}$`		: "mutable";
	const rejections_name		= name ? `${name}_rejections`	: "rejections";

	if ( opts.state && typeof opts.state !== "function" )
	    throw new Error(`scopedPathComputed 'options.state' value must be a function; not type ${typeof opts.state}`);

	let __getting			= false; // ensure 'get' is only triggered once
	function resolvePath ( ctx ) {
	    const computed_path		= typeof path === "function"
		? path( ctx )
		: path;

	    if ( opts.get === true && __getting === false ) {
		__getting		= true;
		ctx.$openstate.get( computed_path ).catch(err => {
		    console.error("Failed to read for scoped path '%s': %s", name, String(err) );
		});
	    }

	    return computed_path;
	}

	return {
	    [state_name] () {
		try {
		    const state		= this.$openstate.state[ resolvePath( this ) ] || opts.default || null;
		    if ( opts.state )
			return opts.state.call( this, state ) || state;
		    else
			return state;
		} catch ( err ) {
		    console.error(err);
		    throw err;
		}
	    },
	    [metastate_name] () {
		try {
		    return this.$openstate.metastate[ resolvePath( this ) ];
		} catch ( err ) {
		    console.error(err);
		    throw err;
		}
	    },
	    [errors_name] () {
		try {
		    return this.$openstate.errors[ resolvePath( this ) ];
		} catch ( err ) {
		    console.error(err);
		    throw err;
		}
	    },
	    [mutable_name] () {
		try {
		    const path			= resolvePath( this );
		    if ( path === this.$openstate.DEADEND )
			return null;

		    const metastate		= this.$openstate.metastate[ path ];
		    const handler		= this.$openstate.getPathHandler( path );

		    if ( handler.readonly || !metastate.writable )
			return null;

		    return this.$openstate.mutable[ path ];
		} catch ( err ) {
		    console.error(err);
		    throw err;
		}
	    },
	    [rejections_name] () {
		try {
		    return this.$openstate.rejections[ resolvePath( this ) ];
		} catch ( err ) {
		    console.error(err);
		    throw err;
		}
	    },
	};
    },

    isEmpty ( value ) {
	if ( [null,undefined].includes( value ) )
	    return false;
	else if ( Array.isArray( value ) )
	    return value.length === 0;
	else if ( typeof value === "string" )
	    return value.trim().length === 0;
	else if ( typeof value === "object" )
	    return Object.keys(value).length === 0;
	else
	    throw new Error(`Emptiness of type '${typeof value}' cannot be determined`);
    },

    async createWebAsset ( bytes ) {
	const digest				= common.digest( bytes );
	const hash				= common.toHex( digest );
	const datapath				= `webasset/${hash}`;
	const input				= this.$openstate.mutable[ datapath ];

	input.file_bytes			= bytes;

	return await this.$openstate.write( datapath );
    },

    async downloadMemory( client, address, dna_name = "web_assets" ) {
	let memory				= await client.call( dna_name, "mere_memory_api", "get_memory", address );

	const bytes				= new Uint8Array( memory.memory_size );

	const blocks				= await Promise.all(
	    memory.block_addresses.map( async block_addr => {
		return await client.call( dna_name, "mere_memory_api", "get_memory_block", block_addr );
	    })
	);

	let index				= 0;
	for ( let block of blocks ) {
	    bytes.set( block.bytes, index );
	    index			       += block.bytes.length;
	}

	return bytes;
    },

    async uploadMemory( client, bytes, progress_callback ) {
	const chunks				= new Chunker( bytes );
	const block_addresses			= [];

	let position				= 0;
	for ( let chunk of chunks ) {
	    log.trace("Chunk %s/%s (%s bytes)", position, chunks.length, chunk.length.toLocaleString() );
	    let input				= {
		"sequence": {
		    "position": ++position,
		    "length": chunks.length,
		},
		"bytes": Array.from( chunk ),
		// "bytes": chunk,
	    };
	    let response			= await client.call( "web_assets", "mere_memory_api", "create_memory_block", input );

	    block_addresses.push( new HoloHash( response ) );

	    if ( typeof progress_callback === "function" ) {
		try {
		    progress_callback(
			Math.floor(position/chunks.length*100),
			position,
			chunks.length+1,
		    );
		} catch (err) {
		    console.error( err );
		}
	    }
	}

	const gui_digest			= await common.digest( bytes );
	let input				= {
	    "hash": Array.from( gui_digest ),
	    block_addresses,
	    "memory_size": bytes.length,
	};
	let response				= await client.call( "web_assets", "mere_memory_api", "create_memory", input );

	try {
	    progress_callback(
		100,
		chunks.length+1,
		chunks.length+1,
	    );
	} catch (err) {
	    console.error( err );
	}

	return new HoloHash( response );
    },

};

module.exports = common;
