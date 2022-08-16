const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happ releases");

const { load_html,
	...common }			= require('./common.js');

const md_converter			= new showdown.Converter({
    "headerLevelStart": 3,
});


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await load_html("/templates/happs/releases/create.html"),
	    "data": function() {
		return {
		    "happ_id": null,
		    "error": null,
		    "input": {
			"gui": null,
			"ordering": 1,
			"manifest": {
			    "manifest_version": "1",
			    "roles": [],
			},
			"hdk_version": null,
			"dnas": [],
		    },
		    "added_dnas": [],
		    "dna_search_text": "",
		    "validated": false,
		    "saving": false,
		    "lock_hdk_version_input": false,
		    "change_version_context": null,
		    "gui_file": null,
		    "gui_bytes": null,
		};
	    },
	    "computed": {
		form () {
		    return this.$refs["form"];
		},
		change_version_modal () {
		    return this.$refs["changeVersion"].modal;
		},

		happ () {
		    return this.$store.getters.happ( this.happ_id );
		},
		$happ () {
		    return this.$store.getters.$happ( this.happ_id );
		},

		compatible_dnas () {
		    return this.$store.getters.dnas( this.input.hdk_version || "all" );
		},
		$compatible_dnas () {
		    return this.$store.getters.$dnas( this.input.hdk_version || "all" );
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
		    return this.$store.getters.dna_versions( this.change_version_context[1].$id );
		},
		$alternative_versions () {
		    return this.$store.getters.$dna_versions( this.change_version_context ? this.change_version_context[1].$id : "" );
		},

		filtered_dnas () {
		    return this.compatible_dnas.filter( dna => {
			return dna.name.toLowerCase()
			    .includes( this.dna_search_text.toLowerCase() )
			    && !this.added_dnas.find( z => z.$id === dna.$id );
		    });
		},
		dna_card_actions () {
		    return ( index ) => {
			return [
			    this.changeDnaVersionAction( index ),
			    this.removeDnaAction( index ),
			];
		    };
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

		this.$store.dispatch("fetchHDKVersions");
		this.$store.dispatch("fetchHapp", this.happ_id );

		const release		= await this.$store.dispatch("getLatestReleaseForHapp", [ this.happ_id, null ] );
		this.input.ordering	= release ? release.ordering + 1 : 1;
	    },
	    "methods": {
		async create () {
		    log.info("Form was submitted");
		    this.validated		= true;

		    if ( this.form.checkValidity() === false )
			return;

		    this.saving			= true;
		    try {
			const input		= Object.assign({}, this.input );

			if ( this.gui_bytes ) {
			    const web_asset	= await this.$store.dispatch("createWebAsset", this.gui_bytes );

			    input.gui		= {
				"asset_group_id": web_asset.$id,
				"uses_web_sdk": false,
			    };
			}

			input.manifest				= Object.assign({}, input.manifest );
			input.manifest.name			= this.happ.title;
			input.manifest.description		= this.happ.description;
			input.manifest.roles			= [];

			for ( let dna_ref of input.dnas ) {
			    input.manifest.roles.push({
				"id":		dna_ref.role_id,
				"dna": {
				    "bundled":	`./${dna_ref.role_id}.dna`,
				    "clone_limit": 0,
				},
				"provisioning": {
				    "strategy": "create",
				    "deferred": false,
				},
			    });
			}

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

		selectNewVersion ( version ) {
		    const [ index, dna ]		= this.change_version_context;

		    this.input.dnas[index].version		= version.$id;
		    this.input.dnas[index].wasm_hash		= version.wasm_hash;

		    this.change_version_context			= null;
		    this.change_version_modal.hide();
		},
		changeDnaVersionAction ( index ) {
		    const dna			= this.added_dnas[ index ];
		    const versions		= this.$store.getters.dna_versions( dna.$id )
			  .filter( version => version.hdk_version === this.input.hdk_version );

		    return {
			"hide": versions.length < 2,
			"title": "Select a different version",
			"icon": "layers-half",
			"method": () => {
			    const dna				= this.added_dnas[index];
			    this.change_version_context		= [ index, dna ];
			    this.change_version_modal.show();
			},
		    };
		},
		removeDnaAction ( i ) {
		    return {
			"icon": "x-lg",
			"title": "Remove DNA Version",
			"method": () => {
			    this.removeDna( i );
			},
		    };
		},
		addDnaAction ( dna ) {
		    return {
			"icon": "plus-lg",
			"title": "Add DNA",
			"method": () => {
			    this.addDna( dna );
			},
		    };
		},

		removeDna ( i ) {
		    this.added_dnas.splice( i, 1 );
		    this.input.dnas.splice( i, 1 );
		},
		async addDna ( dna ) {
		    log.debug("Adding DNA:", dna );
		    if ( dna === undefined )
			return;

		    log.info("Reset search");
		    this.dna_search_text = "";

		    if ( this.added_dnas.find( z => z.$id === dna.$id ) )
			return;

		    const latest_version	= await this.$store.dispatch("getLatestVersionForDna", [ dna.$id, this.input.hdk_version ] );

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= latest_version.hdk_version;
		    }

		    this.lock_hdk_version_input		= true;

		    this.added_dnas.push( dna );
		    this.input.dnas.push({
			"role_id":	dna.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			"dna":		dna.$id,
			"version":	latest_version.$id,
			"wasm_hash":	latest_version.wasm_hash,
		    });
		},
		dnaIsAdded ( dna_id ) {
		    return !!this.added_dnas.find( d => d.$id === dna_id );
		},
		selectHDKVersion ( hdk_version ) {
		    this.input.hdk_version		= hdk_version || null;

		    if ( this.compatible_dnas.length === 0 ) {
			if ( hdk_version )
			    this.$store.dispatch("fetchDnasWithHDKVersion", hdk_version );
			else
			    this.$store.dispatch("fetchAllDnas");
		    }
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
	    "template": await load_html("/templates/happs/releases/update.html"),
	    "data": function() {
		return {
		    "id": null,
		    "happ_id": null,
		    "error": null,
		    "_release": null,
		    "input": {},
		    "validated": false,
		    "gui_file": null,
		    "gui_bytes": null,
		    "saving_gui": false,
		    "show_preview": false,
		};
	    },
	    "computed": {
		release () {
		    if ( this.$store.getters.happ_release( this.id ) )
			this._release	= this.copy( this.$store.getters.happ_release( this.id ) );

		    return this._release;
		},
		$release () {
		    return this.$store.getters.$happ_release( this.id );
		},
		happ () {
		    if ( !this.release )
			return null;

		    return this.$store.getters.happ( this.release.for_happ );
		},
		$happ () {
		    return this.$store.getters.$happ( this.release ? this.release.for_happ : null );
		},
		form () {
		    return this.$refs["form"];
		},
		preview_toggle_text () {
		    return this.show_preview ? "editor" : "preview";
		},
		file_valid_feedback () {
		    const file		= this.gui_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");
		this.happ_id		= this.getPathId("happ");

		if ( !this.release )
		    await this.fetchRelease();
	    },
	    "methods": {
		togglePreview () {
		    this.show_preview		= !this.show_preview;
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
			if ( this.gui_bytes ) {
			    this.saving_gui			= true;
			    const web_asset			= await this.$store.dispatch("createWebAsset", this.gui_bytes );

			    this.input.gui	= {
				"asset_group_id": web_asset.$id,
				"holo_hosting_settings": {
				    "uses_web_sdk": false,
				},
			    };
			    this.saving_gui			= false;
			}

			await this.$store.dispatch("updateHappRelease", [ this.id, this.input ] );

			this.$router.push( `/happs/${this.happ_id}/releases/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update hApp Release (%s):", String(this.id), err );
			this.error	= err;
		    }
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

    async function single () {
	return {
	    "template": await load_html("/templates/happs/releases/single.html"),
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
		    return this.$store.getters.happ_release( this.id );
		},
		$release () {
		    return this.$store.getters.$happ_release( this.id );
		},
		happ () {
		    if ( !this.release )
			return null;

		    return this.$store.getters.happ( this.release.for_happ );
		},
		$happ () {
		    return this.$store.getters.$happ( this.release ? this.release.for_happ : null );
		},
		$packageBytes () {
		    return this.$store.getters.$happ_release_package( this.release ? this.release.$id : null );
		},
		$webhappPackageBytes () {
		    return this.$store.getters.$happ_release_package( this.release ? this.release.$id + "-webhapp" : null );
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

    async function upload () {
	return {
	    "template": await load_html("/templates/happs/releases/upload.html"),
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {
			"name": "",
			"description": "",
			"ordering": 1,
			"manifest": null,
			"hdk_version": null,
			"dnas": [],
		    },
		    "initial_step": this.$route.params.step,
		    "validated": false,
		    "saving": false,
		    "latest_release": null,
		    "steps": [
			"Upload hApp bundle",
			"Manage DNAs",
			"Details",
			"Review",
		    ],
		    "file_id": "uploaded_happ_bundle",
		    "ready_for_review": false,

		    "dna_selection_confirmed": false,
		    "zome_selection_confirmed": false,

		    "select_dna_version_context": null,
		    "select_dna_context": null,
		    "select_zome_version_context": null,
		    "select_zome_context": null,

		    "gui_file": null,
		    "gui_bytes": null,

		    "setup": null,
		    "previous_dnas": {},
		};
	    },
	    "computed": {
		form () {
		    return this.$refs.form;
		},
		dna_form () {
		    return ( name ) => {
			const refs		= this.$refs["form_" + name];
			return refs && refs[0];
		    };
		},
		zome_form () {
		    return ( name ) => {
			const refs		= this.$refs["form_zome_" + name];
			return refs && refs[0];
		    };
		},
		select_dna_modal () {
		    return this.$refs["selectDna"].modal;
		},
		select_dna_version_modal () {
		    return this.$refs["selectDnaVersion"].modal;
		},
		select_zome_modal () {
		    return this.$refs["selectZome"].modal;
		},
		select_zome_version_modal () {
		    return this.$refs["selectZomeVersion"].modal;
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

		happ () {
		    return this.$store.getters.happ( this.id );
		},
		$happ () {
		    return this.$store.getters.$happ( this.id );
		},

		happ_release () {
		    if ( this.latest_release )
			return this.$store.getters.happ_release( String(this.latest_release.$id) );
		},
		$happ_release () {
		    if ( this.latest_release )
			return this.$store.getters.$happ_release( String(this.latest_release.$id) );
		    else
			return this.$store.getters.$happ_release("");
		},

		previous_hdk_versions () {
		    return this.$store.getters.hdk_versions;
		},
		$previous_hdk_versions () {
		    return this.$store.getters.$hdk_versions;
		},

		// Managing DNAs
		dnas () {
		    return ( name ) => {
			return this.$store.getters.dnas_by_name( name );
		    };
		},
		$dnas () {
		    return ( name ) => {
			return this.$store.getters.$dnas_by_name( name );
		    };
		},

		versions_for_dna () {
		    return ( dna_id ) => {
			return this.$store.getters.dna_versions( dna_id );
		    };
		},
		$versions_for_dna () {
		    return ( dna_id ) => {
			return this.$store.getters.$dna_versions( dna_id );
		    };
		},
		dna_versions () {
		    return ( hash ) => {
			return this.$store.getters.dna_versions_by_hash( hash )
			    .filter( version => {
				if ( !this.input.hdk_version )
				    return true;
				return version.hdk_version === this.input.hdk_version;
			    });
		    };
		},
		$dna_versions () {
		    return ( hash ) => {
			return this.$store.getters.$dna_versions_by_hash( hash );
		    };
		},

		// Configuring zomes
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

		// Central context
		uploaded_file () {
		    return this.$store.getters.file( this.file_id );
		},
		$uploaded_file () {
		    return this.$store.getters.$file( this.file_id );
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
		gui_valid_feedback () {
		    const file		= this.gui_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.id			= this.getPathId("id");

		this.setup		= this.refresh();

		this.$store.dispatch("fetchHDKVersions");
	    },
	    "methods": {
		async refresh () {
		    if ( !this.happ )
			this.fetchHapp();

		    this.latest_release		= await this.$store.dispatch("getLatestReleaseForHapp", [ this.id, null ] );

		    if ( !this.latest_release ) {
			log.warn("There are no releases for this hApp: %s", String(this.id) );
			return;
		    }

		    log.normal("Prepping last release (%s) for comparison", String(this.latest_release.$id) );
		    // Since there are release(s) for this hApp, we need to fetch the latest one to
		    // compare the differences when a bundle is uploaded.
		    await this.$store.dispatch("fetchHappRelease", this.latest_release.$id );
		    log.info("Latest hApp release:", this.happ_release );

		    // We will use the last release name as the default value for the next release.
		    // this.input.name		= this.happ_release.name;
		    this.input.ordering		= this.happ_release.ordering + 1;

		    log.info("Make reverse-lookup for previous DNAs:", this.happ_release );
		    this.happ_release.dnas.forEach( async dna_ref => {
			const prev_dna_info	= this.previous_dnas[dna_ref.role_id]	= this.copy( dna_ref );
			prev_dna_info.integrity_zomes	= {};
			prev_dna_info.zomes		= {};

			this.$store.dispatch("getDnaVersion", dna_ref.version ).then( dna_version => {
			    // prev_dna_info.zomes			= {};

			    for ( let zome_ref of dna_version.integrity_zomes ) {
				prev_dna_info.integrity_zomes[zome_ref.name]	= zome_ref;
			    }

			    for ( let zome_ref of dna_version.zomes ) {
				prev_dna_info.zomes[zome_ref.name]	= zome_ref;
			    }
			});
		    });
		},
		async fetchHapp () {
		    log.normal("Fetching hApp: %s", String(this.id) );
		    try {
			await this.$store.dispatch("fetchHapp", this.id );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get happ (%s): %s", String(this.id), err.message, err );
		    }
		},
		async fetchHappReleases () {
		    log.normal("Fetching hApp relesaes for hApp: %s", String(this.id) );
		    try {
			await this.$store.dispatch("fetchReleasesForHapp", this.id );
			log.debug("Releases for this hApp:", this.releases );
			log.trace("Release with latest published_at:", this.latest_release );
		    } catch (err) {
			log.error("Failed to get releases for happ (%s): %s", String(this.id), err.message, err );
		    }
		},

		reset_file () {
		    if ( this.bundle.roles ) {
			for ( let role of this.bundle.roles ) {
			    role.saving			= false;
			    role.validated		= false;
			    role.selected_dna		= null;
			    role.selected_dna_version	= null;
			}
		    }

		    this.input.name			= "";
		    this.input.description		= "";
		    this.input.ordering			= 1;
		    this.input.hdk_version		= null;

		    this.validated			= false;
		    this.zome_selection_confirmed	= false;
		    this.ready_for_review		= false;
		    this.select_dna_version_context	= null;
		    this.select_dna_context		= null;
		    this.select_zome_context		= null;

		    this.file_id			= "uploaded_happ_bundle";
		    this.gui_file			= null;
		    this.gui_bytes			= null;

		    this.$store.dispatch("removeValue", [ "file", this.uploaded_file.hash ] );
		    this.$store.dispatch("removeValue", [ "file", this.file_id ] );
		},
		reset_hdk_version () {
		    this.input.hdk_version		= null;
		    this.reset_file();
		},

		missing_zome_version ( dna ) {
		    for ( let zome_sources of Object.values( dna.integrity_zomes ) ) {
			if ( !zome_sources.upload.zome_version_id )
			    return true;
		    }
		    for ( let zome_sources of Object.values( dna.coordinator.zomes ) ) {
			if ( !zome_sources.upload.zome_version_id )
			    return true;
		    }
		    return false;
		},

		async file_selected ( event ) {
		    await this.setup;

		    const files			= event.target.files;
		    const file			= files[0];

		    if ( file === undefined ) {
			return;
		    }

		    await this.$store.dispatch("uploadFile", [ this.file_id, file ] );
		    await this.$store.dispatch("unpackBundle", this.uploaded_file.hash );

		    await this.delay();

		    if ( this.bundle.type === "webhapp" ) {
			log.info("Found web app bundle:", this.bundle );

			const ui_file		= await this.bundle.ui.source();

			log.debug("Set GUI:", this.bundle.ui );
			this.set_gui({
			    "name": this.bundle.ui.name,
			    "size": ui_file.bytes.length,
			}, ui_file.bytes );

			const happ_file		= await this.bundle.happ.source();
			await this.bundle.happ.bundle();

			this.file_id		= happ_file.hash;
		    }

		    log.normal("Uploaded hApp bundle:", this.bundle );
		    if ( this.bundle.type !== "happ" ) {
			alert(`Uploaded bundle is not a hApp bundle. found bundle type '${this.bundle.type}'`);
			return this.reset_file();
		    }

		    await this.delay();

		    Object.values( this.bundle.roles ).forEach( async role => {
			// This delay allows the UI to update a few things before saturating the CPU
			await this.delay();

			log.debug("Setup for role:", role );
			role.version			= "";
			role.ordering			= 1;
			role.file			= null;
			role.bundle			= await role.dna.manifest();
			role.hash			= role.bundle.dna_hash;
			role.file			= await role.dna.source();

			if ( this.previous_dnas[role.id] ) {
			    const prev_dna_ref			= this.previous_dnas[role.id];

			    log.normal("Previous role match '%s':", role.id, prev_dna_ref );
			    if ( prev_dna_ref.wasm_hash === role.hash ) {
				// Auto-select the previous role DNA Version
				this.$store.dispatch("getDnaVersion", prev_dna_ref.version )
				    .then( version => {
					if ( version.hdk_version === this.input.hdk_version )
					    this.select_dna_version( role, version );
				    });
			    }
			    else {
				await this.$store.dispatch("fetchDnaVersionsByHash", role.hash );

				// If there are any matching versions, then we won't assume that a
				// new DNA Version is being created.
				if ( this.dna_versions( role.hash ).length === 0 ) {
				    // Auto-select the parent DNA of the previous role configuration
				    this.$store.dispatch("getDna", prev_dna_ref.dna )
					.then( dna => {
					    this.assign_parent_dna_for( role, dna );
					});
				}
			    }
			}

			// Search for existing DNAs that match the role ID
			this.$store.dispatch("fetchDnasByName", role.bundle.name );
			this.$dna_versions( role.hash ).current || this.$store.dispatch("fetchDnaVersionsByHash", role.hash );

			role.bundle.integrity.zomes.forEach( async zome_ref => {
			    await this.delay();

			    zome_ref.version		= "";
			    zome_ref.ordering		= 1;

			    if ( this.previous_dnas[ role.id ] && this.previous_dnas[ role.id ].integrity_zomes[ zome_ref.name ] ) {
				const prev_zome		= this.previous_dnas[ role.id ].integrity_zomes[ zome_ref.name ];

				log.normal("Previous zome match (%s) in role '%s':", zome_ref.name, role.id, prev_zome );
				if ( prev_zome.mere_memory_hash === zome_ref.hash
				     && prev_zome.hdk_version === this.input.hdk_version) {
				    // Auto-select the previous role->zome Version
				    this.select_zome_version( zome_ref, prev_zome );
				}
				else {
				    await this.$store.dispatch("fetchZomeVersionsByHash", zome_ref.hash );

				    // If there are any matching versions, then we won't assume that
				    // a new Zome Version is being created.
				    if ( this.zome_versions( zome_ref.hash ).length === 0 ) {
					// Auto-select the parent Zome of the previous role->zome configuration
					this.$store.dispatch("getZome", prev_zome.zome )
					    .then( zome => {
						this.assign_parent_zome_for( zome_ref, zome );
					    });
				    }
				}
			    }

			    // Search for existing zomes with the same name
			    this.$store.dispatch("fetchZomesByName", zome_ref.name );
			    this.$zome_versions( zome_ref.hash ).current || this.$store.dispatch("fetchZomeVersionsByHash", zome_ref.hash );
			});

			role.bundle.coordinator.zomes.forEach( async zome_ref => {
			    await this.delay();

			    zome_ref.version		= "";
			    zome_ref.ordering		= 1;

			    if ( this.previous_dnas[ role.id ] && this.previous_dnas[ role.id ].zomes[ zome_ref.name ] ) {
				const prev_zome		= this.previous_dnas[ role.id ].zomes[ zome_ref.name ];

				log.normal("Previous zome match (%s) in role '%s':", zome_ref.name, role.id, prev_zome );
				if ( prev_zome.mere_memory_hash === zome_ref.hash
				     && prev_zome.hdk_version === this.input.hdk_version) {
				    // Auto-select the previous role->zome Version
				    this.select_zome_version( zome_ref, prev_zome );
				}
				else {
				    await this.$store.dispatch("fetchZomeVersionsByHash", zome_ref.hash );

				    // If there are any matching versions, then we won't assume that
				    // a new Zome Version is being created.
				    if ( this.zome_versions( zome_ref.hash ).length === 0 ) {
					// Auto-select the parent Zome of the previous role->zome configuration
					this.$store.dispatch("getZome", prev_zome.zome )
					    .then( zome => {
						this.assign_parent_zome_for( zome_ref, zome );
					    });
				    }
				}
			    }

			    // Search for existing zomes with the same name
			    this.$store.dispatch("fetchZomesByName", zome_ref.name );
			    this.$zome_versions( zome_ref.hash ).current || this.$store.dispatch("fetchZomeVersionsByHash", zome_ref.hash );
			});
		    });

		    this.bundle.hash			= await this.bundle.happ_hash();
		},


		//
		// DNA management controls
		//
		prompt_select_dna_version ( role ) {
		    this.select_dna_version_context	= role;

		    this.select_dna_version_modal.show();
		},
		prompt_select_dna ( role ) {
		    this.select_dna_context		= role;

		    this.select_dna_modal.show();
		},

		unselectAction ( role ) {
		    return {
			"icon": "x-lg",
			"title": "Undo selected version",
			"method": () => {
			    this.unselect_dna_version( role );
			},
		    };
		},
		async select_dna_version ( upload, version ) {
		    log.normal("Select DNA version for '%s':", upload.id, version );

		    upload.selected_dna_version = version;

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= version.hdk_version;
		    }

		    this.select_dna_version_context	= null;
		    this.select_dna_version_modal.hide();
		},
		async unselect_dna_version ( upload ) {
		    log.normal("Unselect DNA version for '%s'", upload.id );

		    delete upload.selected_dna_version;

		    let empty				= true;
		    for ( let role of this.bundle.roles ) {
			if ( role.selected_dna_version )
			    empty			= false;
		    }

		    if ( upload.selected_dna ) {
			const version		= await this.$store.dispatch("getLatestVersionForDna", [ upload.selected_dna.$id, null ]  );
			upload.ordering		= version ? version.ordering + 1 : 1;
		    }
		},

		async assign_parent_dna_for ( role, dna ) {
		    log.normal("Assign parent DNA for '%s':", role.id, dna );

		    role.selected_dna		= dna;
		    this.select_dna_context	= null;
		    this.select_dna_modal.hide();

		    const version		= await this.$store.dispatch("getLatestVersionForDna", [ dna.$id, null ]  );
		    role.ordering		= version ? version.ordering + 1 : 1;
		},
		async unassign_parent_dna_for ( role ) {
		    log.normal("Unassign parent DNA for '%s'", role.id );

		    role.ordering		= 1;

		    delete role.selected_dna;
		},


		//
		// Zome management controls
		//
		prompt_select_zome_version ( zome_ref ) {
		    this.select_zome_version_context	= zome_ref;

		    this.select_zome_version_modal.show();
		},
		prompt_select_zome ( zome_ref ) {
		    this.select_zome_context		= zome_ref;

		    this.select_zome_modal.show();
		},

		unselectZomeAction ( role, zome_ref ) {
		    return {
			"icon": "x-lg",
			"title": "Undo selected version",
			"method": () => {
			    this.unselect_zome_version( role, zome_ref );
			},
		    };
		},
		async select_zome_version ( upload, version ) {
		    log.normal("Select zome version for '%s':", upload.name, version );

		    upload.selected_zome_version = version;

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= version.hdk_version;
		    }

		    this.select_zome_version_context	= null;
		    this.select_zome_version_modal.hide();
		},
		async unselect_zome_version ( role, upload ) {
		    log.normal("Unselect zome version for '%s'", upload.name );

		    delete upload.selected_zome_version;

		    // let empty				= true;
		    // for ( let zome of role.bundle.zomes ) {
		    // 	if ( zome.selected_zome_version )
		    // 	    empty			= false;
		    // }

		    if ( upload.selected_zome ) {
			const version		= await this.$store.dispatch("getLatestVersionForZome", [ upload.selected_zome.$id, null ]  );
			upload.ordering		= version ? version.ordering + 1 : 1;
		    }
		},

		async assign_parent_zome_for ( upload, zome ) {
		    log.normal("Assign parent zome for '%s':", upload.name, zome );

		    upload.selected_zome	= zome;
		    this.select_zome_context	= null;
		    this.select_zome_modal.hide();

		    const version		= await this.$store.dispatch("getLatestVersionForZome", [ zome.$id, null ]  );
		    upload.ordering		= version ? version.ordering + 1 : 1;
		},
		async unassign_parent_zome_for ( upload ) {
		    log.normal("Unassign parent zome for '%s'", upload.name );

		    upload.ordering		= 1;

		    delete upload.selected_zome;
		},


		//
		// Central context controls
		//
		async readyForReview () {
		    this.validated		= true;

		    if ( this.missingDnas() )
			return;

		    this.ready_for_review	= true;
		},

		async create_zome_version ( zome_info ) {
		    this.validated		= true;
		    zome_info.validated		= true;

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
				    "display_name": zome_info.display_name,
				    "description": zome_info.description,
				}
			    );
			    this.$store.dispatch("fetchZomesByName", zome_info.name );
			}

			// Create the new version
			const version			= await this.$client.call(
			    "dnarepo", "dna_library", "create_zome_version", {
				"for_zome":	zome_info.selected_zome.$id,
				"version":	zome_info.version,
				"ordering":	zome_info.ordering,
				"zome_bytes":	zome_info.bytes,
				"hdk_version":	this.input.hdk_version,
			    }
			);
			this.$store.dispatch("fetchZomeVersionsByHash", zome_info.hash );
			this.$store.dispatch("fetchVersionsForZome", zome_info.selected_zome.$id );

			zome_info.description		= "";
			zome_info.create_zome		= null;

			zome_info.selected_zome_version = version;
		    } catch (err) {
			throw err;
		    } finally {
			zome_info.saving		= false;
		    }
		},

		async create_dna_version ( role ) {
		    this.validated		= true;
		    role.validated		= true;

		    const form			= this.dna_form( role.id );

		    if ( !form || form.checkValidity() === false )
			return;

		    if ( this.missingZomes( role ) )
			return;

		    role.saving			= true;

		    try {
			// If there are none, create one
			if ( !role.selected_dna ) {
			    role.selected_dna	= await this.$client.call(
				"dnarepo", "dna_library", "create_dna", {
				    "name": role.bundle.name,
				    "display_name": role.display_name,
				    "description": role.description,
				}
			    );
			    this.$store.dispatch("fetchDnasByName", role.id );
			}

			// Create the new version
			const version			= await this.$client.call(
			    "dnarepo", "dna_library", "create_dna_version", {
				"for_dna":		role.selected_dna.$id,
				"version":		role.version,
				"ordering":		role.ordering,
				"hdk_version":		this.input.hdk_version,
				"properties":		role.bundle.properties,
				"integrity_zomes":	role.bundle.integrity.zomes.map( zome_info => {
				    return {
					"name":			zome_info.name,
					"zome":			zome_info.selected_zome_version.for_zome,
					"version":		zome_info.selected_zome_version.$id,
					"resource":		zome_info.selected_zome_version.mere_memory_addr,
					"resource_hash":	zome_info.selected_zome_version.mere_memory_hash,
				    };
				}),
				"zomes":		role.bundle.coordinator.zomes.map( zome_info => {
				    return {
					"name":			zome_info.name,
					"zome":			zome_info.selected_zome_version.for_zome,
					"version":		zome_info.selected_zome_version.$id,
					"resource":		zome_info.selected_zome_version.mere_memory_addr,
					"resource_hash":	zome_info.selected_zome_version.mere_memory_hash,
					"dependencies":		Object.values( zome_info.dependencies ).map( ref => ref.name ),
				    };
				}),
			    }
			);
			this.$store.dispatch("fetchDnaVersionsByHash", role.hash );
			this.$store.dispatch("fetchVersionsForDna", role.selected_dna.$id );

			role.description		= "";

			role.selected_dna_version	= version;
		    } catch (err) {
			throw err;
		    } finally {
			role.saving		= false;
		    }
		},

		async create () {
		    this.saving			= true;

		    try {
			log.normal("Creating hApp release: %s", this.input.name );

			const input			= {
			    "name":		this.input.name,
			    "description":	this.input.description,
			    "hdk_version":	this.input.hdk_version,
			    "ordering":		this.input.ordering,
			    "manifest":		this.bundle.manifest,
			    "dnas": this.bundle.roles.map( role => {
				const version		= role.selected_dna_version;
				return {
				    "role_id":		role.id,
				    "dna":		version.for_dna,
				    "version":		version.$id,
				    "wasm_hash":	version.wasm_hash,
				};
			    }),
			};

			if ( this.gui_bytes ) {
			    const web_asset	= await this.$store.dispatch("createWebAsset", this.gui_bytes );

			    input.gui		= {
				"asset_group_id": web_asset.$id,
				"uses_web_sdk": false,
			    };
			}

			log.debug("Create hApp release '%s': (%s DNAs):", this.input.name, this.input.dnas.length, this.input );
			const release		= await this.$store.dispatch("createHappRelease", [ this.id, input ] );

			this.reset_file();

			this.$store.dispatch("fetchReleasesForHapp", this.id );
			this.$router.push( `/happs/${this.id}/releases/${release.$id}` );
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

		missingDnas () {
		    if ( !(this.bundle && this.bundle.roles) )
			return false;

		    for ( let role of this.bundle.roles ) {
			if ( !role.selected_dna_version )
			    return true;
		    }

		    return false;
		},
		missingZomes ( role ) {
		    if ( !(role.bundle && role.bundle.zomes) )
			return false;

		    for ( let zome of role.bundle.zomes ) {
			if ( !zome.selected_zome_version )
			    return true;
		    }

		    return false;
		},

		async set_gui ( file, bytes ) {
		    if ( !file ) {
			this.gui_bytes          = null;
			this.gui_file           = null;
			return;
		    }

		    this.gui_file               = file;
		    this.gui_bytes              = bytes;

		    this.$refs.gui_input.showFeedback   = true;
		    this.$refs.gui_input.blurred        = true;
		},

		async gui_selected ( event ) {
		    const files                 = event.target.files;
		    const file                  = files[0];

		    if ( file === undefined )
			return this.set_gui( null );

		    this.set_gui( file, await this.load_file( file ) );
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
