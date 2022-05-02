const { Logger }			= require('@whi/weblogger');
const log				= new Logger("comp/breadcrumbs");


module.exports = function ( element_local_name, component_name ) {
    return {
	"props": {
	    "backLink": {
		"type": String,
	    },
	    "skipBase": {
		"type": Boolean,
		"default": false,
	    },
	    "pathMapping": {
		"type": Object,
		"required": true,
	    },
	},
	data () {
	    const breadcrumb_mapping	= this.pathMapping;
	    const current_path		= this.$router.currentRoute.value.path;
	    const segments			= current_path.split("/").slice(1);
	    const crumbs			= [];
	    log.trace("Creating breadcrumbs for %s segements (skip root: %s)", segments.length, this.skipBase );

	    if ( this.skipBase === false ) {
		crumbs.push({
		    "link": "/",
		    "text": breadcrumb_mapping["/"],
		});
	    }

	    let path			= "";

	    return {
		"crumbs": segments.reduce( (acc, seg, index) => {
		    if ( seg === "" ) // Ignore paths with accidental double slashes
			return acc;

		    path		       += "/" + seg;

		    if ( this.$attrs[`sub-${index}`] ) {
			acc.push({
			    "link": path,
			    "text": this.$attrs[`sub-${index}`],
			});
		    }
		    else if ( breadcrumb_mapping[path] ) {
			acc.push({
			    "link": path,
			    "text": breadcrumb_mapping[path],
			});
		    }
		    else {
			let found		= Object.entries( breadcrumb_mapping )
			    .filter( ([re_str]) => re_str.startsWith("^") )
			    .find( ([re_str]) => {
				return (new RegExp( re_str )).test( path );
			    });

			if ( !found ) {
			    log.warn("No breadcrumb name for path: %s", path );
			    return acc;
			}

			acc.push({
			    "link": path,
			    "text": found[1],
			});
		    }

		    if ( segments.length === (index + 1) ) {
			// Remove the current pages link
			delete acc[acc.length-1].link;
		    }

		    return acc;
		}, crumbs ),
	    }
	},
    };
}
