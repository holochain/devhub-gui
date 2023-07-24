const { EntryHash,
	ActionHash,
	AgentPubKey }			= holohash;


module.exports = {
    "profile": content => content,
    // hApps
    "happ": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.designer		= new AgentPubKey( content.designer );

	if ( content.gui )
	    content.gui.asset_group_id	= new ActionHash( content.gui.asset_group_id );

	return content;
    },
    "happrelease": function ( content ) {
	content.for_happ		= new ActionHash( content.for_happ );
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );

	console.log("Converting official gui Uint8Array")
	if ( content.official_gui )
	    content.official_gui	= new ActionHash( content.official_gui );

	content.dnas.forEach( (dna_ref, i) => {
	    content.dnas[i].dna		= new ActionHash( dna_ref.dna );
	    content.dnas[i].version	= new ActionHash( dna_ref.version );
	});

	return content;
    },
    // DNAs
    "dna": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.developer		= new AgentPubKey( content.developer );
	return content;
    },
    "dnaversion": function ( content ) {
	content.for_dna			= new ActionHash( content.for_dna );
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );

	if ( content.integrity_zomes ) {
	    content.integrity_zomes.forEach( (zome_ref, i) => {
		content.integrity_zomes[i].zome		= new ActionHash( zome_ref.zome );
		content.integrity_zomes[i].version	= new ActionHash( zome_ref.version );
		content.integrity_zomes[i].resource	= new EntryHash( zome_ref.resource );
	    });
	}

	if ( content.zomes ) {
	    content.zomes.forEach( (zome_ref, i) => {
		content.zomes[i].zome		= new ActionHash( zome_ref.zome );
		content.zomes[i].version	= new ActionHash( zome_ref.version );
		content.zomes[i].resource	= new EntryHash( zome_ref.resource );
	    });
	}

	if ( content.bytes )
	    content.bytes		= new Uint8Array( content.bytes );

	return content;
    },
    // Zomes
    "zome": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.developer		= new AgentPubKey( content.developer );
	return content;
    },
    "zomeversion": function ( content ) {
	content.for_zome		= new ActionHash( content.for_zome );
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.mere_memory_addr	= new EntryHash( content.mere_memory_addr );

	if ( content.review_summary )
	    content.review_summary	= new ActionHash( content.review_summary );

	return content;
    },
    // GUI
    "gui": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.designer		= new AgentPubKey( content.designer );

	return content;
    },
    "guirelease": function ( content ) {
	content.for_gui			= new ActionHash( content.for_gui );
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.web_asset_id		= new ActionHash( content.web_asset_id );

	content.for_happ_releases.forEach( (happ_id, i) => {
	    content.for_happ_releases[i]	= new ActionHash( happ_id );
	});

	return content;
    },
    // Reviews
    "review": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.author			= new AgentPubKey( content.author );

	if ( content.reaction_summary )
	    content.reaction_summary	= new ActionHash( content.reaction_summary );

	content.subject_ids.forEach( ([id, action], i) => {
	    content.subject_ids[i]	= [ new ActionHash( id ), new ActionHash( action ) ];
	});

	return content;
    },
    // Reactions
    "reaction": function ( content ) {
	content.published_at		= new Date( content.published_at );
	content.last_updated		= new Date( content.last_updated );
	content.author			= new AgentPubKey( content.author );
	content.type_name		= content.reaction_type === 1 ? "like" : "dislike";

	content.subject_ids.forEach( ([id, action], i) => {
	    content.subject_ids[i]	= [ new ActionHash( id ), new ActionHash( action ) ];
	});

	return content;
    },
    "reactionsummary": function ( content ) {
	content.subject_id		= new ActionHash( content.subject_id );

	content.subject_history.forEach( (id, i) => {
	    content.subject_history[i]	= new ActionHash( id );
	});

	return content;
    },
};
