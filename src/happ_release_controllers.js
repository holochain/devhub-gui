const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happ releases");

const { HoloHashes }			= require('@holochain/devhub-entities');
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
			"name": null,
			"description": null,
			"manifest": {
			    "manifest_version": "1",
			    "slots": null,
			},
			"dnas": [],
		    },
		    "added_dnas": [],
		    "dna_versions": {},
		    "all_dna_versions": {},
		    "dna_search_text": null,
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		dnas () {
		    return this.$store.getters.dnas().collection;
		},
		$dnas () {
		    return this.$store.getters.dnas().metadata;
		},
		form () {
		    return this.$refs["form"];
		},
		filtered_dnas () {
		    if ( !this.dna_search_text || this.dna_search_text.length < 3 ) {
			return [];
		    }

		    return this.dnas.filter( dna => {
			return dna.name.toLowerCase()
			    .includes( this.dna_search_text.toLowerCase() )
			    && !this.added_dnas.find( z => z.$id === dna.$id );
		    });
		},
	    },
	    async created () {
		this.happ_id		= this.getPathId("happ");

		if ( this.dnas.length === 0 )
		    this.fetchDnas();
	    },
	    "methods": {
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
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			this.input.manifest.slots		= [];
			this.input.dnas.forEach( (dna, i) => {
			    const dna_version			= this.all_dna_versions[dna.version];

			    console.log( dna_version );
			    this.input.dnas[i].dna		= dna_version.for_dna;
			    this.input.dnas[i].wasm_hash	= dna_version.wasm_hash;
			    this.input.manifest.slots.push({
				"id":		dna.role_id,
				"dna": {
				    "path":	`./${dna.name}.dna`,
				    "clone_limit": 0,
				},
			    });
			});

			const release	= await this.$store.dispatch("createHappRelease", [ this.happ_id, this.input ] );

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
		modal () {
		    return this.$refs["modal"].modal;
		},
		package_filename () {
		    if ( !this.happ )
			return "hApp Package";

		    const filename	= this.happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_${this.release.name}.happ`;
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
			log.error("Failed to get package bytes for happ release(%s): %s", String(this.id), err.message, err );
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
