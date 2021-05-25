
window.Buffer					= require('buffer/').Buffer;
const Vue					= require('vue');
const Vuex					= require('vuex');
const createLogger				= require('vuex/dist/logger');
const { mapState,
	mapMutations,
	mapActions }				= require('vuex');
const VueRouter					= require('vue-router').default;
const VueMoment					= require('vue-moment').default;

const orm					= require('./api_orm.js');


Vue.use( Vuex );
Vue.use( VueRouter );
Vue.use( VueMoment );

function b64 ( input ) {
    return typeof input === "string"
	? Buffer.from( input, "base64" )
	: Buffer.from( input ).toString("base64");
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
    // console.log("My DNAs:", JSON.stringify( await DevHub.myDNAs(), null, 4 ) );


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
		console.log("Fetching my DNAs");
		return await DevHub.myDNAs();
	    },
	    create_dna: async function ( ctx, input ) {
		console.log("Create DNA:", input );
		return await DevHub.createDNA( input );
	    },
	    get_dna: async function ( ctx, { hash } ) {
		console.log("Fetching DNA:", hash );
		return await DevHub.getDNA( hash );
	    },
	    create_dna_version: async function ( ctx, input ) {
		console.log("Create DNA Version:", input );
		return await DevHub.createDNAVersion( input );
	    },
	    get_dna_version: async function ( ctx, { hash } ) {
		console.log("Fetching DNA Version:", hash );
		return await DevHub.getDNAVersion( hash );
	    },
	    get_dna_chunk: async function ( ctx, { hash } ) {
		console.log("Fetching DNA Chunk:", hash );
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
		    });
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
		    let dna			= await this.$store.dispatch("create_dna", this.dna );
		    console.log("Created DNA:", dna );
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
		};
	    },
	    async created () {
		this.id				= this.$route.params.entry_hash;
		this.$root.setToolbarControls([{
		    "path": "/",
		    "title": "Back to Dashboard",
		    "icon": "arrow-left-square",
		}], [{
		    "path": "/dna/" + encodeURIComponent(this.id) + "/edit",
		    "title": "Edit",
		    "icon": "pencil-square",
		}]);
		await this.refresh();
	    },
	    "methods": {
		async refresh () {
		    let dna_obj			= await this.$store.dispatch("get_dna", { "hash": this.id });
		    this.dna			= dna_obj.toJSON();
		    this.versions		= Object.values( await dna_obj.versions() ).map(dv => {
			dv.hash			= b64( dv.id );
			return dv;
		    });
		    this.next_version		= Object.values(this.versions).reduce((acc, dv) => dv.version > acc ? dv.version : acc, 0) + 1;
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
		save () {
		    console.log("Saving...");
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
		    console.log("Saving...");
		    console.log( this.dna_version );
		    this.dna_version.published_at = (new Date( this.published_date )).getTime();

		    let dna_version		= await this.$store.dispatch("create_dna_version", this.dna_version );
		    console.log( dna_version );
		}
	    },
	},
	"/dna/version/:entry_hash": {
	    "template": (await import("./templates/dna-version-single.html")).default,
	    "data": function() {
		return {
		    "id": null,
		    "dna_version": null,
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
		    "path": "/dna/version/" + encodeURIComponent(this.id) + "/edit",
		    "title": "Edit",
		    "icon": "pencil-square",
		}]);
	    },
	    "methods": {
		async refresh () {
		    let version_obj		= await this.$store.dispatch("get_dna_version", { "hash": this.id });
		    this.dna_version		= version_obj.toJSON();
		    console.log( this.dna_version );
		},
		async download () {
		    let bytes			= new Uint8Array( this.dna_version.file_size );
		    let index			= 0;
		    for ( let chunk_hash of this.dna_version.chunk_addresses ) {
			let $chunk		= await this.$store.dispatch("get_dna_chunk", { "hash": chunk_hash });
			let chunk		= $chunk.toJSON();
			bytes.set( chunk.bytes, index );
			index		       += chunk.bytes.length;
		    }
		    console.log( bytes );

		    let blob			= new Blob([ bytes ]);
		    let link			= document.createElement("a");
		    link.href			= URL.createObjectURL(blob);

		    let filename		= this.dna_version.for_dna.name.replace(/[/\\?%*:|"<>]/g, '_');
		    link.download		= `${filename}-v${this.dna_version.version}.dna`;
		    link.click();
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
		save () {
		    console.log("Saving...");
		}
	    },
	},
    };

    console.log( routeComponents );
    const routes				= [];
    for (let [ path, component ] of Object.entries( routeComponents )) {
	routes.push({ path, component });
    }
    console.log( routes );

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
