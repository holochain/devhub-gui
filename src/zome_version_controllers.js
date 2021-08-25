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
	    },
	    async created () {
		this.zome_id		= new HoloHashes.EntryHash( this.$route.params.zome );
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
		    this.input.for_zome	= this.zome_id;
		    try {
			let version	= await client.call(
			    "dnarepo", "dna_library", "create_zome_version", this.input
			);
			this.$router.push( `/zomes/${this.zome_id}/versions/${version.$id}` );
		    } catch ( err ) {
			log.error("Failed to create Zome Version:", err );
			this.error	= err;
		    } finally {
			this.saving	= false;
		    }
		},
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
		    "version": null,
		    "loading_version": true,
		    "zome": null,
		    "input": {},
		    "validated": false,
		    "saving": false,
		    "changelog_markdown": null,
		    "show_changelog_preview": false,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		preview_toggle_text () {
		    return this.show_changelog_preview ? "editor" : "preview";
		}
	    },
	    async created () {
		this.id			= new HoloHashes.EntryHash( this.$route.params.id );
		this.zome_id		= new HoloHashes.EntryHash( this.$route.params.zome );

		this.fetchVersion();

		window.View = this;
	    },
	    "methods": {
		toggleChangelogPreview () {
		    this.show_changelog_preview = !this.show_changelog_preview;
		    this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.changelog_markdown	= md_converter.makeHtml( this.version.changelog );
		},
		async fetchVersion () {
		    this.loading_version	= true;

		    try {
			log.debug("Getting zome version %s", String(this.id) );
			let version		= await client.call(
			    "dnarepo", "dna_library", "get_zome_version", { "id": this.id }
			);

			log.info("Received version: %s", version.name, version );
			this.version		= version;
			this.zome		= version.for_zome;
			this.loading_version	= false;
			this.updateChangelogMarkdown();
		    } catch (err) {
			if ( err.name === "EntryNotFoundError" )
			    return this.$root.showStatusView( 404 );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async update () {
		    this.validated	= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving		= true;
		    try {
			let zome	= await client.call(
			    "dnarepo", "dna_library", "update_zome_version", {
				"id": this.id,
				"addr": this.version.$addr,
				"properties": this.input,
			    }
			);
			this.$router.push( `/zomes/${this.zome_id}/versions/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update Zome (%s):", String(this.zome.$id), err );
			this.error	= err;
		    } finally {
			this.saving	= false;
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
		    "zome": null,
		    "version": null,
		    "loading_version": true,
		    "wasm_bytes": null,
		    "loading_wasm_bytes": true,
		    "changelog_markdown": null,
		};
	    },
	    async created () {
		this.id			= new HoloHashes.EntryHash( this.$route.params.id );
		this.zome_id		= new HoloHashes.EntryHash( this.$route.params.zome );

		this.refresh();
	    },
	    "computed": {
		modal () {
		    return this.$refs["modal"].modal;
		},
		wasm_filename () {
		    const filename	= this.zome.name.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_v${this.version.version}.wasm`;
		},
	    },
	    "methods": {
		refresh () {
		    this.fetchVersion();
		},
		updateChangelogMarkdown () {
		    this.changelog_markdown	= md_converter.makeHtml( this.version.changelog );
		},
		async fetchVersion () {
		    this.loading_version	= true;

		    try {
			log.debug("Getting zome version %s", String(this.id) );
			let version		= await client.call(
			    "dnarepo", "dna_library", "get_zome_version", { "id": this.id }
			);

			log.info("Received version: %s", version.name, version );
			this.version		= version;
			this.zome		= version.for_zome;
			this.loading_version	= false;

			this.updateChangelogMarkdown();
			this.fetchWasmBytes( version.mere_memory_addr );
		    } catch (err) {
			if ( err.name === "EntryNotFoundError" )
			    return this.$root.showStatusView( 404 );

			log.error("Failed to get zome (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchWasmBytes ( addr ) {
		    this.loading_wasm_bytes	= true;

		    log.debug("Getting Wasm bytes %s", String(addr) );
		    let wasm_bytes		= await client.call(
			"dnarepo", "mere_memory", "retrieve_bytes", addr
		    );

		    log.info("Received wasm_bytes:", wasm_bytes );
		    this.wasm_bytes		= new Uint8Array( wasm_bytes );
		    this.loading_wasm_bytes	= false;
		},
		async unpublish () {
		    log.normal("Deleting Zome Version '%s' (%s)", this.version.version, String(this.id) );
		    await client.call(
			"dnarepo", "dna_library", "delete_zome_version", {
			    "id": this.id,
			}
		    );

		    this.modal.hide();
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
