const { EntryHash,
	AgentPubKey }			= holohash;


module.exports = {
    "profile": {
	"*": content => content,
    },
    // hApps
    "happ": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.designer		= new AgentPubKey( content.designer );
	    return content;
	},
	"info": function ( content ) {
	    if ( content.gui )
		content.gui.asset_group_id	= new EntryHash( content.gui.asset_group_id );
	    return content;
	}
    },
    "happ_release": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );

	    content.dnas.forEach( (dna_ref, i) => {
		content.dnas[i].dna		= new EntryHash( dna_ref.dna );
		content.dnas[i].version		= new EntryHash( dna_ref.version );
	    });
	    return content;
	},
	"info": function ( content ) {
	    content.for_happ		= this.deconstruct( "entity", content.for_happ );
	    return content;
	},
	"summary": function ( content ) {
	    content.for_happ		= new EntryHash( content.for_happ );
	    return content;
	},
    },
    // DNAs
    "dna": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.developer.pubkey	= new AgentPubKey( content.developer.pubkey );
	    return content;
	},
    },
    "dna_version": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    return content;
	},
	"info": function ( content ) {
	    content.for_dna		= this.deconstruct( "entity", content.for_dna );

	    Object.entries( content.zomes ).forEach( ([name, zome_version_summary]) => {
		if ( zome_version_summary === null )
		    return;
		content.zomes[name]	= this.deconstruct( "entity", zome_version_summary );
	    });
	    return content;
	},
	"summary": function ( content ) {
	    content.for_dna		= new EntryHash( content.for_dna );

	    content.zomes.forEach( (zome_ref, i) => {
		content.zomes[i].zome		= new EntryHash( zome_ref.zome );
		content.zomes[i].version	= new EntryHash( zome_ref.version );
		content.zomes[i].resource	= new EntryHash( zome_ref.resource );
	    });
	    return content;
	},
	"package": function ( content ) {
	    content.bytes		= new Uint8Array( content.bytes );
	    return content;
	},
    },
    // Zomes
    "zome": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.developer.pubkey	= new AgentPubKey( content.developer.pubkey );
	    return content;
	},
    },
    "zome_version": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.mere_memory_addr	= new EntryHash( content.mere_memory_addr );
	    return content;
	},
	"info": function ( content ) {
	    content.for_zome		= this.deconstruct( "entity", content.for_zome );
	    return content;
	},
	"summary": function ( content ) {
	    content.for_zome		= new EntryHash( content.for_zome );
	    return content;
	},
    },
};
