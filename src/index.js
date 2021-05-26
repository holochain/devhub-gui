
window.Buffer					= require('buffer/').Buffer;
const Vue					= require('vue');
const Vuex					= require('vuex');
const createLogger				= require('vuex/dist/logger');
const { mapState,
	mapMutations,
	mapActions }				= require('vuex');
const VueRouter					= require('vue-router').default;
const VueMoment					= require('vue-moment').default;

const notify					= require('./notify.js');
const orm					= require('./api_orm.js');


Vue.use( Vuex );
Vue.use( VueRouter );
Vue.use( VueMoment );


Vue.filter("number", function (value) {
    return (new Number(value)).toLocaleString();
});


function b64 ( input ) {
    return typeof input === "string"
	? Buffer.from( input, "base64" )
	: Buffer.from( input ).toString("base64");
}

function object_sorter (key) {
    return (a,b) => {
	if ( a[key] === undefined )
	    return b[key] === undefined ? 0 : -1;
	return a[key] < b[key]
	    ? -1
	    : a[key] > b[key] ? 1 : 0;
    };
}

function load_file ( file ) {
    console.log( file );
    return new Promise((f,r) => {
	let reader			= new FileReader();

	reader.readAsArrayBuffer( file );
	reader.onerror			= function (err) {
	    console.log("error:", err );

	    r( err );
	};
	reader.onload			= function (evt) {
	    console.log("load:", evt );
	    let result			= new Uint8Array( evt.target.result );
	    console.log( result );

	    f( result );
	};
	reader.onprogress		= function (p) {
	    console.log("progress:", p );
	};
    });
}


