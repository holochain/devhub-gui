const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happ releases");

const showdown				= require('showdown');
const md_converter			= new showdown.Converter({
    "headerLevelStart": 3,
});


function array_move ( arr, from_index, to_index ) {
    if ( arr[from_index] === undefined )
	throw new Error(`Cannot move undefined index (${from_index}); array has ${arr.length} items`);

    if ( arr[to_index-1] === undefined )
	throw new Error(`Cannot move to destination index (${from_index}) because array length is ${arr.length}`);

    return arr.splice( to_index, 0, arr.splice( from_index, 1 )[0] );
}

module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": (await import("./templates/happs/releases/create.html")).default,
	    "data": function() {
		return {
		    "happ_id": null,
		    "error": null,
		    "input": {
			// "name": null,
			// "description": null,
			"gui": null,
			"manifest": {
			    "manifest_version": "1",
			    "roles": null,
			},
			"hdk_version": null,
			"dnas": [],
		    },
		    "added_dnas": [],
		    "dna_versions": {},
		    "all_dna_versions": {},
		    "dna_search_text": "",
		    "validated": false,
		    "saving": false,
		    "show_search_list": false,
		    "gui_file": null,
		    "gui_bytes": null,
		};
	    },
	    "computed": {
		happ () {
		    return this.$store.getters.happ( this.happ_id ).entity;
		},
		$happ () {
		    return this.$store.getters.happ( this.happ_id ).metadata;
		},
		dnas () {
		    return this.$store.getters.dnas().collection;
		},
		$dnas () {
		    return this.$store.getters.dnas().metadata;
		},
		form () {
		    return this.$refs["form"];
		},
		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions.collection;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.hdk_versions.metadata;
		},
		filtered_dnas () {
		    return this.dnas.filter( dna => {
			return dna.name.toLowerCase()
			    .includes( this.dna_search_text.toLowerCase() )
			    && !this.added_dnas.find( z => z.$id === dna.$id );
		    });
		},
		file_valid_feedback () {
		    const file		= this.gui_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.happ_id		= this.getPathId("happ");

		if ( !this.release )
		    await this.fetchHapp();

		if ( this.dnas.length === 0 )
		    this.fetchDnas();

		this.fetchHDKVersions();
	    },
	    "methods": {
		async fetchHapp () {
		    try {
			await this.$store.dispatch("fetchHapp", this.happ_id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchDnas () {
		    try {
			await this.$store.dispatch("fetchDnas", { "agent": "me" });

			this.dnas.forEach( dna => {
			    this.dna_versions[dna.$id] = null;
			})
		    } catch (err) {
			log.error("Failed to get dnas: %s", err.message, err );
		    }
		},
		async fetchDnaVersions ( dna_id ) {
		    try {
			const dna_versions	= await this.$store.dispatch("fetchVersionsForDna", dna_id );
			this.dna_versions[dna_id] = dna_versions;
			dna_versions.forEach( v => {
			    v.for_dna				= dna_id;
			    this.all_dna_versions[v.$id]	= v;
			});
		    } catch (err) {
			log.error("Failed to get versions for dna (%s): %s", String(dna_id), err.message, err );
		    }
		},
		async create () {
		    log.info("Form was submitted");
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			const input				= Object.assign({}, this.input );

			if ( this.gui_bytes ) {
			    const web_asset			= await this.$store.dispatch("createWebAsset", this.gui_bytes );

			    input.gui		= {
				"asset_group_id": web_asset.$id,
				"uses_web_sdk": false,
			    };
			}

			input.manifest				= Object.assign({}, input.manifest );
			input.manifest.name			= this.happ.title;
			input.manifest.description		= this.happ.description;
			input.manifest.roles			= [];
			input.dnas.forEach( (dna, i) => {
			    const dna_version			= this.all_dna_versions[dna.version];

			    input.dnas[i]			= Object.assign({}, input.dnas[i] );
			    input.dnas[i].dna			= dna_version.for_dna;
			    input.dnas[i].wasm_hash		= dna_version.wasm_hash;
			    input.manifest.roles.push({
				"id":		dna.role_id,
				"dna": {
				    "path":	`./${dna.name}.dna`,
				    "clone_limit": 0,
				},
				"provisioning": {
				    "strategy": "create",
				    "deferred": false,
				},
			    });
			});

			const release	= await this.$store.dispatch("createHappRelease", [ this.happ_id, input ] );

			this.$store.dispatch("fetchReleasesForHapp", this.happ_id );
			this.$router.push( `/happs/${this.happ_id}/releases/${release.$id}` );
		    } catch ( err ) {
			log.error("Failed to create hApp Release:", err, err.data );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
		removeDna ( i ) {
		    this.added_dnas.splice( i, 1 );
		    this.input.dnas.splice( i, 1 );
		},
		addDna ( dna ) {
		    log.debug("Adding DNA:", dna );
		    if ( dna === undefined )
			return;

		    this.dna_search_text = "";

		    if ( this.added_dnas.find( z => z.$id === dna.$id ) )
			return;

		    this.fetchDnaVersions ( dna.$id );
		    this.added_dnas.push( dna );
		    this.input.dnas.push({
			"role_id": dna.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			"dna": null,
			"version": null,
			"wasm_hash": null,
		    });
		},
		dragstartDna ( event, index ) {
		    event.dataTransfer.setData("dna/index", index );
		},
		dragoverDna ( event ) {
		    event.preventDefault();
		},
		dropDna ( event, to_index ) {
		    event.preventDefault();

		    const from_index	= event.dataTransfer.getData("dna/index");
		    log.info("Moving index %s => %s", from_index, to_index );

		    array_move( this.added_dnas, from_index, to_index );
		    array_move( this.input.dnas, from_index, to_index );
		},
		async fetchHDKVersions () {
		    await this.$store.dispatch("fetchHDKVersions");
		},
		selectHDKVersion ( hdk_version ) {
		    this.input.hdk_version		= hdk_version;
		},
		hideResults () {
		    setTimeout( () => {
			this.show_search_list		= false;
		    }, 100 );
		},
		async file_selected ( event ) {
		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			this.gui_bytes		= null;
			this.gui_file		= null;
			return;
		    }

		    this.gui_file		= file;
		    this.gui_bytes		= await this.load_file( file );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": (await import("./templates/happs/releases/update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "happ_id": null,
		    "error": null,
		    "_release": null,
		    "input": {},
		    "validated": false,
		};
	    },
	    "computed": {
		release () {
		    if ( this.$store.getters.happ_release( this.id ).entity )
			this._release	= this.copy( this.$store.getters.happ_release( this.id ).entity );

		    return this._release;
		},
		$release () {
		    return this.$store.getters.happ_release( this.id ).metadata;
		},
		happ () {
		    return this.release ? this.release.for_happ : null;
		},
		$happ () {
		    return this.$release;
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
		this.happ_id		= this.getPathId("happ");

		if ( !this.release )
		    await this.fetchRelease();
	    },
	    "methods": {
		toggleChangelogPreview () {
		    this.show_changelog_preview = !this.show_changelog_preview;
		    this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.changelog_html	= md_converter.makeHtml( this.release.changelog );
		},
		async fetchRelease () {
		    try {
			await this.$store.dispatch("fetchHappRelease", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ release (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    try {
			await this.$store.dispatch("updateHappRelease", [ this.id, this.input ] );

			this.$router.push( `/happs/${this.happ_id}/releases/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update hApp Release (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": (await import("./templates/happs/releases/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "happ_id": null,
		    "changelog_html": null,
		    "download_error": null,
		    "download_webhapp_error": null,
		};
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.happ_id		= this.getPathId("happ");

		this.refresh();
	    },
	    "computed": {
		release () {
		    return this.$store.getters.happ_release( this.id ).entity;
		},
		$release () {
		    return this.$store.getters.happ_release( this.id ).metadata;
		},
		happ () {
		    return this.release ? this.release.for_happ : null;
		},
		$happ () {
		    return this.$release;
		},
		$packageBytes () {
		    return this.$store.getters.happ_release_package( this.release ? this.release.$id : null ).metadata;
		},
		$webhappPackageBytes () {
		    return this.$store.getters.happ_release_package( this.release ? this.release.$id + "-webhapp" : null ).metadata;
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		package_filename () {
		    if ( !this.happ )
			return "hApp Package";

		    const filename	= this.happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_${this.release.name}.happ`;
		},
		package_webhapp_filename () {
		    if ( !this.happ )
			return "hApp Package";

		    const filename	= this.happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_${this.release.name}.webhapp`;
		},
		happ_deprecated () {
		    return !!( this.happ && this.happ.deprecation );
		},
	    },
	    "methods": {
		refresh () {
		    if ( !this.release )
			this.fetchRelease();
		},
		async fetchRelease () {
		    try {
			let release	= await this.$store.dispatch("fetchHappRelease", this.id );

			release.dnas.forEach( (dna_ref) => {
			    // fetch DNA version
			});
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ release (%s): %s", String(this.id), err.message, err );
		    }
		},
		async downloadPackageBytes () {
		    try {
			const package_bytes	= await this.$store.dispatch("fetchHappReleasePackage", this.release.$id );

			this.download( this.package_filename, package_bytes );
		    } catch (err) {
			this.download_error	= err;
			log.error("Failed to get package bytes for happ release(%s):", String(this.id), err );
		    }
		},
		async downloadWebhappPackageBytes () {
		    try {
			const package_bytes	= await this.$store.dispatch("fetchWebhappReleasePackage", {
			    "name": this.happ.title,
			    "id": this.release.$id,
			});

			this.download( this.package_webhapp_filename, package_bytes );
		    } catch (err) {
			this.download_webhapp_error	= err;
			log.error("Failed to get webhapp package bytes for happ release(%s):", String(this.id), err );
		    }
		},
		async unpublish () {
		    await this.$store.dispatch("unpublishHappRelease", this.id );

		    this.modal.hide();

		    this.$store.dispatch("fetchReleasesForHapp", this.happ_id );
		    this.$router.push( `/happs/${this.happ_id}` );
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
