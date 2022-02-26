const { Logger }			= require('@whi/weblogger');
const log				= new Logger("zome versions");

const { HoloHashes }			= require('@holochain/devhub-entities');
const showdown				= require('showdown');
const md_converter			= new showdown.Converter({
    "headerLevelStart": 3,
});


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": (await import("./templates/zomes/versions/create.html")).default,
	    "data": function() {
		return {
		    "zome_id": null,
		    "error": null,
		    "input": {
			"version": null,
			"changelog": null,
			"zome_bytes": null,
			"hdk_version": null,
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
		file_valid_feedback () {
		    const file		= this.zome_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions.collection;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.hdk_versions.metadata;
		},
	    },
	    async created () {
		this.zome_id		= this.getPathId("zome");

		this.fetchHDKVersions();
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
	    "template": (await import("./templates/zomes/versions/update.html")).default,
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
		version () {
		    if ( this.$store.getters.zome_version( this.id ).entity )
			this._version	= this.copy( this.$store.getters.zome_version( this.id ).entity );

		    return this._version;
		},
		$version () {
		    return this.$store.getters.zome_version( this.id ).metadata;
		},
		zome () {
		    return this.version ? this.version.for_zome : null;
		},
		$zome () {
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
	    "template": (await import("./templates/zomes/versions/single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "zome_id": null,
		    "changelog_html": null,
		};
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.zome_id		= this.getPathId("zome");

		this.refresh();
	    },
	    "computed": {
		version () {
		    return this.$store.getters.zome_version( this.id ).entity;
		},
		$version () {
		    return this.$store.getters.zome_version( this.id ).metadata;
		},
		zome () {
		    return this.version ? this.version.for_zome : null;
		},
		$zome () {
		    return this.$version;
		},
		$wasmBytes () {
		    return this.$store.getters.zome_version_wasm( this.version ? this.version.mere_memory_addr : null ).metadata;
		},
		modal () {
		    return this.$refs["modal"].modal;
		},
		wasm_filename () {
		    if ( !this.zome )
			return "Zome Wasm";

		    const filename	= this.zome.name.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_v${this.version.version}.wasm`;
		},
		zome_deprecated () {
		    return !!( this.zome && this.zome.deprecation );
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
			let version	= await this.$store.dispatch("fetchZomeVersion", this.id );

			this.updateChangelogMarkdown();
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
	    },
	};
    };

    return {
	create,
	update,
	single,
    };
};
