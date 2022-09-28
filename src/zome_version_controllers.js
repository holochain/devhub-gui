const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zome versions");

const { load_html, http_info }		= require('./common.js');


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await load_html("/templates/zomes/versions/create.html"),
	    "data": function() {
		return {
		    "zome_id": null,
		    "error": null,
		    "input": {
			"version": null,
			"ordering": null,
			"changelog": null,
			"zome_bytes": null,
			"hdk_version": null,
			"source_code_commit_url": null,
			"metadata": {},
		    },
		    "zome_file": null,
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		zome () {
		    return this.$store.getters.zome( this.zome_id );
		},
		$zome () {
		    return this.$store.getters.$zome( this.zome_id );
		},

		file_valid_feedback () {
		    const file		= this.zome_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},

		$sc_url_preview () {
		    return this.$store.getters.$url( this.input.source_code_commit_url );
		},

		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.$hdk_versions;
		},
	    },
	    async created () {
		this.zome_id		= this.getPathId("zome");

		this.fetchHDKVersions();
		this.$store.dispatch("fetchZome", this.zome_id );

		const version		= await this.$store.dispatch("getLatestVersionForZome", [ this.zome_id, null ]  );
		this.input.ordering	= version ? version.ordering + 1 : 1;
	    },
	    "methods": {
		async file_selected ( event ) {
		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			this.input.zome_bytes	= null;
			this.zome_file		= null;
			return;
		    }

		    this.zome_file		= file;
		    this.input.zome_bytes	= await this.load_file( file );
		},
		async createSourceCodeUrlPreview ( url ) {
		    if ( !url ) {
			delete this.input.metadata.source_code_url_preview;
			return;
		    }

		    const url_info	= await this.$store.dispatch("getUrlPreview", url );

		    Object.assign( this.input.metadata, {
			"source_code_url_preview": {
			    "title":		url_info.title,
			    "description":	url_info.description,
			    "image":		url_info.image,
			},
		    });
		    log.debug("Updated preview metadata:", this.input );

		    return url_info;
		},
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			const version	= await this.$store.dispatch("createZomeVersion", [ this.zome_id, this.input ] );

			this.$store.dispatch("fetchVersionsForZome", this.zome_id );
			this.$router.push( `/zomes/${this.zome_id}/versions/${version.$id}` );
		    } catch ( err ) {
			log.error("Failed to create Zome Version:", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
		async fetchHDKVersions () {
		    await this.$store.dispatch("fetchHDKVersions");
		},
		selectHDKVersion ( hdk_version ) {
		    this.input.hdk_version	= hdk_version;
		}
	    },
	};
    };

    async function update () {
	return {
	    "template": await load_html("/templates/zomes/versions/update.html"),
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

    async function single () {
	return {
	    "template": await load_html("/templates/zomes/versions/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const zome_id		= this.getPathId("zome");

		return {
		    id,
		    zome_id,
		    "my_review": null,

		    "zomepath":			`zome/${zome_id}`,
		    "versionpath":		`zome/version/${id}`,
		    "versionreviewspath":	`zome/version/${id}/reviews`,
		    "reviewinputpath":		`review/${Math.random()}`,

		    "calculating": false,
		    "review_summary_error": null,
		};
	    },
	    async created () {
		const zome_p		= this.$modwc.get( this.zomepath );

		if ( !this.version )
		    await this.fetchVersion();

		await Promise.all([
		    zome_p,
		    this.version.review_summary ? this.$modwc.get( this.summarypath ) : Promise.resolve(),
		    this.$modwc.get( this.versionreviewspath ),
		]);

		if ( this.myReviewMap[ this.id ] ) {
		    this.my_review		= this.myReviewMap[ this.id ];

		    this.reviewinputpath	= `review/${this.my_review.$id}`;
		} else {
		    this.resetReviewEdit();
		}
	    },
	    "computed": {
		form_review () {
		    return this.$refs["form_review"];
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		reviewModal () {
		    return this.$refs["review"].modal;
		},

		version () {
		    return this.$modwc.state[ this.versionpath ];
		},
		$version () {
		    return this.$modwc.metastate[ this.versionpath ];
		},

		zome () {
		    return this.$modwc.state[ this.zomepath ];
		},
		$zome () {
		    return this.$modwc.metastate[ this.zomepath ];
		},

		summarypath () {
		    return this.$version.present && this.version.review_summary
			? `zome/version/review/summary/${this.version.review_summary}`
			: this.$modwc.DEADEND;
		},
		summary () {
		    return this.$modwc.state[ this.summarypath ];
		},
		$summary () {
		    return this.$modwc.metastate[ this.summarypath ];
		},

		review_input () {
		    return this.$modwc.mutable[ this.reviewinputpath ];
		},
		$review_input () {
		    return this.$modwc.metastate[ this.reviewinputpath ];
		},
		$review_errors () {
		    return this.$modwc.errors[ this.reviewinputpath ];
		},

		reviews () {
		    return this.$modwc.state[ this.versionreviewspath ] || [];
		},
		$reviews () {
		    return this.$modwc.metastate[ this.versionreviewspath ];
		},

		reactions () {
		    return this.$store.getters.reactions_by_subject;
		},
		$reactions () {
		    return this.$store.getters.$reactions;
		},

		$reviewMap () {
		    return id => {
			return this.$modwc.metastate[`review/${id}`];
		    };
		},

		$wasmBytes () {
		    return this.$store.getters.$zome_version_wasm( this.version ? this.version.mere_memory_addr : null );
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
		    this.$modwc.read( this.zomepath );
		    await this.fetchVersion();
		    this.$modwc.read( this.versionreviewspath );

		    if ( this.version.review_summary )
			this.$modwc.read( this.summarypath );

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
		async fetchVersion () {
		    try {
			await this.$modwc.read( this.versionpath );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get zome version (%s): %s", String(this.id), err.message, err );
		    }
		},
		async downloadWasmBytes () {
		    try {
			const wasm_bytes	= await this.$store.dispatch("fetchZomeVersionWasm", this.version.mere_memory_addr );

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
		    this.review_input.validated	= true;

		    if ( this.form_review.checkValidity() === false )
			return;

		    if ( this.$review_input.invalid )
			return;

		    await this.$modwc.write( this.reviewinputpath );

		    this.reviewinputpath	= `review/${this.$modwc.state[ this.reviewinputpath ].$id}`;

		    this.reviewModal.hide();

		    await this.$modwc.read( this.versionreviewspath );

		    // if ( this.reviews.length > 1 )
		    // 	this.updateReviewSummaryReport();
		},
		async updateReviewSummaryReport ( show_error = false ) {
		    this.calculating		= true;
		    try {
			await this.$store.dispatch("updateZomeVersionReviewSummary", this.id );
		    } catch (err)  {
			if ( show_error )
			    this.review_summary_error = err;
		    } finally {
			this.calculating	= false;
		    }

		    await this.$store.dispatch("fetchReviewSummary", this.version.review_summary );
		},

		async doReaction ( review, reaction_type ) {
		    log.normal("Do reaction for review: %s", review.$id, reaction_type );
		    const has_reaction		= this.hasReactionForSubject( review.$id );

		    if ( has_reaction === false ) {
			log.debug("create reaction:", review, reaction_type );
			await this.$store.dispatch("createReaction", [ review, reaction_type ] );
		    }
		    else {
			const reaction		= this.$root.reactionsMap[ review.$id ];

			if ( !reaction.deleted && reaction.reaction_type === reaction_type ) {
			    log.debug("delete reaction: %s", reaction.$id );
			    await this.$store.dispatch("deleteReaction", reaction.$id );

			    log.debug( this.hasReactionForSubject( review.$id ) )
			}
			else {
			    log.debug("update reaction: %s", reaction.$id, reaction_type );
			    await this.$store.dispatch("updateReaction", [ reaction.$id, { reaction_type }]);
			}
		    }

		    this.updateReactionSummaryReport( review );
		},
		async updateReactionSummaryReport ( review ) {
		    await this.$store.dispatch("updateReviewReactionSummary", review.$id );
		    // await this.updateReviewSummaryReport();
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
		resetReviewEdit () {
		    delete this.$modwc.mutable[ this.reviewinputpath ];

		    this.review_input.subject_ids.push(
			[ this.version.$id,	this.version.$action ],
			[ this.zome.$id,	this.zome.$action ],
		    );
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
