const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dna versions");

const { load_html,
	...common }			= require('./common.js');

const md_converter			= new showdown.Converter({
    "headerLevelStart": 3,
});


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await load_html("/templates/dnas/versions/create.html"),
	    "data": function() {
		return {
		    "dna_id": null,
		    "error": null,
		    "input": {
			"version": null,
			"changelog": null,
			"hdk_version": null,
			"zomes": [],
		    },
		    "added_zomes": [],
		    "zome_search_text": "",
		    "validated": false,
		    "saving": false,
		    "lock_hdk_version_input": false,
		    "change_version_context": null,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		change_version_modal () {
		    return this.$refs["changeVersion"].modal;
		},

		compatible_zomes () {
		    return this.$store.getters.zomes( this.input.hdk_version || "all" );
		},
		$compatible_zomes () {
		    return this.$store.getters.$zomes( this.input.hdk_version || "all" );
		},

		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.$hdk_versions;
		},

		alternative_versions () {
		    if ( !this.change_version_context )
			return [];
		    return this.$store.getters.zome_versions( this.change_version_context[1].$id );
		},
		$alternative_versions () {
		    return this.$store.getters.$zome_versions( this.change_version_context ? this.change_version_context[1].$id : "" );
		},

		filtered_zomes () {
		    return this.compatible_zomes.filter( zome => {
			return zome.name.toLowerCase()
			    .includes( this.zome_search_text.toLowerCase() )
			    && !this.added_zomes.find( z => z.$id === zome.$id );
		    });
		},
		zome_card_actions () {
		    return ( index ) => {
			return [
			    this.changeZomeVersionAction( index ),
			    this.removeZomeAction( index ),
			];
		    };
		},
	    },
	    async created () {
		this.dna_id		= this.getPathId("dna");

		this.$store.dispatch("fetchHDKVersions");

		const latest_dna_version	= await this.$store.dispatch("getLatestVersionForDna", [ this.dna_id, null ] );

		if ( !this.input.version )
		    this.input.version		= latest_dna_version ? latest_dna_version.version + 1 : 1;
	    },
	    "methods": {
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			const version	= await this.$store.dispatch("createDnaVersion", [ this.dna_id, this.input ] );

			this.$store.dispatch("fetchVersionsForDna", this.dna_id );
			this.$router.push( `/dnas/${this.dna_id}/versions/${version.$id}` );
		    } catch ( err ) {
			log.error("Failed to create DNA Version:", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},

		selectNewVersion ( version ) {
		    const [ index, zome ]		= this.change_version_context;

		    this.input.zomes[index].version		= version.$id;
		    this.input.zomes[index].resource		= version.mere_memory_addr;
		    this.input.zomes[index].resource_hash	= version.mere_memory_hash;

		    this.change_version_context			= null;
		    this.change_version_modal.hide();
		},
		changeZomeVersionAction ( index ) {
		    const zome			= this.added_zomes[ index ];
		    const versions		= this.$store.getters.zome_versions( zome.$id )
			  .filter( version => version.hdk_version === this.input.hdk_version );

		    return {
			"hide": versions.length < 2,
			"title": "Select a different version",
			"icon": "layers-half",
			"method": () => {
			    const zome				= this.added_zomes[index];
			    this.change_version_context		= [ index, zome ];
			    this.change_version_modal.show();
			},
		    };
		},
		removeZomeAction ( i ) {
		    return {
			"icon": "x-lg",
			"title": "Remove Zome Version",
			"method": () => {
			    this.removeZome( i );
			},
		    };
		},
		addZomeAction ( zome ) {
		    return {
			"icon": "plus-lg",
			"title": "Add Zome",
			"method": () => {
			    this.addZome( zome );
			},
		    };
		},

		removeZome ( i ) {
		    this.added_zomes.splice( i, 1 );
		    this.input.zomes.splice( i, 1 );

		    if ( this.added_zomes.length === 0 )
			this.lock_hdk_version_input = false;
		},
		async addZome ( zome ) {
		    log.normal("Adding zome:", zome );
		    if ( zome === undefined )
			return;

		    log.info("Reset search");
		    this.zome_search_text = "";

		    if ( this.added_zomes.find( z => z.$id === zome.$id ) )
			return;

		    // Get latest version for a specific HDK Version
		    const latest_version	= await this.$store.dispatch("getLatestVersionForZome", [ zome.$id, this.input.hdk_version ] );

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= latest_version.hdk_version;
		    }

		    this.lock_hdk_version_input		= true;

		    this.added_zomes.push( zome );
		    this.input.zomes.push({
			"name":		zome.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			"zome":		zome.$id,
			"version":	latest_version.$id,
			"resource":	latest_version.mere_memory_addr,
			"resource_hash":latest_version.mere_memory_hash,
		    });
		},
		zomeIsAdded ( zome_id ) {
		    return !!this.added_zomes.find( z => z.$id === zome_id );
		},
		selectHDKVersion ( hdk_version ) {
		    this.input.hdk_version		= hdk_version || null;

		    if ( this.compatible_zomes.length === 0 ) {
			if ( hdk_version )
			    this.$store.dispatch("fetchZomesWithHDKVersion", hdk_version );
			else
			    this.$store.dispatch("fetchAllZomes");
		    }
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await load_html("/templates/dnas/versions/update.html"),
	    "data": function() {
		return {
		    "id": null,
		    "dna_id": null,
		    "error": null,
		    "_version": null,
		    "input": {},
		    "validated": false,
		    "changelog_html": null,
		    "show_changelog_preview": false,
		};
	    },
	    "computed": {
		version () {
		    if ( this._version === null && this.$store.getters.dna_version( this.id ) )
			this._version	= this.copy( this.$store.getters.dna_version( this.id ) );

		    return this._version;
		},
		$version () {
		    return this.$store.getters.$dna_version( this.id );
		},

		dna () {
		    return this.version ? this.version.for_dna : null;
		},
		$dna () {
		    return this.$version;
		},

		form () {
		    return this.$refs["form"];
		},
		preview_toggle_text () {
		    return this.show_changelog_preview ? "editor" : "preview";
		}
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.dna_id		= this.getPathId("dna");

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
		async fetchVersion () {
		    try {
			await this.$store.dispatch("fetchDnaVersion", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get dna version (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateDnaVersion", [ this.id, this.input ] );

			this.$router.push( `/dnas/${this.dna_id}/versions/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update DNA Version (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await load_html("/templates/dnas/versions/single.html"),
	    "data": function() {
		return {
		    "id": null,
		    "dna_id": null,
		    "changelog_html": null,
		    "download_error": null,
		};
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.dna_id		= this.getPathId("dna");

		this.refresh();
	    },
	    "computed": {
		version () {
		    return this.$store.getters.dna_version( this.id );
		},
		$version () {
		    return this.$store.getters.$dna_version( this.id );
		},

		dna () {
		    if ( !this.version )
			return null;

		    return this.$store.getters.dna( this.version.for_dna.$id || this.version.for_dna );
		},
		$dna () {
		    return this.$version;
		},

		$packageBytes () {
		    return this.$store.getters.$dna_version_package( this.version ? this.version.$id : null );
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		package_filename () {
		    if ( !this.dna )
			return "DNA Package";

		    const filename	= this.dna.name.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_v${this.version.version}.dna`;
		},
		dna_deprecated () {
		    return !!( this.dna && this.dna.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.version )
			this.fetchVersion();
		    else
			this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.changelog_html	= md_converter.makeHtml( this.version.changelog );
		},
		async fetchVersion () {
		    try {
			let version	= await this.$store.dispatch("fetchDnaVersion", this.id );

			this.updateChangelogMarkdown();
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get dna version (%s): %s", String(this.id), err.message, err );
		    }
		},
		async downloadPackageBytes () {
		    try {
			const dna_package	= await this.$store.dispatch("fetchDnaVersionPackage", this.version.$id );

			this.download( this.package_filename, dna_package.bytes );
		    } catch (err) {
			this.download_error	= err;
			log.error("Failed to get package bytes for dna version(%s): %s", String(this.id), err.message, err );
		    }
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishDnaVersion", this.id );

		    this.modal.hide();

		    this.$store.dispatch("fetchVersionsForDna", this.dna_id );
		    this.$router.push( `/dnas/${this.dna_id}` );
		},
	    },
	};
    };

    async function upload () {
	return {
	    "template": await load_html("/templates/dnas/versions/upload.html"),
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {
			"version": 1,
			"changelog": "",
			"hdk_version": null,
			"properties": null,
		    },
		    "initial_step": this.$route.params.step,
		    "validated": false,
		    "saving": false,
		    "latest_version": null,
		    "steps": [
			"Upload DNA bundle",
			"Create zomes",
			"Details",
			"Review",
		    ],
		    "file_id": "uploaded_dna_bundle",
		    "lock_hdk_version_input": false,
		    "zome_selection_confirmed": false,
		    "ready_for_review": false,
		    "select_version_context": null,
		    "select_zome_context": null,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		form_extras () {
		    return this.$refs["form_extras"];
		},
		zome_form () {
		    return ( name ) => {
			const refs		= this.$refs["form_" + name];
			return refs && refs[0];
		    };
		},
		select_version_modal () {
		    return this.$refs["selectZomeVersion"].modal;
		},
		select_zome_modal () {
		    return this.$refs["selectZome"].modal;
		},

		step () {
		    if ( this.ready_for_review === true )
			return 3
		    else if ( this.zome_selection_confirmed === true )
			return 2
		    else if ( this.bundle )
			return 1;
		    else
			return this.initial_step || 0;
		},

		dna () {
		    return this.$store.getters.dna( this.id );
		},
		$dna () {
		    return this.$store.getters.$dna( this.id );
		},

		versions () {
		    return this.$store.getters.dna_versions( this.id );
		},
		$versions () {
		    return this.$store.getters.$dna_versions( this.id );
		},

		dna_version () {
		    if ( this.latest_version )
			return this.$store.getters.dna_version( this.latest_version.$id );
		},
		$dna_version () {
		    if ( this.latest_version )
			return this.$store.getters.$dna_version( this.latest_version.$id );
		    else
			return this.$store.getters.$dna_version("");
		},

		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.$hdk_versions;
		},

		uploaded_file () {
		    return this.$store.getters.file( this.file_id );
		},
		$uploaded_file () {
		    return this.$store.getters.$file( this.file_id );
		},

		zomes () {
		    return ( name ) => {
			return this.$store.getters.zomes_by_name( name );
		    };
		},
		$zomes () {
		    return ( name ) => {
			return this.$store.getters.$zomes_by_name( name );
		    };
		},

		versions_for_zome () {
		    return ( zome_id ) => {
			return this.$store.getters.zome_versions( zome_id );
		    };
		},
		$versions_for_zome () {
		    return ( zome_id ) => {
			return this.$store.getters.$zome_versions( zome_id );
		    };
		},
		zome_versions () {
		    return ( hash ) => {
			return this.$store.getters.zome_versions_by_hash( hash )
			    .filter( version => {
				if ( !this.input.hdk_version )
				    return true;
				return version.hdk_version === this.input.hdk_version;
			    });
		    };
		},
		$zome_versions () {
		    return ( hash ) => {
			return this.$store.getters.$zome_versions_by_hash( hash );
		    };
		},

		bundle () {
		    if ( !this.uploaded_file )
			return null;

		    return this.$store.getters.bundle( this.uploaded_file.hash );
		},
		$bundle () {
		    return this.$store.getters.$bundle( this.uploaded_file ? this.uploaded_file.hash : null );
		},

		file_valid_feedback () {
		    const file		= this.uploaded_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		this.refresh();

		this.$store.dispatch("fetchHDKVersions");
	    },
	    "methods": {
		async refresh () {
		    if ( !this.dna )
			this.fetchDna();

		    this.latest_version		= await this.$store.dispatch("getLatestVersionForDna", [ this.id, null ] );

		    if ( !this.latest_version ) {
			log.warn("There are no versions for this DNA: %s", String(this.id) );
			return;
		    }

		    log.normal("Prepping last version (%s) for comparison", String(this.latest_version.$id) );
		    // Since there are version(s) for this DNA, we need to fetch the latest one to
		    // compare the differences when a bundle is uploaded.
		    await this.$store.dispatch("fetchDnaVersion", this.latest_version.$id );
		    log.info("Latest DNA version:", this.dna_version );

		    // We will use the last version name as the default value for the next version.
		    this.input.version		= this.dna_version.version + 1;
		},
		async fetchDna () {
		    log.normal("Fetching dna: %s", String(this.id) );
		    try {
			await this.$store.dispatch("fetchDna", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get DNA (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchDnaVersions () {
		    log.normal("Fetching DNA versions for DNA: %s", String(this.id) );
		    try {
			await this.$store.dispatch("fetchVersionsForDna", this.id );
			log.debug("Versions for this DNA:", this.versions );

			if ( this.versions.length === 0 )
			    return;

			this.latest_version	= this.versions.reduce( (acc, version, i) => {
			    if ( acc === null )
				return version;

			    if ( version.published_at > acc.published_at )
				return version;

			    return acc;
			}, null );

			Promise.all(
			    this.latest_version.zomes.map( async (entryhash, i) => {
				// this.latest_version.zomes[i]	= await this.$store.dispatch("fetchZomeVersion", entryhash );
			    })
			);

			log.trace("Version with latest published_at:", this.latest_version );
		    } catch (err) {
			log.error("Failed to get versions for DNA (%s): %s", String(this.id), err.message, err );
		    }
		},

		reset_file () {
		    if ( this.bundle.zomes ) {
			for ( let zome of this.bundle.zomes ) {
			    zome.saving			= false;
			    zome.validated		= false;
			    zome.selected_zome		= null;
			    zome.selected_zome_version	= null;
			}
		    }

		    this.input.changelog		= "";
		    this.input.hdk_version		= null;
		    this.input.properties		= null;

		    this.validated			= false;
		    this.lock_hdk_version_input		= false;
		    this.zome_selection_confirmed	= false;
		    this.ready_for_review		= false;
		    this.select_version_context		= null;
		    this.select_zome_context		= null;

		    this.$store.dispatch("removeValue", [ "file", this.uploaded_file.hash ] );
		    this.$store.dispatch("removeValue", [ "file", this.file_id ] );
		},
		missing_zome_version ( dna ) {
		    for ( let zome_sources of Object.values( dna.zomes ) ) {
			if ( !zome_sources.upload.zome_version_id )
			    return true;
		    }
		    return false;
		},

		async file_selected ( event ) {
		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			return;
		    }

		    await this.$store.dispatch("uploadFile", [ this.file_id, file ] );
		    await this.$store.dispatch("unpackBundle", this.uploaded_file.hash );

		    if ( this.bundle.type !== "dna" ) {
			alert(`Uploaded bundle is not a DNA bundle. found bundle type '${this.bundle.type}'`);
			return this.reset_file();
		    }

		    if ( this.bundle.properties )
			this.input.properties	= Object.assign( {}, this.bundle.properties );

		    this.bundle.zomes.forEach( async zome => {
			zome.version		= 1;

			// Search for existing zomes with the same name
			this.$store.dispatch("fetchZomesByName", zome.name );
			this.$store.dispatch("fetchZomeVersionsByHash", zome.hash );
		    });
		},

		prompt_select_zome_version ( zome_ref ) {
		    this.select_version_context		= zome_ref;

		    this.select_version_modal.show();
		},
		prompt_select_zome ( zome_ref ) {
		    this.select_zome_context		= zome_ref;

		    this.select_zome_modal.show();
		},

		unselectAction ( zome_ref ) {
		    return {
			"icon": "x-lg",
			"title": "Undo selected version",
			"method": () => {
			    this.unselect_zome_version( zome_ref );
			},
		    };
		},
		async select_zome_version ( upload, version ) {
		    log.normal("Select zome version for '%s':", upload.name, version );

		    upload.selected_zome_version = version;

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= version.hdk_version;
		    }

		    this.lock_hdk_version_input		= true;
		    this.select_version_context		= null;
		    this.select_version_modal.hide();
		},
		async unselect_zome_version ( upload ) {
		    log.normal("Unselect zome version for '%s'", upload.name );

		    delete upload.selected_zome_version;

		    let empty				= true;
		    for ( let zome of this.bundle.zomes ) {
			if ( zome.selected_zome_version )
			    empty			= false;
		    }
		    if ( empty )
			this.lock_hdk_version_input	= false;

		    if ( upload.selected_zome ) {
			const version		= await this.$store.dispatch("getLatestVersionForZome", [ upload.selected_zome.$id, null ]  );
			upload.version		= version ? version.version + 1 : 1;
		    }
		},

		async assign_parent_zome_for ( upload, zome ) {
		    log.normal("Assign parent zome for '%s':", upload.name, zome );

		    upload.selected_zome	= zome;
		    this.select_zome_context	= null;
		    this.select_zome_modal.hide();

		    const version		= await this.$store.dispatch("getLatestVersionForZome", [ zome.$id, null ]  );
		    upload.version		= version ? version.version + 1 : 1;
		},
		async unassign_parent_zome_for ( upload ) {
		    log.normal("Unassign parent zome for '%s'", upload.name );

		    upload.version		= 1;

		    delete upload.selected_zome;
		},

		async readyForReview () {
		    this.validated		= true;

		    if ( this.missingZomes() )
			return;

		    this.ready_for_review	= true;
		},

		async create_zome_version ( zome_info ) {
		    this.validated		= true;
		    zome_info.validated		= true;

		    console.log( this.form_extras.checkValidity(), this.form );
		    if ( this.form_extras.checkValidity() === false )
			return;

		    const form			= this.zome_form( zome_info.name );

		    if ( !form || form.checkValidity() === false )
			return;

		    zome_info.saving		= true;

		    try {
			// If there are none, create one
			if ( !zome_info.selected_zome ) {
			    zome_info.selected_zome	= await this.$client.call(
				"dnarepo", "dna_library", "create_zome", {
				    "name": zome_info.name,
				    "description": zome_info.description,
				}
			    );
			    this.$store.dispatch("fetchZomesByName", zome_info.name );
			}

			this.lock_hdk_version_input	= true;
			// Create the new version
			const version			= await this.$client.call(
			    "dnarepo", "dna_library", "create_zome_version", {
				"for_zome": zome_info.selected_zome.$id,
				"version": zome_info.version,
				"zome_bytes": zome_info.bytes,
				"hdk_version": this.input.hdk_version,
			    }
			);
			this.$store.dispatch("fetchZomeVersionsByHash", zome_info.hash );
			this.$store.dispatch("fetchVersionsForZome", zome_info.selected_zome.$id );

			zome_info.description		= "";

			zome_info.selected_zome_version = version;
		    } catch (err) {
			this.lock_hdk_version_input	= false;
			throw err;
		    } finally {
			zome_info.saving		= false;
		    }
		},

		async create () {
		    this.saving			= true;

		    try {
			log.normal("Creating DNA version: %s", this.input.version );

			log.debug("Create DNA version #%s: (%s zomes):", this.input.version, this.bundle.zomes.length, this.input );
			const input			= {
			    "version": this.input.version,
			    "hdk_version": this.input.hdk_version,
			    "properties": this.input.properties,
			    "changelog": this.input.changelog,
			    "zomes": this.bundle.zomes.map( info => {
				const zome		= info.selected_zome;
				const version		= info.selected_zome_version;
				return {
				    "name":		info.name,
				    "zome":		version.for_zome.$id || version.for_zome,
				    "version":		version.$id,
				    "resource":		version.mere_memory_addr,
				    "resource_hash":	version.mere_memory_hash,
				};
			    }),
			};

			const version		= await this.$store.dispatch("createDnaVersion", [ this.id, input ] );

			this.reset_file();

			this.$store.dispatch("fetchVersionsForDna", this.id );
			this.$router.push( `/dnas/${this.id}/versions/${version.$id}` );
		    } catch (err) {
			this.error		= err;
		    } finally {
			this.saving		= false;
		    }
		},

		selectHDKVersion ( hdk_version ) {
		    this.input.hdk_version	= hdk_version === "" ? null : hdk_version;
		},

		hdkVersionMatches ( version ) {
		    if ( !this.input.hdk_version )
			return true;

		    return version.hdk_version === this.input.hdk_version;
		},

		missingZomes () {
		    if ( !this.bundle )
			return false;

		    for ( let zome of this.bundle.zomes ) {
			if ( !zome.selected_zome_version )
			    return true;
		    }

		    return false;
		},
	    },
	};
    };

    return {
	create,
	update,
	single,
	upload,
    };
};