(async function(global) {
    const PORT					= 44001;
    const AGENT_HASH				= b64("hCAkFic1hM2iG44c17eTdrp5mCQiys45qgGA8n3LS0UrcaslwwjN");
    const DNAREPO_HASH				= b64( process.env.DNAREPO_HASH );

    const DevHub				= await orm.connect( PORT, AGENT_HASH, {
	"dnas": DNAREPO_HASH,
    });
    console.log("ORM Object:", DevHub );


    const store					= new Vuex.Store({
	plugins: process.env.NODE_ENV !== 'production' ? [
	    createLogger({ collapsed: true, })
	] : [],
	state: () => { return {
	    "whoami":	null,
	}; },
	mutations: {
	    set_whoami: function ( state, payload ) {
		if ( payload.id === -1 )
		    payload			= null;
		state.whoami			= payload;
	    },
	},
	actions: {
	    get_whoami: async function ( ctx ) {
		return ctx.commit("set_whoami", "Someone" );
	    },

	    // DNAs
	    list_my_dnas: async function ( ctx ) {
		return await DevHub.myDNAs();
	    },
	    create_dna: async function ( ctx, input ) {
		return await DevHub.createDNA( input );
	    },
	    get_dna: async function ( ctx, { hash } ) {
		return await DevHub.getDNA( hash );
	    },
	    update_dna: async function ( ctx, [hash, input] ) {
		return await DevHub.updateDNA( hash, input );
	    },
	    deprecate_dna: async function ( ctx, [hash, reason] ) {
		return await DevHub.deprecateDNA( hash, reason );
	    },

	    // DNA Versions
	    create_dna_version: async function ( ctx, input ) {
		return await DevHub.createDNAVersion( input );
	    },
	    get_dna_version: async function ( ctx, { hash } ) {
		return await DevHub.getDNAVersion( hash );
	    },
	    update_dna_version: async function ( ctx, [hash, input] ) {
		return await DevHub.updateDNAVersion( hash, input );
	    },
	    delete_dna_version: async function ( ctx, { hash } ) {
		return await DevHub.deleteDNAVersion( hash );
	    },
	    get_dna_chunk: async function ( ctx, { hash } ) {
		return await DevHub.getDNAChunk( hash );
	    },
	},
    });


    const routeComponents			= {
	"/": {
	    "template": (await import("./templates/home.html")).default,
	    "data": function() {
		return {
		    "dnas": [],
		};
	    },
	    async created () {
		this.$root.setToolbarControls(null, [{
		    "path": "/dna/new",
		    "title": "Create New DNA",
		    "icon": "plus-square",
		}]);
		await this.refresh();
	    },
	    "computed": {
		...mapState([
		    "whoami",
		]),
	    },
	    "methods": {
		async refresh () {
		    let dnas			= await this.$store.dispatch("list_my_dnas");
		    this.dnas			= Object.values( dnas ).map(dna => {
			dna.hash		= b64( dna.id );
			return dna;
		    }).sort( object_sorter("published_at") ).reverse();
		},
		...mapActions([
		]),
	    },
	},
	"/dna/new": {
	    "template": (await import("./templates/dna-create.html")).default,
	    "data": function() {
		return {
		    "dna": {
			"developer": {},
		    },
		};
	    },
	    async created () {
		this.$root.setToolbarControls([{
		    "path": "/",
		    "title": "Back to Dashboard",
		    "icon": "arrow-left-square",
		}], [{
		    "path": "/",
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
		    console.log("Creating DNA with input:", this.dna );
		    try {
			let dna			= await this.$store.dispatch("create_dna", this.dna );
			console.log("Created DNA:", dna );

			notify.success("Created new DNA...");
			this.$router.push("/");
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Failed to create DNA - ${err.toString()}`,
			});
		    }
		}
	    },
	},
	"/dna/:entry_hash": {
	    "template": (await import("./templates/dna-single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna": null,
		    "next_version": null,
		    "versions": [],
		    "deprecation_prompt": null,
		    "deprecation": {
			"reason": null,
		    },
		};
	    },
	    "watch": {
		dna () {
		    this.setToolbar();
		},
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		await this.refresh();
		this.setToolbar();
	    },
	    "methods": {
		setToolbar () {
		    let bottom_controls		= [{
			"path": "/dna/" + encodeURIComponent(this.id) + "/edit",
			"title": "Edit",
			"icon": "pencil-square",
		    }];

		    if ( !this.dna.deprecation ) {
			bottom_controls.unshift({
			    "action": this.deprecatePrompt,
			    "title": "Deprecate",
			    "icon": "trash",
			}, "-");
		    }

		    this.$root.setToolbarControls([{
			"path": "/",
			"title": "Back to Dashboard",
			"icon": "arrow-left-square",
		    }], bottom_controls );
		},
		deprecationModal () {
		    if ( this.deprecation_prompt === null )
			this.deprecation_prompt = new bootstrap.Modal( document.getElementById("dna-deprecation-modal") );

		    return this.deprecation_prompt;
		},
		async refresh () {
		    let dna_obj			= await this.$store.dispatch("get_dna", { "hash": this.id });
		    this.dna			= dna_obj.toJSON();
		    this.versions		= Object.values( await dna_obj.versions() ).map(dv => {
			dv.hash			= b64( dv.id );
			return dv;
		    }).sort( object_sorter("version") ).reverse();
		    this.next_version		= Object.values(this.versions).reduce((acc, dv) => dv.version > acc ? dv.version : acc, 0) + 1;
		},
		async deprecatePrompt () {
		    let modal			= this.deprecationModal();
		    modal.show();
		},
		async confirmDeprecation () {
		    console.log("Deprecating now...", this.deprecation );
		    this.dna			= (await this.$store.dispatch("deprecate_dna", [this.id, this.deprecation.reason])).toJSON();
		    this.deprecation		= {
			"reason": null,
		    };

		    let modal			= this.deprecationModal();
		    modal.hide();
		},
	    },
	},
	"/dna/:entry_hash/edit": {
	    "template": (await import("./templates/dna-update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna": null,
		};
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		this.$root.setToolbarControls([{
		    "path": "/dna/" + encodeURIComponent(this.id),
		    "title": "Back to Dashboard",
		    "icon": "arrow-left-square",
		}], [{
		    "path": "/dna/" + encodeURIComponent(this.id),
		    "title": "Cancel",
		    "icon": "x-square",
		}, "-", {
		    "action": this.save,
		    "title": "Save",
		    "icon": "check-square-fill",
		}]);
		await this.refresh();
	    },
	    "methods": {
		async refresh () {
		    let dna_obj			= await this.$store.dispatch("get_dna", { "hash": this.id });
		    this.dna			= dna_obj.toJSON();
		},
		async save () {
		    console.log("Updating DNA:", this.id );
		    console.log("Updating DNA with input:", this.dna );
		    try {
			let dna			= await this.$store.dispatch("update_dna", [this.id, this.dna] );
			console.log("Updated DNA:", dna );

			notify.success("Updated DNA...");
			this.$router.push("/dna/" + encodeURIComponent(this.id) );
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Failed to update DNA - ${err.toString()}`,
			});
		    }
		}
	    },
	},
	"/dna/:entry_hash/version/new": {
	    "template": (await import("./templates/dna-version-create.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna_version": {},
		    "published_date": (new Date()).toISOString().slice(0,10),
		};
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		this.dna_version.for_dna	= b64( this.id );
		this.dna_version.version	= parseInt(this.$route.query.version) || 1;

		this.$root.setToolbarControls([{
		    "path": "/dna/" + encodeURIComponent(this.id),
		    "title": "Back to DNA",
		    "icon": "arrow-left-square",
		}], [{
		    "path": "/dna/" + encodeURIComponent(this.id),
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
		    this.dna_version.bytes	= await load_file( files[0] );
		},
		async save () {
		    console.log("Creating DNA Version with input:", this.dna_version );
		    let input			= this.dna_version;
		    try {
			input.published_at = (new Date( this.published_date + "T00:00:00.000Z" )).getTime();

			let dna_version		= await this.$store.dispatch("create_dna_version", input );
			console.log("Created DNA Version:", dna_version );

			notify.success("Created new DNA Version...");
			this.$router.push("/dna/" + encodeURIComponent(this.id) );
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Failed to create DNA Version - ${err.toString()}`,
			});
		    }
		}
	    },
	},
	"/dna/version/:entry_hash": {
	    "template": (await import("./templates/dna-version-single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna_version": null,
		    "delete_prompt": null,
		    "delete_reason": null,
		};
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		await this.refresh();

		this.$root.setToolbarControls([{
		    "path": "/dna/" + encodeURIComponent( b64( this.dna_version.for_dna.id ) ),
		    "title": "Back to DNA",
		    "icon": "arrow-left-square",
		}], [{
		    "action": this.deletePrompt,
		    "title": "Delete",
		    "icon": "trash",
		}, "-", {
		    "path": "/dna/version/" + encodeURIComponent(this.id) + "/edit",
		    "title": "Edit",
		    "icon": "pencil-square",
		}]);
	    },
	    "methods": {
		deleteModal () {
		    if ( this.delete_prompt === null )
			this.delete_prompt = new bootstrap.Modal( document.getElementById("dna-version-delete-modal") );

		    return this.delete_prompt;
		},
		async refresh () {
		    let version_obj		= await this.$store.dispatch("get_dna_version", { "hash": this.id });
		    this.dna_version		= version_obj.toJSON();
		    console.log( this.dna_version );
		},
		async download () {
		    let chunks			= [];
		    for ( let chunk_hash of this.dna_version.chunk_addresses ) {
			let $chunk		= await this.$store.dispatch("get_dna_chunk", { "hash": chunk_hash });
			chunks.push( $chunk.toJSON().bytes );
		    }
		    console.log( chunks );

		    let blob			= new Blob(chunks);
		    let link			= document.createElement("a");
		    link.href			= URL.createObjectURL(blob);

		    let filename		= this.dna_version.for_dna.name.replace(/[/\\?%*:|"<>]/g, '_');
		    link.download		= `${filename}-v${this.dna_version.version}.dna`;
		    link.click();
		},
		async deletePrompt () {
		    let modal			= this.deleteModal();
		    modal.show();
		},
		async confirmDelete () {
		    console.log("Deleting now...", this.delete_reason );
		    try {
			await this.$store.dispatch("delete_dna_version", { "hash": this.id });
			let modal		= this.deleteModal();
			modal.hide();

			notify.success("Deleted DNA Version...");
			this.$router.push("/dna/" + encodeURIComponent( b64( this.dna_version.for_dna.id ) ) );
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Failed to delete DNA Version - ${err.toString()}`,
			});
		    }
		},
	    },
	},
	"/dna/version/:entry_hash/edit": {
	    "template": (await import("./templates/dna-version-update.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna_version": null,
		    "published_date": null,
		};
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		this.$root.setToolbarControls([{
		    "path": "/dna/version/" + encodeURIComponent(this.id),
		    "title": "Back to DNA Version",
		    "icon": "arrow-left-square",
		}], [{
		    "path": "/dna/version/" + encodeURIComponent(this.id),
		    "title": "Cancel",
		    "icon": "x-square",
		}, "-", {
		    "action": this.save,
		    "title": "Save",
		    "icon": "check-square-fill",
		}]);
		await this.refresh();
	    },
	    "methods": {
		async refresh () {
		    let version_obj		= await this.$store.dispatch("get_dna_version", { "hash": this.id });
		    this.dna_version		= version_obj.toJSON();
		    this.published_date		= (new Date(this.dna_version.published_at)).toISOString().slice(0,10);
		},
		async save () {
		    console.log("Updating DNA Version:", this.id );
		    let input			= this.dna_version;
		    console.log("Updating DNA Version with input:", input );
		    try {
			input.published_at = (new Date( this.published_date + "T00:00:00.000Z" )).getTime();
			let dna			= await this.$store.dispatch("update_dna_version", [this.id, input] );
			console.log("Updated DNA Version:", dna );

			notify.success("Updated DNA Version...");
			this.$router.push("/dna/version/" + encodeURIComponent(this.id) );
		    } catch (err) {
			console.error( err );
			notify.open({
			    type: "error",
			    message: `Failed to update DNA Version - ${err.toString()}`,
			});
		    }
		}
	    },
	},
    };

    const routes				= [];
    for (let [ path, component ] of Object.entries( routeComponents )) {
	routes.push({ path, component });
    }
    console.log("Vue.js routers config:", routes );

    const router				= new VueRouter({
	mode: "history",
	routes,
	linkActiveClass: "parent-active",
	linkExactActiveClass: "active",
    });

    const app					= new Vue({
	router,
	store,
	data: {
	    "toolbar_top_controls": [],
	    "toolbar_bottom_controls": [],
	},
	computed: {
	    ...mapState([
		"whoami",
	    ]),
	},
	created: async function () {
	    this.$store.dispatch("get_whoami");
	},
	methods: {
	    iconClass ( id ) {
		return 'bi-' + id;
	    },
	    setToolbarControls (top, bottom) {
		this.toolbar_top_controls	= top || [{
		    "path": "/",
		    "title": "Dashboard",
		    "icon": "house",
		}];
		this.toolbar_bottom_controls	= bottom || [];
	    },
	    ...mapActions([
		"get_whoami",
	    ]),
	}
    }).$mount("#app");

    global.App					= app;

})(window);
