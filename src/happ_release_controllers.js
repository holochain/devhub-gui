const { Logger }			= require('@whi/weblogger');
const log				= new Logger("happ releases");

const common				= require('./common.js');


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await common.load_html("/templates/happs/releases/create.html"),
	    "data": function() {
		const happ_id		= this.getPathId("happ");

		return {
		    happ_id,
		    "happ_datapath":		`happ/${happ_id}`,
		    "happ_release_datapath":	`happ/release/new`,
		    "gui_release_datapath":	`gui/release/new`,
		    "error":			null,
		    "added_dnas":		[],
		    "dna_search_text":		"",
		    "change_version_context":	null,
		    "hdk_version_cache":	{},
		};
	    },
	    "watch": {
		"release$.hdk_version" ( new_hdk_version, old_hdk_version ) {
		    console.log("Changed HDK Version from %s to %s", old_hdk_version, new_hdk_version );

		    if ( old_hdk_version ) {
			this.hdk_version_cache[ old_hdk_version ] = {
			    "added_dnas":		this.added_dnas.slice(),
			    "dna_versions":		this.release$.dnas,
			};
		    }

		    if ( new_hdk_version ) {
			const cache			= this.hdk_version_cache[ new_hdk_version ];

			if ( cache ) {
			    this.added_dnas.splice( 0, this.added_dnas.length, ...cache.added_dnas );
			    this.release$.dnas			= cache.dna_versions;
			    return;
			}
		    }

		    this.added_dnas.splice( 0, this.added_dnas.length );
		    this.release$.dnas			= [];
		},
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.happ_datapath,		"happ", { "get": true } ),
		...common.scopedPathComputed( c => c.happ_release_datapath,	"release" ),
		...common.scopedPathComputed( c => c.gui_release_datapath,	"gui_release" ),
		...common.scopedPathComputed( `guis`,				"all_guis", { "get": true }),
		...common.scopedPathComputed( `dnarepo/hdk/versions`,		"previous_hdk_versions", { "get": true }),

		relative_dna_versions_path () {
		    return this.change_version_context
			? `dna/${this.change_version_context[1].$id}/versions/hdk/${this.release$.hdk_version}`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.relative_dna_versions_path, "alternative_versions", {
		    "default": [],
		}),

		dna_picker_modal () {
		    return this.$refs["dna_picker"].modal;
		},
		change_version_modal () {
		    return this.$refs["change_version"].modal;
		},
		gui_releases_modal () {
		    return this.$refs["select_gui_release"].modal;
		},

		gui_releases () {
		    return ( gui_id ) => {
			return this.$openstate.state[ `gui/${gui_id}/releases` ] || [];
		    }
		},
		$gui_releases () {
		    return ( gui_id ) => {
			return this.$openstate.metastate[ `gui/${gui_id}/releases` ];
		    }
		},
	    },
	    async created () {
		window.HappReleaseCreate = this;
		const release		= await this.$openstate.get(`happ/${this.happ_id}/releases/latest`);

		this.release$.ordering	= release ? release.ordering + 1 : 1;
		this.release$.for_happ	= this.happ_id;
	    },
	    "methods": {
		async updateDnaList () {
		    log.info("Configure added DNAs:", this.added_dnas );
		    this.added_dnas.forEach( dna => {
			this.$openstate.read(`dna/${dna.$id}/versions`);
		    });
		    const prev_dnas			= new Set( this.release$.dnas.map( dna_ref => dna_ref.dna ) );
		    const new_dnas			= new Set( this.added_dnas.map( dna => String(dna.$id) ) );

		    for ( let dna of this.added_dnas ) {
			log.info("Check exisitng list:", prev_dnas, String(dna.$id) );
			if ( prev_dnas.has( String(dna.$id) ) ) {
			    prev_dnas.delete( String(dna.$id) );
			    continue;
			}

			const versions			= await this.$openstate.read(`dna/${dna.$id}/versions/hdk/${this.release$.hdk_version}`);
			const latest_version		= await this.$openstate.read(`dna/${dna.$id}/versions/hdk/${this.release$.hdk_version}/latest`);

			log.info("Push dna:", dna );
			this.release$.dnas.push({
			    "version_count":	versions.length,
			    "role_name":		dna.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			    "dna":		String( dna.$id ),
			    "version":		String( latest_version.$id ),
			    "title":		latest_version.version,
			    "wasm_hash":	latest_version.wasm_hash,
			});
		    }

		    log.info("Remove DNAs:", prev_dnas );
		    prev_dnas.forEach( id => {
			log.debug("Remove DNA:", id, this.release$.dnas );
			const index		= this.release$.dnas.findIndex( dna => {
			    return String(dna.$id) === id;
			});
			this.release$.dnas.splice( index, 1 );
		    });
		},

		async getGUIReleases ( gui_id ) {
		    await this.$openstate.read(`gui/${gui_id}/releases`);
		},

		async create () {
		    log.info("Form was submitted");

		    try {
			const release$			= this.release$;

			release$.manifest.name			= this.happ.title;
			release$.manifest.description		= this.happ.description;
			release$.manifest.roles			= [];

			for ( let dna_ref of release$.dnas ) {
			    release$.manifest.roles.push({
				"name":		dna_ref.role_name,
				"dna": {
				    "bundled":	`./${dna_ref.role_name}.dna`,
				    "clone_limit": 0,
				    "modifiers": {
					"network_seed": null,
					"properties": null,
					"origin_time": null,
					"quantum_time": null,
				    },
				},
				"provisioning": {
				    "strategy": "create",
				    "deferred": false,
				},
			    });
			}

			await this.$openstate.write(`happ/release/new`);

			const new_id		= this.release.$id;

			this.$openstate.purge(`happ/release/new`);
			this.$openstate.read(`happ/${this.happ_id}/releases`);

			this.$router.push( `/happs/${this.happ_id}/releases/${new_id}` );
		    } catch ( err ) {
			log.error("Failed to create hApp Release:", err, err.data );
			this.error	= err;
		    }
		},

		selectNewVersion ( version ) {
		    const [ index, dna ]		= this.change_version_context;

		    this.release$.dnas[index].title	= version.version;
		    this.release$.dnas[index].version	= version.$id;
		    this.release$.dnas[index].wasm_hash	= version.wasm_hash;

		    this.change_version_context		= null;
		    this.change_version_modal.hide();
		},
		changeDnaVersion ( index ) {
		    const dna				= this.added_dnas[ index ];
		    this.change_version_context		= [ index, dna ];
		    this.change_version_modal.show();
		},

		selectHDKVersion ( hdk_version ) {
		    this.release$.hdk_version		= hdk_version || null;
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/happs/releases/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const happ_id		= this.getPathId("happ");

		return {
		    id,
		    happ_id,
		    "datapath":			`happ/release/${id}`,
		    "happ_datapath":		`happ/${happ_id}`,
		    "bundle_datapath":		`happ/release/${id}/bundle`,

		    "download_error":		null,
		    "download_webhapp_error":	null,
		    "downloading_webhapp":	false,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await Promise.all([
			this.$openstate.get( this.datapath ),
			this.$openstate.get( this.happ_datapath ),
		    ]);
		});
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath,			"release", { "get": true } ),
		...common.scopedPathComputed( c => c.happ_datapath,		"happ", { "get": true } ),
		...common.scopedPathComputed( c => c.bundle_datapath,		"package_bytes" ),

		webhapp_bundle_datapath () {
		    return this.release && this.release.official_gui
			? `happ/release/${this.id}/webhapp/${this.release.official_gui}/bundle`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.webhapp_bundle_datapath,	"webhapp_package_bytes" ),

		modal () {
		    return this.$refs["modal"].modal;
		},

		package_filename () {
		    if ( !this.happ )
			return "hApp Package";

		    const filename	= this.happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_${this.release.version}.happ`;
		},
		package_webhapp_filename () {
		    if ( !this.happ )
			return "hApp Package";

		    const filename	= this.happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_${this.release.version}.webhapp`;
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.happ_datapath );
		},
		async downloadPackageBytes () {
		    const bytes		= await this.$openstate.get( this.bundle_datapath, {
			"rememberState": false,
		    });

		    this.download( this.package_filename, bytes );
		},
		async downloadWebhappPackageBytes () {
		    this.downloading_webhapp		= true;
		    // await this.delay();
		    try {
			log.normal("Get Webhapp (official) GUI release: %s", this.release.official_gui );
			const gui_release		= await this.$openstate.get(`gui/release/${this.release.official_gui}`);

			log.normal("Get UI webasset zip: %s", gui_release.web_asset_id );
			const file			= await this.$openstate.get(`webasset/${gui_release.web_asset_id}`, {
			    "rememberState": false,
			});
			const ui_bytes			= new Uint8Array( file.bytes );

			log.normal("Get hApp package: %s", this.bundle_datapath );
			const happ_bytes		= await this.$openstate.get( this.bundle_datapath, {
			    "rememberState": false,
			});

			const webhapp_config		= {
			    "manifest": {
				"manifest_version": "1",
				"name": "Something",
				"ui": {
				    "bundled": "ui.zip"
				},
				"happ_manifest": {
				    "bundled": "bundled.happ"
				}
			    },
			    "resources": {
				"ui.zip":		ui_bytes,
				"bundled.happ":	happ_bytes,
			    },
			};
			const msgpacked_bytes		= MessagePack.encode( webhapp_config );
			const gzipped_bytes		= pako.gzip( msgpacked_bytes );

			log.normal("Download Webhapp package:", this.happ, this.release );
			this.download( this.package_webhapp_filename, gzipped_bytes );
		    } catch (err) {
			alert(`${err}`);
		    } finally {
			this.downloading_webhapp	= false;
		    }
		},
		async unpublish () {
		    await this.$openstate.delete( this.datapath );

		    this.modal.hide();

		    this.$openstate.read(`happ/${this.happ_id}/releases`);
		    this.$router.push( `/happs/${this.happ_id}` );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/happs/releases/update.html"),
	    "data": function() {
		const id			= this.getPathId("id");
		const happ_id			= this.getPathId("happ");

		return {
		    id,
		    happ_id,
		    "error": null,
		    "show_preview": false,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => `happ/release/${c.id}`,	"release", { "get": true }),
		...common.scopedPathComputed( c => `happ/${c.happ_id}`,		"happ", { "get": true } ),
		...common.scopedPathComputed( `guis`,				"all_guis", { "get": true }),

		input () {
		    return this.release$;
		},

		gui_releases () {
		    return ( gui_id ) => {
			return this.$openstate.state[ `gui/${gui_id}/releases` ] || [];
		    }
		},
		$gui_releases () {
		    return ( gui_id ) => {
			return this.$openstate.metastate[ `gui/${gui_id}/releases` ];
		    }
		},

		guis_modal () {
		    return this.$refs["select_gui_release"].modal;
		},
		preview_toggle_text () {
		    return this.show_preview ? "editor" : "preview";
		},
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get(`happ/release/${this.id}`);

		    log.warn("Checking for null modifiers in release manifest", this.release );
		    for ( let role of this.input.manifest.roles ) {
			if ( role.dna.modifiers === null ) {
			    log.warn("Fixing null modifiers for %s", role.name, role );
			    role.dna.modifiers	= {
				"network_seed": null,
				"properties": null,
				"origin_time": null,
				"quantum_time": null,
			    };
			}
		    }
		});
	    },
	    "methods": {
		async getGUIReleases ( gui_id ) {
		    await this.$openstate.read(`gui/${gui_id}/releases`);
		},
		togglePreview () {
		    this.show_preview		= !this.show_preview;
		},
		async update () {
		    try {
			await this.$openstate.write(`happ/release/${this.id}`);

			this.$openstate.read(`happ/${this.happ_id}/releases`);

			this.$router.push( `/happs/${this.happ_id}/releases/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update hApp Release (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function upload () {
	return {
	    "template": await common.load_html("/templates/happs/releases/upload.html"),
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {
			"version": "",
			"description": "",
			"ordering": 1,
			"manifest": null,
			"hdk_version": "0.1.0-beta",
			"dnas": [],
		    },
		    "initial_step": this.$route.params.step,
		    "unpacking_webhapp": false,
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
		    "previous_gui": null,
		    "previous_gui_hash": null,
		    "skip_gui": false,
		    "next_gui": {},
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
		    return ( hash, role = null ) => {
			return this.$store.getters.dna_versions_by_hash( hash )
			    .filter( version => {
				if ( this.input.hdk_version
				     && version.hdk_version !== this.input.hdk_version )
				    return false;

				if ( role ) {
				    const prev_info	= role.bundle.manifest.integrity;

				    if ( version.origin_time !== prev_info.origin_time )
					return false;
				    if ( version.network_seed !== prev_info.network_seed )
					return false;
				    if ( JSON.stringify( version.properties ) !== JSON.stringify( prev_info.properties ) )
					return false;
				}

				return true;
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
				if ( this.input.hdk_version
				     && version.hdk_version !== this.input.hdk_version )
				    return false;

				return true;
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
		window.HappReleaseUpload = this;
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

		    if ( this.happ_release.official_gui ) {
			this.$openstate.get(`gui/release/${this.happ_release.official_gui}`)
			    .then( async gui_release => {
				console.log("Previous GUI release:", gui_release );
				this.$openstate.get(`webasset/${gui_release.web_asset_id}`, {
				    "rememberState": false
				})
				    .then( webasset => {
					console.log("Previous GUI web asset:", webasset );
					this.previous_gui_hash	= webasset.mere_memory_hash;
				    });

				this.previous_gui	= await this.$openstate.get(`gui/${gui_release.for_gui}`);
			    });
		    }

		    // We will use the last release name as the default value for the next release.
		    // this.input.version		= this.happ_release.version;
		    this.input.ordering		= this.happ_release.ordering + 1;

		    log.info("Make reverse-lookup for previous DNAs:", this.happ_release );
		    this.happ_release.dnas.forEach( async dna_ref => {
			const prev_dna_info	= this.previous_dnas[dna_ref.role_name]	= this.copy( dna_ref );
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
		    console.log( this.bundle );
		    if ( this.bundle?.roles ) {
			for ( let role of this.bundle.roles ) {
			    console.log("Resetting role: %s", role );
			    role.saving			= false;
			    role.validated		= false;
			    role.selected_dna		= null;
			    role.selected_dna_version	= null;
			}
		    }

		    this.input				= {
			"version": "",
			"description": "",
			"ordering": 1,
			"manifest": null,
			"hdk_version": "0.1.0-beta",
			"dnas": [],
		    };

		    this.unpacking_webhapp		= false;
		    this.validated			= false;
		    this.zome_selection_confirmed	= false;
		    this.ready_for_review		= false;
		    this.select_dna_version_context	= null;
		    this.select_dna_context		= null;
		    this.select_zome_context		= null;

		    this.file_id			= "uploaded_happ_bundle";
		    this.skip_gui			= false;
		    this.previous_gui			= null;
		    this.previous_gui_hash		= null;
		    this.gui_file			= null;
		    this.gui_bytes			= null;

		    this.$store.dispatch("removeValue", [ "file", this.uploaded_file.hash ] );
		    this.$store.dispatch("removeValue", [ "file", this.file_id ] );

		    this.refresh();
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

		    try {
			await this.$store.dispatch("uploadFile", [ this.file_id, file ] );
			await this.$store.dispatch("unpackBundle", this.uploaded_file.hash );

			await this.delay();

			if ( this.bundle.type === "webhapp" ) {
			    this.unpacking_webhapp	= true;

			    log.info("Found web app bundle:", this.bundle );

			    const ui_file		= await this.bundle.ui.source();

			    log.debug("Set GUI:", this.bundle.ui );
			    this.set_gui({
				"name": this.bundle.ui.name,
				"size": ui_file.bytes.length,
			    }, ui_file.bytes );

			    if ( ui_file.bytes.length >= 10_000_000 )
				this.skip_gui		= true;

			    const happ_file		= await this.bundle.happ.source();
			    await this.bundle.happ.bundle();

			    this.file_id		= happ_file.hash;

			    this.unpacking_webhapp	= false;
			}

			log.normal("Uploaded hApp bundle:", this.bundle );
			if ( this.bundle.type !== "happ" ) {
			    alert(`Uploaded bundle is not a hApp bundle. found bundle type '${this.bundle.type}'`);
			    return this.reset_file();
			}

			await this.delay();
		    } catch ( err ) {
			console.log("Show unpacking error:", err );
			alert( err.message );
			this.reset_file();
		    }

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

			if ( this.previous_dnas[role.name] ) {
			    const prev_dna_ref			= this.previous_dnas[role.name];

			    log.normal("Previous role match '%s':", role.name, prev_dna_ref );
			    if ( prev_dna_ref.wasm_hash === role.hash ) {
				// Auto-select the previous role DNA Version
				this.$store.dispatch("getDnaVersion", prev_dna_ref.version )
				    .then( version => {
					const prop_changed	= JSON.stringify( version.properties ) === JSON.stringify( role.bundle.manifest.integrity.properties );

					log.info("Compare previous version DHT factors for '%s'", role.name );
					log.info("  - HDK Version  : (%s) %s === %s", version.hdk_version === this.input.hdk_version, version.hdk_version, this.input.hdk_version );
					log.info("  - Origin Time  : (%s) %s === %s", version.origin_time === role.bundle.manifest.integrity.origin_time, version.origin_time, role.bundle.manifest.integrity.origin_time );
					log.info("  - Network Seed : (%s) %s === %s", version.network_seed === role.bundle.manifest.integrity.network_seed, version.network_seed, role.bundle.manifest.integrity.network_seed );
					log.info("  - Properties   : (%s)", prop_changed );

					if ( version.hdk_version === this.input.hdk_version
					     && version.origin_time === role.bundle.manifest.integrity.origin_time
					     && version.network_seed === role.bundle.manifest.integrity.network_seed
					     && prop_changed ) {
					    this.select_dna_version( role, version );
					}
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

			    if ( this.previous_dnas[ role.name ] && this.previous_dnas[ role.name ].integrity_zomes[ zome_ref.name ] ) {
				const prev_zome		= this.previous_dnas[ role.name ].integrity_zomes[ zome_ref.name ];

				log.normal("Previous zome match (%s) in role '%s':", zome_ref.name, role.name, prev_zome );
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

			    if ( this.previous_dnas[ role.name ] && this.previous_dnas[ role.name ].zomes[ zome_ref.name ] ) {
				const prev_zome		= this.previous_dnas[ role.name ].zomes[ zome_ref.name ];

				log.normal("Previous zome match (%s) in role '%s':", zome_ref.name, role.name, prev_zome );
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
		    log.normal("Select DNA version for '%s':", upload.name, version );

		    upload.selected_dna_version = version;

		    if ( !this.input.hdk_version ) {
			this.input.hdk_version		= version.hdk_version;
		    }

		    this.select_dna_version_context	= null;
		    this.select_dna_version_modal.hide();
		},
		async unselect_dna_version ( upload ) {
		    log.normal("Unselect DNA version for '%s'", upload.name );

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
		    log.normal("Assign parent DNA for '%s':", role.name, dna );

		    role.selected_dna		= dna;
		    this.select_dna_context	= null;
		    this.select_dna_modal.hide();

		    const version		= await this.$store.dispatch("getLatestVersionForDna", [ dna.$id, null ]  );
		    role.ordering		= version ? version.ordering + 1 : 1;
		},
		async unassign_parent_dna_for ( role ) {
		    log.normal("Unassign parent DNA for '%s'", role.name );

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

		    if ( this.missingDnasOrGui() )
			return;

		    this.ready_for_review	= true;
		},

		async create_zome_version ( zome_info, zome_type ) {
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
				    "description": zome_info.description || "",
				    zome_type,
				}, 30_000
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
			    }, 30_000
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

		    const form			= this.dna_form( role.name );

		    log.info("Check DNA form validatity: %s", form.checkValidity() );
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
				    "description": role.description || "",
				}, 30_000
			    );
			    this.$store.dispatch("fetchDnasByName", role.name );
			}

			// Create the new version
			const version			= await this.$client.call(
			    "dnarepo", "dna_library", "create_dna_version", {
				"for_dna":		role.selected_dna.$id,
				"version":		role.version,
				"ordering":		role.ordering,
				"hdk_version":		this.input.hdk_version,
				"origin_time":		role.bundle.integrity.origin_time,
				"network_seed": 	role.bundle.integrity.network_seed,
				"properties":		role.bundle.integrity.properties,
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
			    }, 30_000
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
			log.normal("Creating hApp release: %s", this.input.version );

			console.log( this.bundle );
			const input			= {
			    "version":		this.input.version,
			    "description":	this.input.description,
			    "hdk_version":	this.input.hdk_version,
			    "ordering":		this.input.ordering,
			    "manifest":		this.bundle.manifest,
			    "dnas": this.bundle.roles.map( role => {
				const version		= role.selected_dna_version;
				return {
				    "role_name":	role.name,
				    "dna":		version.for_dna,
				    "version":		version.$id,
				    "wasm_hash":	version.wasm_hash,
				};
			    }),
			    "official_gui":	this.input.official_gui,
			};

			if ( !input.official_gui && this.skip_gui === false && this.gui_bytes ) {
			    this.next_gui.saving		= true;
			    try {
				const datapath			= `gui/release/${common.randomHex()}`;
				const gui_release$		= this.$openstate.mutable[ datapath ];
				gui_release$.version		= this.next_gui.version;

				if ( this.previous_gui )
				    gui_release$.for_gui	= this.previous_gui.$id;
				else {
				    const gui_datapath		= `gui/${common.randomHex()}`;
				    const gui$			= this.$openstate.mutable[ gui_datapath ];
				    gui$.name			= this.next_gui.name;
				    const gui			= await this.$openstate.write( gui_datapath );

				    this.$openstate.purge( gui_datapath );

				    gui_release$.for_gui	= gui.$id;
				}

				const webasset			= await this.createWebAsset( this.gui_bytes );
				gui_release$.web_asset_id	= webasset.$id;

				const gui_release		= await this.$openstate.write( datapath );

				this.$openstate.purge( datapath );

				input.official_gui		= gui_release.$id;
			    } catch ( err ) {
				log.error("Failed to create GUI Release:", err );
				throw err;
			    } finally {
				this.next_gui.saving		= false;
			    }
			}

			log.debug("Create hApp release '%s': (%s DNAs):", this.input.version, this.input.dnas.length, this.input );
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

		missingDnasOrGui () {
		    if ( !(this.bundle && this.bundle.roles) )
			return false;

		    for ( let role of this.bundle.roles ) {
			if ( !role.selected_dna_version )
			    return true;
		    }

		    if ( this.skip_gui === false && this.gui_bytes ) {
			if ( !this.previous_gui && !this.next_gui.name )
			    return true;

			if ( this.gui_bytes && !this.next_gui.version )
			    return true;
		    }

		    return false;
		},
		missingZomes ( role ) {
		    console.log("Check for missing zomes:", role );
		    if ( !role.bundle )
			return false;
		    if ( !(role.bundle.integrity?.zomes || role.bundle.coordinator?.zomes) )
			return true;

		    for ( let zome of role.bundle.integrity.zomes ) {
			if ( !zome.selected_zome_version )
			    return true;
		    }

		    for ( let zome of role.bundle.coordinator.zomes ) {
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
		    const gui_hash		= common.toHex( common.digest( this.gui_bytes ) );

		    console.log("Comparing previous GUI hash: (%s) %s === %s", this.previous_gui_hash === gui_hash, this.previous_gui_hash, gui_hash );
		    if ( this.previous_gui_hash === gui_hash ) {
			this.skip_gui		= true;
			this.input.official_gui	= this.happ_release.official_gui;
		    }
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
