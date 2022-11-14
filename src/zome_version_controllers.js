const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zome versions");

const common				= require('./common.js');


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await common.load_html("/templates/zomes/versions/create.html"),
	    "data": function() {
		const zome_id		= this.getPathId("zome");

		return {
		    zome_id,
		    "zome_version_datapath":	`zome/version/new`,
		    "zome_file":		null,
		    "error":			null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => `zome/${c.zome_id}`,		"zome", { "get": true } ),
		...common.scopedPathComputed( c => c.zome_version_datapath,	"version" ),
		...common.scopedPathComputed( `dnarepo/hdk/versions`,		"previous_hdk_versions", { "get": true }),

		sc_url_datapath () {
		    return this.version$.source_code_commit_url
			? `url/info/${this.version$.source_code_commit_url.replaceAll("/", "|")}`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.sc_url_datapath,		"sc_url_preview" ),

		form () {
		    return this.$refs["form"];
		},

		file_valid_feedback () {
		    const file		= this.zome_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		const version			= await this.$openstate.get(`zome/${this.zome_id}/latest_version`);

		this.version$.for_zome	= this.zome_id;
		this.version$.ordering	= version ? version.ordering + 1 : 1;
	    },
	    "methods": {
		async file_selected ( event ) {
		    console.log(`File selected`, event );

		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			this.version$.zome_bytes	= null;
			this.zome_file			= null;
			return;
		    }

		    this.zome_file		= file;
		    this.version$.zome_bytes	= await this.load_file( file );

		    console.log(`File selected done`, this.version$ );
		},
		async createSourceCodeUrlPreview ( url ) {
		    if ( !url ) {
			delete this.version$.metadata.source_code_url_preview;
			return;
		    }

		    await this.$openstate.read( this.sc_url_datapath );
		    const url_info		= this.$openstate.state;

		    Object.assign( this.version$.metadata, {
			"source_code_url_preview": {
			    "title":		url_info.title,
			    "description":	url_info.description,
			    "image":		url_info.image,
			},
		    });
		    log.debug("Updated preview metadata:", this.version$ );

		    return url_info;
		},
		async write () {
		    try {
			await this.$openstate.write( this.zome_version_datapath );

			const new_id		= this.version.$id;

			this.$openstate.purge( this.zome_version_datapath );
			this.$openstate.read(`zome/${this.zome_id}/versions`);

			this.$router.push( `/zomes/${this.zome_id}/versions/${new_id}` );
		    } catch ( err ) {
			log.error("Failed to create Zome Version:", err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/zomes/versions/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const zome_id		= this.getPathId("zome");

		return {
		    id,
		    zome_id,
		    "my_review": null,

		    "zomepath":			`zome/${zome_id}`,
		    "versionpath":		`zome/version/${id}`,
		    "wasmbytespath":		`zome/version/${id}/wasm`,
		    "reviewsummarypath":	`zome/version/${id}/review/summary`,
		    "versionreviewspath":	`zome/version/${id}/reviews`,
		    "reviewinputpath":		`review/new`,

		    "calculating": false,
		    "review_summary_error": null,
		};
	    },
	    async created () {
		await this.mustGet(async () => {
		    await Promise.all([
			this.$openstate.get( this.versionpath ),
			this.$openstate.get( this.zomepath ),
		    ]);
		});

		await this.$openstate.get( `agent/me/reviews` );

		if ( this.myReviewMap[ this.id ] ) {
		    this.my_review		= this.myReviewMap[ this.id ];

		    this.reviewinputpath	= `review/${this.my_review.$id}`;
		} else {
		    this.resetReviewEdit();
		}
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.zomepath,			"zome", { "get": true } ),
		...common.scopedPathComputed( c => c.versionpath,		"version", { "get": true } ),
		...common.scopedPathComputed( c => c.wasmbytespath,		"wasm_bytes" ),
		...common.scopedPathComputed( c => c.reviewsummarypath,		"summary", { "get": true } ),
		...common.scopedPathComputed( c => c.versionreviewspath,	"reviews", { "get": true, "default": [] } ),
		...common.scopedPathComputed( c => c.reviewinputpath,		"review_input" ),

		form_review () {
		    return this.$refs["form_review"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		reviewModal () {
		    return this.$refs["review"].modal;
		},

		$reviewMap () {
		    return id => {
			return this.$openstate.metastate[`review/${id}`];
		    };
		},

		wasm_filename () {
		    if ( !this.zome )
			return "Zome Wasm";

		    const filename	= this.zome.name.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_v${this.version.version}.wasm`;
		},
	    },
	    "methods": {
		async refresh () {
		    this.$openstate.read( this.zomepath );
		    await this.fetchVersion();
		    this.$openstate.read( this.versionreviewspath );

		    if ( this.version.review_summary )
			this.$openstate.read( this.summarypath );

		    // if ( this.version.review_summary )
		    // 	await this.$store.dispatch("fetchReviewSummary", this.version.review_summary );

		    return;
		    // If there is not summary, or the review's length is greater than the review ref
		    // list, then try to update the summary.
		    if ( ( !this.version.review_summary && this.reviews.length > 1 )
			 || ( this.summary && (
			     this.reviews.length > Object.keys(this.summary.review_refs).length
				 || this.summary.last_updated < this.pastTime( 24 ) ))
		       ) {
			const version		= await this.$store.dispatch("updateZomeVersionReviewSummary", this.id );
			await this.$store.dispatch("fetchReviewSummary", version.review_summary );
		    }
		},
		async downloadWasmBytes () {
		    try {
			const wasm_bytes	= await this.$openstate.get( this.wasmbytespath );
			// const wasm_bytes	= await this.$store.dispatch("fetchZomeVersionWasm", this.version.mere_memory_addr );

			this.download( this.wasm_filename, wasm_bytes );
		    } catch (err) {
			log.error("Failed to get wasm bytes for zome version(%s): %s", String(this.id), err.message, err );
		    }
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishZomeVersion", this.id );

		    this.modal.hide();

		    this.$store.dispatch("fetchVersionsForZome", this.zome_id );
		    this.$router.push( `/zomes/${this.zome_id}` );
		},
		async postReview () {
		    await this.$openstate.write( this.reviewinputpath );

		    this.reviewinputpath	= `review/${this.$openstate.state[ this.reviewinputpath ].$id}`;

		    this.reviewModal.hide();

		    await this.$openstate.read( this.versionreviewspath );

		    // if ( this.reviews.length > 1 )
		    // 	this.updateReviewSummaryReport();
		},
		async updateReviewSummaryReport () {
		    // this.$openstate.mutable[`subject/${this.id}/review/summary`];
		    await this.$openstate.write(`subject/${this.id}/review/summary`);
		    await this.$openstate.read(`zome/verison/${this.id}/review/summary`);
		    // await this.$store.dispatch("updateZomeVersionReviewSummary", this.id );
		    // await this.$store.dispatch("fetchReviewSummary", this.version.review_summary );
		},

		async doReaction ( review, reaction_type ) {
		    log.normal("Do reaction for review: %s [%s]", review.$id, reaction_type, reaction );
		    const reactionpath		= `subject/${review.$id}/reaction`;
		    const reaction		= this.$openstate.state[ reactionpath ];
		    const mutable		= this.$openstate.mutable[ reactionpath ];

		    if ( reaction && !reaction.deleted && reaction.reaction_type === reaction_type ) {
			log.debug("Delete reaction: %s", reaction.$id );
			await this.$openstate.delete( reactionpath );
		    }
		    else {
			mutable.subject_ids[0]	= [ review.$id, review.$action ];
			mutable.reaction_type	= reaction_type;

			log.debug("Create/update reaction: %s", reactionpath );
			await this.$openstate.write( reactionpath );
		    }

		    await this.$openstate.read(`agent/me/reactions`);

		    this.updateReactionSummaryReport( review );
		},
		async updateReactionSummaryReport ( review ) {
		    const summarypath		= `subject/${review.$id}/reaction/summary`;

		    if ( review.reaction_summary )
			await this.$openstate.get( `reaction/summary/${review.reaction_summary}` );
		    else {
			const mutable		= this.$openstate.mutable[ summarypath ];
			mutable.subject_action	= review.$action;
		    }

		    await this.$openstate.write( summarypath );
		},

		editReview () {
		    this.reviewModal.show();
		},
		updateReviewRating ( rating_type, value ) {
		    if ( value === undefined )
			delete this.review_input.ratings[rating_type];
		    else
			this.review_input.ratings[rating_type] = value;
		},
		starClass ( rating_type, i ) {
		    return {
			"bi-star-fill":	i <= this.review_input.ratings[ rating_type ],
			"bi-star":	i >  this.review_input.ratings[ rating_type ],
		    };
		},
		async resetReviewEdit () {
		    this.$openstate.resetMutable( this.reviewinputpath );
		    // delete this.$openstate.mutable[  ];

		    await this.$openstate.get( this.versionpath );
		    await this.$openstate.get( this.zomepath );

		    this.review_input$.subject_ids.push(
			[ this.version.$id,	this.version.$action ],
			[ this.zome.$id,	this.zome.$action ],
		    );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/zomes/versions/update.html"),
	    "data": function() {
		return {
		    "id": null,
		    "zome_id": null,
		    "error": null,
		    "_version": null,
		    "input": {},
		    "validated": false,
		    "changelog_html": null,
		    "show_changelog_preview": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},

		version () {
		    if ( this.$store.getters.zome_version( this.id ) ) {
			this._version		= this.copy( this.$store.getters.zome_version( this.id ) );
			this._version.metadata	= this.copy( this._version.metadata );
		    }

		    return this._version;
		},
		$version () {
		    return this.$store.getters.$zome_version( this.id );
		},

		zome () {
		    return this.$store.getters.zome( this.version.for_zome );
		},
		$zome () {
		    return this.$store.getters.$zome( this.version ? this.version.for_zome : null );
		},

		$sc_url_preview () {
		    return this.$store.getters.$url( this.version ? this.version.source_code_commit_url : null );
		},

		preview_toggle_text () {
		    return this.show_changelog_preview ? "editor" : "preview";
		}
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.zome_id		= this.getPathId("zome");

		if ( !this.version )
		    await this.fetchVersion();
	    },
	    "methods": {
		toggleChangelogPreview () {
		    this.show_changelog_preview = !this.show_changelog_preview;
		    this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.changelog_html	= md_converter.makeHtml( this.version.changelog );
		},
		async createSourceCodeUrlPreview ( url ) {
		    if ( !url ) {
			this.input.metadata	= Object.assign( {}, this.version.metadata );

			delete this.version.metadata.source_code_url_preview;
			delete this.input.metadata.source_code_url_preview;

			return;
		    }

		    const url_info	= await this.$store.dispatch("getUrlPreview", url );

		    this.input.metadata		= Object.assign( {}, this.version.metadata, {
			"source_code_url_preview": {
			    "title":		url_info.title,
			    "description":	url_info.description,
			    "image":		url_info.image,
			},
		    });
		    log.debug("Updated preview metadata:", this.input );

		    return url_info;
		},
		async fetchVersion () {
		    try {
			await this.$store.dispatch("fetchZomeVersion", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome version (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateZomeVersion", [ this.id, this.input ] );

			this.$store.dispatch("fetchVersionsForZome", this.zome_id );
			this.$router.push( `/zomes/${this.zome_id}/versions/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update Zome Version (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    return {
	create,
	update,
	single,
    };
};
