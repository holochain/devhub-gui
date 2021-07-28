
const YAML				= require('yaml');
const { Client, logging }		= require('@holochain/devhub-entities');
const { HoloHash }			= require('@whi/holo-hash');

const notify				= require('./notify.js');
const { object_sorter,
	load_file,
	b64 }				= require('./utils.js');

logging();

const PORT				= 44001;


const AGENT_HASH			= b64( process.env.AGENT_HASH );
const DNAREPO_HASH			= b64( process.env.DNAREPO_HASH );
const HAPPS_HASH			= b64( process.env.HAPPS_HASH );

const client				= new Client( PORT, HAPPS_HASH, AGENT_HASH );

module.exports = async function () {
    await client.connect();

    const happs = {
	"template": (await import("./templates/happs.html")).default,
	"data": function() {
	    return {
		"happs": [],
	    };
	},
	async created () {
	    this.$root.setToolbarControls(null, [{
		"path": "/happ/new",
		"title": "Create New hApp",
		"icon": "plus-square",
	    }]);
	    await this.refresh();
	},
	"methods": {
	    async refresh () {
		console.log("Getting hApp list...");
		let happs		= await client.call( "store", "get_my_happs");
		console.log("My hApp list:", happs );
		this.happs		= happs.sort( object_sorter("published_at") ).reverse();
	    },
	},
    };

    const create_happ = {
	"template": (await import("./templates/happ-create.html")).default,
	"data": function() {
	    return {
		"happ": {
		    "title": "Chess",
		    "subtitle": "Super fun board game",
		    "description": "Play chess with friends :)",
		},
	    };
	},
	async created () {
	    this.$root.setToolbarControls([{
		"path": "/happs",
		"title": "Back to Dashboard",
		"icon": "arrow-left-square",
	    }], [{
		"path": "/happs",
		"title": "Cancel",
		"icon": "x-square",
	    }, "-", {
		"action": this.save,
		"title": "Save",
		"icon": "check-square-fill",
	    }]);
	},
	"methods": {
	    async save () {
		console.log("Creating hApp with input:", this.happ );
		try {
		    let happ			= await client.call( "store", "create_happ", this.happ );
		    console.log("Created hApp:", happ );

		    notify.success("Created new hApp...");
		    this.$router.push("/happs");
		} catch (err) {
		    console.error( err );
		    notify.open({
			type: "error",
			message: `Failed to create hApp - ${err.toString()}`,
		    });
		}
	    }
	},
    };

    const happ_single = {
	"template": (await import("./templates/happ-single.html")).default,
	"data": function() {
	    return {
		"id": null,
		"happ": null,
		"releases": [],
		"deprecation_prompt": null,
		"deprecation": {
		    "message": null,
		},
	    };
	},
	"watch": {
	    happ () {
		this.setToolbar();
	    },
	},
	async created () {
	    this.id				= new HoloHash( this.$route.params.entry_hash );
	    await this.refresh();
	    this.setToolbar();
	},
	"methods": {
	    setToolbar () {
		let bottom_controls		= [{
		    "path": "/happ/" + this.id + "/edit",
		    "title": "Edit",
		    "icon": "pencil-square",
		}];

		if ( !this.happ.deprecation ) {
		    bottom_controls.unshift({
			"action": this.deprecatePrompt,
			"title": "Deprecate",
			"icon": "trash",
		    }, "-");
		}

		this.$root.setToolbarControls([{
		    "path": "/happs",
		    "title": "Back to hApps",
		    "icon": "arrow-left-square",
		}], bottom_controls );
	    },
	    deprecationModal () {
		if ( this.deprecation_prompt === null )
		    this.deprecation_prompt = new bootstrap.Modal( document.getElementById("happ-deprecation-modal") );

		return this.deprecation_prompt;
	    },
	    async refresh () {
		console.log("Get hApp: (%s) %s", typeof this.id, this.id.toString() );
		this.happ			= await client.call("store", "get_happ", {
		    "id": this.id,
		});
		let releases			= await client.call("store", "get_happ_releases", {
		    "for_happ": this.happ.$id,
		});
		console.log("Releases for hApp (%s):", this.id, releases );
		this.releases			= releases.sort( object_sorter("published_at") ).reverse();
	    },
	    async deprecatePrompt () {
		let modal			= this.deprecationModal();
		modal.show();
	    },
	    async confirmDeprecation () {
		console.log("Deprecating now...", this.deprecation );
		this.happ			= await client.call("store", "deprecate_happ", {
		    "addr": this.id,
		    "message": this.deprecation.message,
		});
		this.deprecation		= {
		    "message": null,
		};

		let modal			= this.deprecationModal();
		modal.hide();
	    },
	},
    };

    const create_release = {
	"template": (await import("./templates/happ-release-create.html")).default,
	"data": function() {
	    return {
		"id": null,
		"happ_release": {
		    "name": null,
		    "description": null,
		    "for_happ": null,
		    "manifest_yaml": null,
		    "resources": {},
		},
		"manifest": null,
		"published_date": (new Date()).toISOString().slice(0,10),
	    };
	},
	async created () {
	    this.id				= new HoloHash( this.$route.params.entry_hash );
	    this.happ_release.for_happ		= this.id;

	    this.$root.setToolbarControls([{
		"path": "/happ/" + this.id,
		"title": "Back to hApp",
		"icon": "arrow-left-square",
	    }], [{
		"path": "/happ/" + this.id,
		"title": "Cancel",
		"icon": "x-square",
	    }, "-", {
		"action": this.save,
		"title": "Save",
		"icon": "check-square-fill",
	    }]);
	},
	"methods": {
	    async fileSelected ( event ) {
		let files			= event.target.files;
		let encoder			= new TextDecoder("utf8");
		let bytes			= await load_file( files[0] );
		let yaml			= encoder.decode( bytes );

		this.manifest			= YAML.parse( yaml );

		this.happ_release.name		= this.manifest.name;
		this.happ_release.description	= this.manifest.description;
		this.happ_release.manifest_yaml	= yaml;
	    },
	    async save () {
		let input			= this.happ_release;
		let slots			= this.manifest.slots.map( slot => slot.id );

		for ( let slot of slots ) {
		    try {
			new HoloHash( input.resources[slot] );
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Missing slot resource for '${slot}'`,
			});
			return;
		    }
		}

		console.log("Creating hApp Release with input:", input );
		try {
		    input.published_at = (new Date( this.published_date + "T00:00:00.000Z" )).getTime();

		    let happ_release		= await client.call( "store", "create_happ_release", input );
		    console.log("Created hApp Release:", happ_release );

		    notify.success("Created new hApp Release...");
		    this.$router.push( "/happ/" + this.id );
		} catch (err) {
		    console.error( err );
		    notify.open({
			type: "error",
			message: `Failed to create hApp Release - ${err.toString()}`,
		    });
		}
	    }
	},
    };

    const release_single = {
	"template": (await import("./templates/happ-release-single.html")).default,
	"data": function() {
	    return {
		"id": null,
		"happ_release": null,
		"delete_prompt": null,
		"delete_reason": null,
	    };
	},
	async created () {
	    this.id				= new HoloHash( this.$route.params.entry_hash );
	    await this.refresh();

	    this.$root.setToolbarControls([{
		"path": "/happ/" + this.happ_release.for_happ.$id,
		"title": "Back to hApp",
		"icon": "arrow-left-square",
	    }], [{
		"action": this.deletePrompt,
		"title": "Delete",
		"icon": "trash",
	    }, "-", {
		"path": "/happ/release/" + this.id + "/edit",
		"title": "Edit",
		"icon": "pencil-square",
	    }]);
	},
	"methods": {
	    deleteModal () {
		if ( this.delete_prompt === null )
		    this.delete_prompt = new bootstrap.Modal( document.getElementById("happ-release-delete-modal") );

		return this.delete_prompt;
	    },
	    async refresh () {
		this.happ_release		= await client.call( "store", "get_happ_release", {
		    "id": this.id,
		});
		console.log( this.happ_release );
	    },
	    async download () {
		let happ_pack_bytes		= await client.call( "store", "get_release_package", {
		    "id": this.id,
		    "dnarepo_dna_hash": DNAREPO_HASH,
		});
		console.log("Received package bytes (%s bytes):", happ_pack_bytes.length, happ_pack_bytes );

		let blob			= new Blob([ new Uint8Array(happ_pack_bytes) ]);
		let link			= document.createElement("a");
		link.href			= URL.createObjectURL(blob);

		let filename			= this.happ_release.for_happ.title.replace(/[/\\?%*:|"<>]/g, '_');
		link.download			= `${filename}-${this.happ_release.name}.happ`;
		link.click();
	    },
	    async deletePrompt () {
		let modal			= this.deleteModal();
		modal.show();
	    },
	    async confirmDelete () {
		console.log("Deleting now...", this.delete_reason );
		try {
		    await client.call( "store", "delete_happ_release", {
			"addr": this.id,
			"message": this.delete_reason,
		    });
		    let modal		= this.deleteModal();
		    modal.hide();

		    notify.success("Deleted hApp Release...");
		    this.$router.push("/happ/" + this.happ_release.for_happ.$id );
		} catch (err) {
		    console.error( err );
		    notify.open({
			type: "error",
			message: `Failed to delete hApp Release - ${err.toString()}`,
		    });
		}
	    },
	},
    };

    return {
	happs,
	create_happ,
	happ_single,
	create_release,
	release_single,
    };
};
