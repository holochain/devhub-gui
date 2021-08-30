const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dna versions");

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
	    "template": (await import("./templates/dnas/versions/create.html")).default,
	    "data": function() {
		return {
		    "dna_id": null,
		    "error": null,
		    "input": {
			"version": null,
			"changelog": null,
			"zomes": [],
		    },
		    "added_zomes": [],
		    "zome_versions": {},
		    "all_zome_versions": {},
		    "zome_search_text": null,
		    "validated": false,
		    "saving": false,
		};
	    },
	    "computed": {
		zomes () {
		    return this.$store.getters.zomes().collection;
		},
		$zomes () {
		    return this.$store.getters.zomes().metadata;
		},
		form () {
		    return this.$refs["form"];
		},
		filtered_zomes () {
		    if ( !this.zome_search_text || this.zome_search_text.length < 3 ) {
			return [];
		    }

		    return this.zomes.filter( zome => {
			return zome.name.toLowerCase()
			    .includes( this.zome_search_text.toLowerCase() )
			    && !this.added_zomes.find( z => z.$id === zome.$id );
		    });
		},
	    },
	    async created () {
		this.dna_id		= this.getPathId("dna");

		if ( this.zomes.length === 0 )
		    this.fetchZomes();
	    },
	    "methods": {
		async fetchZomes () {
		    try {
			await this.$store.dispatch("fetchZomes", { "agent": "me" });

			this.zomes.forEach( zome => {
			    this.zome_versions[zome.$id] = null;
			})
		    } catch (err) {
			log.error("Failed to get zomes: %s", err.message, err );
		    }
		},
		async fetchZomeVersions ( zome_id ) {
		    try {
			const zome_versions	= await this.$store.dispatch("fetchVersionsForZome", zome_id );
			this.zome_versions[zome_id] = zome_versions;
			zome_versions.forEach( v => {
			    v.for_zome				= zome_id;
			    this.all_zome_versions[v.$id]	= v;
			});
		    } catch (err) {
			log.error("Failed to get versions for zome (%s): %s", String(zome_id), err.message, err );
		    }
		},
		async create () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			this.input.zomes.forEach( (zome, i) => {
			    const zome_version			= this.all_zome_versions[zome.version];

			    this.input.zomes[i].zome		= zome_version.for_zome;
			    this.input.zomes[i].resource	= zome_version.mere_memory_addr;
			});

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
		removeZome ( i ) {
		    this.added_zomes.splice( i, 1 );
		    this.input.zomes.splice( i, 1 );
		},
		addZome ( zome ) {
		    if ( zome === undefined )
			return;

		    this.zome_search_text = "";

		    if ( this.added_zomes.find( z => z.$id === zome.$id ) )
			return;

		    this.fetchZomeVersions ( zome.$id );
		    this.added_zomes.push( zome );
		    this.input.zomes.push({
			"name": zome.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			"zome": null,
			"version": null,
			"resource": null,
		    });
		},
		dragstartZome ( event, index ) {
		    event.dataTransfer.setData("zome/index", index );
		},
		dragoverZome ( event ) {
		    event.preventDefault();
		},
		dropZome ( event, to_index ) {
		    event.preventDefault();

		    const from_index	= event.dataTransfer.getData("zome/index");
		    log.info("Moving index %s => %s", from_index, to_index );

		    array_move( this.added_zomes, from_index, to_index );
		    array_move( this.input.zomes, from_index, to_index );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": (await import("./templates/dnas/versions/update.html")).default,
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
		    if ( this.$store.getters.dna_version( this.id ).entity )
			this._version	= this.copy( this.$store.getters.dna_version( this.id ).entity );

		    return this._version;
		},
		$version () {
		    return this.$store.getters.dna_version( this.id ).metadata;
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
	    "template": (await import("./templates/dnas/versions/single.html")).default,
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
		    return this.$store.getters.dna_version( this.id ).entity;
		},
		$version () {
		    return this.$store.getters.dna_version( this.id ).metadata;
		},
		dna () {
		    return this.version ? this.version.for_dna : null;
		},
		$dna () {
		    return this.$version;
		},
		$packageBytes () {
		    return this.$store.getters.dna_version_package( this.version ? this.version.$id : null ).metadata;
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

    return {
	create,
	update,
	single,
    };
};
