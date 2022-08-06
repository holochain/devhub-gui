const { EntryHash,
	ActionHash,
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

	    if ( content.gui )
		content.gui.asset_group_id	= new EntryHash( content.gui.asset_group_id );

	    return content;
	},
    },
    "happ_release": {
	"*": function ( content ) {
	    content.for_happ		= new EntryHash( content.for_happ );
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );

	    content.dnas.forEach( (dna_ref, i) => {
		content.dnas[i].dna		= new EntryHash( dna_ref.dna );
		content.dnas[i].version		= new EntryHash( dna_ref.version );
	    });

	    return content;
	},
    },
    // DNAs
    "dna": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.developer		= new AgentPubKey( content.developer );
	    return content;
	},
    },
    "dna_version": {
	"*": function ( content ) {
	    content.for_dna		= new EntryHash( content.for_dna );
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );

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
	    content.developer		= new AgentPubKey( content.developer );
	    return content;
	},
    },
    "zome_version": {
	"*": function ( content ) {
	    content.for_zome		= new EntryHash( content.for_zome );
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.mere_memory_addr	= new EntryHash( content.mere_memory_addr );

	    if ( content.review_summary )
		content.review_summary	= new EntryHash( content.review_summary );

	    return content;
	},
    },
    // Reviews
    "review": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.author		= new AgentPubKey( content.author );

	    if ( content.reaction_summary )
		content.reaction_summary = new EntryHash( content.reaction_summary );

	    content.subject_ids.forEach( ([id, action], i) => {
		content.subject_ids[i]	= [ new EntryHash( id ), new ActionHash( action ) ];
	    });

	    return content;
	},
    },
    // Reactions
    "reaction": {
	"*": function ( content ) {
	    content.published_at	= new Date( content.published_at );
	    content.last_updated	= new Date( content.last_updated );
	    content.author		= new AgentPubKey( content.author );
	    content.type_name		= content.reaction_type === 1 ? "like" : "dislike";

	    content.subject_ids.forEach( ([id, action], i) => {
		content.subject_ids[i]	= [ new EntryHash( id ), new ActionHash( action ) ];
	    });

	    return content;
	},
    },
};
