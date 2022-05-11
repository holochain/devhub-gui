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
		    "zome_versions": {},
		    "all_zome_versions": {},
		    "zome_search_text": "",
		    "validated": false,
		    "saving": false,
		    "show_search_list": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},

		zomes () {
		    return this.$store.getters.zomes( "all" );
		},
		$zomes () {
		    return this.$store.getters.$zomes( "all" );
		},

		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.$hdk_versions;
		},

		filtered_zomes () {
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

		this.fetchHDKVersions();
	    },
	    "methods": {
		async fetchZomes () {
		    try {
			await this.$store.dispatch("fetchAllZomes");

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
			    this.input.zomes[i].resource_hash	= zome_version.mere_memory_hash;
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
		    log.normal("Adding zome:", zome );
		    if ( zome === undefined )
			return;

		    log.info("Reset search");
		    this.zome_search_text = "";

		    if ( this.added_zomes.find( z => z.$id === zome.$id ) )
			return;

		    log.info("Fetch Zome versions for:", zome.$id );
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

		    common.array_move( this.added_zomes, from_index, to_index );
		    common.array_move( this.input.zomes, from_index, to_index );
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
		}
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
		    return this.version ? this.version.for_dna : null;
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

    return {
	create,
	update,
	single,
    };
};
