const { Logger }			= require('@whi/weblogger');
const log				= new Logger("dna versions");

const common				= require('./common.js');


module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await common.load_html("/templates/dnas/versions/create.html"),
	    "data": function() {
		const dna_id		= this.getPathId("dna");

		return {
		    dna_id,
		    "dna_datapath":		`dna/${dna_id}`,
		    "dna_version_datapath":	`dna/version/new`,
		    "error":			null,
		    "added_zomes":		[],
		    "zome_search_text":		"",
		    "change_version_context":	null,
		    "hdk_version_cache":	{},
		};
	    },
	    "watch": {
		"version$.hdk_version" ( new_hdk_version, old_hdk_version ) {
		    console.log("Changed HDK Version from %s to %s", old_hdk_version, new_hdk_version );

		    if ( old_hdk_version ) {
			this.hdk_version_cache[ old_hdk_version ] = {
			    "added_zomes":		this.added_zomes,
			    "integrity_versions":	this.version$.integrity_zomes,
			    "coordinator_versions":	this.version$.zomes,
			};
		    }

		    if ( new_hdk_version ) {
			const cache			= this.hdk_version_cache[ new_hdk_version ];

			if ( cache ) {
			    this.added_zomes			= cache.added_zomes;
			    this.version$.integrity_zomes	= cache.integrity_versions;
			    this.version$.zomes			= cache.coordinator_versions;
			    return;
			}
		    }

		    this.added_zomes			= [];
		    this.version$.integrity_zomes	= [];
		    this.version$.zomes			= [];
		},
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.dna_datapath,		"dna", { "get": true } ),
		...common.scopedPathComputed( c => c.dna_version_datapath,	"version" ),
		...common.scopedPathComputed( `dnarepo/hdk/versions`,		"previous_hdk_versions", { "get": true }),

		hdkzomes_datapath () {
		    return `hdk/${this.version$.hdk_version}/zomes`;
		},
		...common.scopedPathComputed( c => `${c.hdkzomes_datapath}/integrity`,		"compatible_integrity_zomes", {
		    "default": [],
		    state ( list ) {
			return list
			    .filter( this.nameFilter( this.zome_search_text ) )
			    .filter( this.addedFilter );
		    },
		}),
		...common.scopedPathComputed( c => `${c.hdkzomes_datapath}/coordinator`,	"compatible_coordinator_zomes", {
		    "default": [],
		    state ( list ) {
			return list
			    .filter( this.nameFilter( this.zome_search_text ) )
			    .filter( this.addedFilter );
		    },
		}),
		altversions_path () {
		    if ( this.change_version_context ) {
			const [ index, zome_list ]	= this.change_version_context;
			const zome_ref			= zome_list[ index ];
			return `zome/${zome_ref.zome}/versions/hdk/${this.version$.hdk_version}`;
		    }

		    return this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.altversions_path,		"alternative_versions", {
		    "default": [],
		    state ( list ) {
			console.log("alternative_versions", list );
			return list
		    },
		}),

		change_version_modal () {
		    return this.$refs["changeVersion"].modal;
		},
	    },
	    async created () {
		window.DnaVersionCreate = this;
		this.mustGet(async () => {
		    await this.$openstate.get( this.dna_datapath );
		});
		this.version$.for_dna	= this.dna_id;

		const version		= await this.$openstate.read(`dna/${this.dna_id}/versions/latest`);
		this.version$.ordering	= version ? version.ordering + 1 : 1;
	    },
	    "methods": {
		nameFilter ( search_text ) {
		    return ( item ) => {
			if ( !search_text )
			    return true;
			return item.name.toLowerCase().includes( search_text.toLowerCase() );
		    };
		},
		addedFilter ( item ) {
		    return !this.added_zomes.find( id => id === String(item.$id) );
		},
		async getZomesByHDKVersion ( hdk_version ) {
		    this.$openstate.read(`hdk/${hdk_version}/zomes/integrity`);
		    this.$openstate.read(`hdk/${hdk_version}/zomes/coordinator`);
		},

		addZomeAction ( zome, zome_list ) {
		    return {
			"icon": "plus-lg",
			"title": "Add Zome",
			"method": () => {
			    this.addZome( zome, zome_list );
			},
		    };
		},
		async addZome ( zome, zome_list ) {
		    log.info("Reset search");
		    this.zome_search_text	= "";

		    if ( this.zomeIsAdded( zome.$id ) )
			return;

		    // Get latest version for a specific HDK Version
		    const latest_version	= await this.$openstate.read(`zome/${zome.$id}/versions/hdk/${this.version$.hdk_version}/latest`);

		    log.normal("Adding zome version:", zome, latest_version );
		    this.added_zomes.push( String(zome.$id) );

		    zome_list.push({
			"name":		zome.name.toLowerCase().replace(/[/\\?%*:|"<> ]/g, '_'),
			"zome":		zome.$id,
			"version":	latest_version.$id,
			"resource":	latest_version.mere_memory_addr,
			"resource_hash":latest_version.mere_memory_hash,
			"dependencies":	[],
		    });
		},
		zomeIsAdded ( zome_id ) {
		    return !!this.added_zomes.find( id => id === String(zome_id) );
		},

		zomeCardActions ( index, zome_list ) {
		    log.info("Configuring zome card actions for:", index );
		    return [
			this.changeZomeVersionAction( index, zome_list ),
			this.removeZomeAction( index, zome_list ),
		    ];
		},
		changeZomeVersionAction ( index, zome_list ) {
		    const zome_ref		= zome_list[ index ];
		    const versions		= this.$openstate.state[`zome/${zome_ref.zome}/versions/hdk/${this.version$.hdk_version}`];

		    return {
			"hide": versions.length < 2,
			"title": "Select a different version",
			"icon": "layers-half",
			"method": () => {
			    this.change_version_context		= [ index, zome_list, zome_ref.name ];
			    this.change_version_modal.show();
			},
		    };
		},
		selectNewVersion ( version ) {
		    const [ index, zome_list ]		= this.change_version_context;

		    zome_list[ index ].version		= version.$id;
		    zome_list[ index ].resource		= version.mere_memory_addr;
		    zome_list[ index ].resource_hash	= version.mere_memory_hash;

		    this.change_version_context		= null;
		    this.change_version_modal.hide();
		},
		removeZomeAction ( i, zome_list ) {
		    return {
			"icon": "x-lg",
			"title": "Remove Zome Version",
			"method": () => {
			    this.removeZome( i, zome_list );
			},
		    };
		},
		removeZome ( i, zome_list ) {
		    const zome_ref		= zome_list[ i ];
		    const zome_i		= this.added_zomes.indexOf( String(zome_ref.zome) );

		    this.added_zomes.splice( zome_i, 1 );
		    zome_list.splice( i, 1 );
		},

		async create () {
		    try {
			await this.$openstate.write( this.dna_version_datapath );

			const new_id		= this.version.$id;

			this.$openstate.read(`dna/${this.dna_id}/versions`);
			this.$openstate.purge( this.dna_version_datapath );

			this.$router.push( `/dnas/${this.dna_id}/versions/${new_id}` );
		    } catch ( err ) {
			log.error("Failed to create DNA Version:", err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/dnas/versions/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const dna_id		= this.getPathId("dna");

		return {
		    id,
		    dna_id,
		    "datapath":			`dna/version/${id}`,
		    "dna_datapath":		`dna/${dna_id}`,
		    "bundle_datapath":		`dna/version/${id}/bundle`,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await Promise.all([
			this.$openstate.get( this.datapath ),
			this.$openstate.get( this.dna_datapath ),
		    ]);
		});
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath,		"version", { "get": true } ),
		...common.scopedPathComputed( c => c.dna_datapath,	"dna", { "get": true } ),
		...common.scopedPathComputed( c => c.bundle_datapath,	"package_bytes" ),

		modal () {
		    return this.$refs["modal"].modal;
		},

		package_filename () {
		    if ( !this.dna )
			return "DNA Package";

		    const filename	= this.dna.name.replace(/[/\\?%*:|"<>]/g, '_');
		    return `${filename}_v${this.version.version}.dna`;
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.dna_datapath );
		},
		async downloadPackageBytes () {
		    try {
			const bytes		= await this.$openstate.get( this.bundle_datapath, {
			    "rememberState": false,
			});

			this.download( this.package_filename, bytes );
		    } catch (err) {
			log.error("Failed to get wasm bytes for zome version(%s): %s", String(this.id), err.message, err );
		    }
		},
		async unpublish () {
		    await this.$openstate.delete( this.datapath );

		    this.modal.hide();

		    this.$openstate.read(`dna/${this.dna_id}/versions`);
		    this.$router.push( `/dnas/${this.dna_id}` );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/dnas/versions/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const dna_id		= this.getPathId("dna");

		return {
		    id,
		    dna_id,
		    "error": null,
		    "show_changelog_preview": false,

		    "dnapath":			`dna/${dna_id}`,
		    "versionpath":		`dna/version/${id}`,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.dnapath,			"dna", { "get": true } ),
		...common.scopedPathComputed( c => c.versionpath,		"version", { "get": true } ),

		preview_toggle_text () {
		    return this.show_changelog_preview ? "editor" : "preview";
		}
	    },
	    async created () {
		await this.mustGet(async () => {
		    await Promise.all([
			this.$openstate.get( this.versionpath ),
			this.$openstate.get( this.dnapath ),
		    ]);
		});
	    },
	    "methods": {
		toggleChangelogPreview () {
		    this.show_changelog_preview = !this.show_changelog_preview;
		    this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.version$.changelog_html = common.mdHTML( this.version$.changelog );
		},
		async update () {
		    try {
			await this.$openstate.write( this.versionpath );

			this.$openstate.read(`dna/${this.dna_id}/versions`);
			this.$router.push( `/dnas/${this.dna_id}/versions/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update DNA Version (%s):", String(this.id), err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function upload () {
	return {
	    "template": await common.load_html("/templates/dnas/versions/upload.html"),
	    "data": function() {
		return {
		    "id": null,
		    "error": null,
		    "input": {
			"version": "",
			"ordering": 1,
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
		    this.input.ordering		= this.dna_version.ordering + 1;
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
		    if ( this.bundle.integrity.zomes ) {
			for ( let zome of this.bundle.integrity.zomes ) {
			    zome.saving			= false;
			    zome.validated		= false;
			    zome.selected_zome		= null;
			    zome.selected_zome_version	= null;
			}
		    }

		    if ( this.bundle.coordinator.zomes ) {
			for ( let zome of this.bundle.coordinator.zomes ) {
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
		    await this.delay();
		    await this.$store.dispatch("unpackBundle", this.uploaded_file.hash );
		    await this.delay();

		    if ( this.bundle.type !== "dna" ) {
			alert(`Uploaded bundle is not a DNA bundle. found bundle type '${this.bundle.type}'`);
			return this.reset_file();
		    }

		    console.log( this.bundle );

		    this.input.origin_time	= this.bundle.integrity.origin_time;

		    if ( this.bundle.integrity.network_seed )
			this.input.network_seed	= this.bundle.integrity.network_seed;
		    if ( this.bundle.integrity.properties )
			this.input.properties	= Object.assign( {}, this.bundle.integrity.properties );

		    this.bundle.integrity.zomes.forEach( async zome => {
			zome.ordering		= 1;

			// Search for existing zomes with the same name
			this.$store.dispatch("fetchZomesByName", zome.name );
			this.$store.dispatch("fetchZomeVersionsByHash", zome.hash );
		    });

		    this.bundle.coordinator.zomes.forEach( async zome => {
			zome.ordering		= 1;

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
		    for ( let zome of this.bundle.integrity.zomes ) {
			if ( zome.selected_zome_version )
			    empty			= false;
		    }

		    for ( let zome of this.bundle.coordinator.zomes ) {
			if ( zome.selected_zome_version )
			    empty			= false;
		    }

		    if ( empty )
			this.lock_hdk_version_input	= false;

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

		async readyForReview () {
		    this.validated		= true;

		    if ( this.missingZomes() )
			return;

		    this.ready_for_review	= true;
		},

		async create_zome_version ( zome_info, zome_type ) {
		    this.validated		= true;
		    zome_info.validated		= true;

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
				    "description": zome_info.description || "",
				    zome_type,
				}
			    );
			    this.$store.dispatch("fetchZomesByName", zome_info.name );
			}

			this.lock_hdk_version_input	= true;
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

			log.debug("Create DNA version #%s: (%s zomes):", this.input.version, this.bundle.integrity.zomes.length + this.bundle.coordinator.zomes.length, this.input );
			const input			= {
			    "version": String( this.input.version ),
			    "ordering":	this.input.ordering,
			    "hdk_version": this.input.hdk_version,
			    "origin_time": this.input.origin_time,
			    "network_seed": this.input.network_seed,
			    "properties": this.input.properties,
			    "changelog": this.input.changelog,
			    "integrity_zomes": this.bundle.integrity.zomes.map( info => {
				const zome		= info.selected_zome;
				const version		= info.selected_zome_version;
				return {
				    "name":		info.name,
				    "zome":		version.for_zome,
				    "version":		version.$id,
				    "resource":		version.mere_memory_addr,
				    "resource_hash":	version.mere_memory_hash,
				};
			    }),
			    "zomes": this.bundle.coordinator.zomes.map( info => {
				const zome		= info.selected_zome;
				const version		= info.selected_zome_version;
				return {
				    "name":		info.name,
				    "zome":		version.for_zome,
				    "version":		version.$id,
				    "resource":		version.mere_memory_addr,
				    "resource_hash":	version.mere_memory_hash,
				    "dependencies":	Object.values( info.dependencies ).map( ref => ref.name ),
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

		    for ( let zome of this.bundle.integrity.zomes ) {
			if ( !zome.selected_zome_version )
			    return true;
		    }

		    for ( let zome of this.bundle.coordinator.zomes ) {
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
