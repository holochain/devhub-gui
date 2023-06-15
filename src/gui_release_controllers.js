const { Logger }			= require('@whi/weblogger');
const log				= new Logger("gui releases");

const { HoloHash }			= holohash;
const common				= require('./common.js');

module.exports = async function ( client ) {

    async function create () {
	return {
	    "template": await common.load_html("/templates/guis/releases/create.html"),
	    "data": function() {
		window.gr_controller = this;
		return {
		    "gui_id": null,
		    "gui_file": null,
		    "gui_bytes": null,
		    "creating_gui_asset": false,
		    "error":	null,
		};
	    },
	    "computed": {
		happs_modal () {
		    return this.$refs["select_happ_release"].modal;
		},

		gui () {
		    return this.$openstate.state[ this.datapath ];
		},
		$gui () {
		    return this.$openstate.metastate[ this.datapath ];
		},

		happs () {
		    return this.$openstate.state[ `happs` ] || [];
		},
		$happs () {
		    return this.$openstate.metastate[ `happs` ];
		},

		happ_releases () {
		    return ( happ_id ) => {
			return this.$openstate.state[ `happ/${happ_id}/releases` ] || [];
		    }
		},
		$happ_releases () {
		    return ( happ_id ) => {
			return this.$openstate.metastate[ `happ/${happ_id}/releases` ];
		    }
		},

		webasset_datapath () {
		    return `webasset/new`;
		    // return `webasset/${this.gui_bytes_hash}`;
		},
		webasset () {
		    return this.$openstate.state[ this.webasset_datapath ];
		},
		webasset$ () {
		    return this.$openstate.mutable[ this.webasset_datapath ];
		},
		$webasset () {
		    return this.$openstate.metastate[ this.webasset_datapath ];
		},

		input () {
		    return this.$openstate.mutable[ this.release_datapath ];
		},
		$input () {
		    return this.$openstate.metastate[ this.release_datapath ];
		},

		$writing () {
		    return this.$input.writing || this.$webasset.writing;
		},
		$rejections () {
		    return [
			...this.$openstate.rejections[ this.release_datapath ],
			...this.$openstate.rejections[ this.webasset_datapath ],
		    ];
		},

		file_valid_feedback () {
		    const file		= this.gui_file;

		    if ( !file )
			return "";

		    return `Selected file "<strong class="font-monospace">${file.name}</strong>" (${this.$filters.number(file.size)} bytes)`;
		},
	    },
	    async created () {
		this.gui_id		= this.getPathId("gui");

		this.datapath		= `gui/${this.gui_id}`;
		this.release_datapath	= `gui/release/new`;

		if ( !this.gui )
		    this.fetchGUI();

		this.$openstate.read(`happs`);

		this.input.for_gui	= String( this.gui_id );
	    },
	    "methods": {
		async fetchGUI () {
		    try {
			await this.$openstate.read( this.datapath );
		    } catch (err) {
			this.catchStatusCodes([ 404, 500 ], err );

			log.error("Failed to get gui (%s): %s", String(this.id), err.message, err );
		    }
		},

		async getHappReleases ( happ_id ) {
		    await this.$openstate.read(`happ/${happ_id}/releases`);
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

		async create () {
		    try {
			if ( !this.webasset$.mere_memory_addr ) {
			    const mm_addr			= await common.uploadMemory(
				client,
				this.gui_bytes,
				( progress, position, length ) => {
				    this.creating_gui_asset	= {
					progress,
					position,
					length,
				    };
				}
			    );
			    this.creating_gui_asset		= false;
			    this.webasset$.mere_memory_addr	= mm_addr;
			}

			if ( !this.input.web_asset_id ) {
			    await this.$openstate.write( this.webasset_datapath );

			    this.input.web_asset_id	= this.webasset.$id;
			}

			await this.$openstate.write( this.release_datapath );

			const release		= this.$openstate.state[ this.release_datapath ];
			this.$openstate.purge( this.release_datapath );
			this.$openstate.purge( this.webasset_datapath );

			this.$openstate.read( `gui/${this.gui_id}/releases` );
			this.$router.push( `/guis/${this.gui_id}/releases/${release.$id}` );
		    } catch ( err ) {
			log.error("Failed to create GUI Release:");
			console.error( err );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/guis/releases/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const gui_id		= this.getPathId("gui");

		return {
		    id,
		    gui_id,
		    "datapath":		`gui/release/${id}`,
		    "gui_datapath":	`gui/${gui_id}`,
		    "input":		{},
		    "error":		null,
		    "changelog_html":	null,
		    "show_changelog_preview": false,
		};
	    },
	    "computed": {
		release () {
		    return this.$openstate.state[ this.datapath ];
		},
		release$ () {
		    return this.$openstate.mutable[ this.datapath ];
		},
		$release () {
		    return this.$openstate.metastate[ this.datapath ];
		},
		$rejections () {
		    return this.$openstate.rejections[ this.datapath ];
		},

		gui () {
		    return this.$openstate.state[ this.gui_datapath ];
		},
		$gui () {
		    return this.$openstate.metastate[ this.gui_datapath ];
		},

		preview_toggle_text () {
		    return this.show_changelog_preview ? "editor" : "preview";
		},
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		    await this.$openstate.get( this.gui_datapath );
		});
	    },
	    "methods": {
		toggleChangelogPreview () {
		    this.show_changelog_preview = !this.show_changelog_preview;
		    this.updateChangelogMarkdown();
		},
		updateChangelogMarkdown () {
		    this.changelog_html	= common.mdHTML( this.release$.changelog );
		},
		async update () {
		    try {
			await this.$openstate.write( this.datapath );

			this.$openstate.read(`gui/${this.gui_id}/releases`);

			this.$router.push( `/guis/${this.gui_id}/releases/${this.id}` );
		    } catch ( err ) {
			log.error("Failed to update Zome Version (%s):", String(this.id), err.data );
			this.error	= err;
		    }
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/guis/releases/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");
		const gui_id		= this.getPathId("gui");

		return {
		    id,
		    gui_id,
		    "webasset":		null,
		    "datapath":		`gui/release/${id}`,
		    "gui_datapath":	`gui/${gui_id}`,
		    "downloading":	false,
		};
	    },
	    async created () {
		window.GUIReleaseController = this;
		this.mustGet(this.refresh);
	    },
	    "computed": {
		release () {
		    return this.$openstate.state[ this.datapath ];
		},
		$release () {
		    return this.$openstate.metastate[ this.datapath ];
		},

		gui () {
		    return this.$openstate.state[ this.gui_datapath ];
		},
		$gui () {
		    return this.$openstate.metastate[ this.gui_datapath ];
		},

		webasset_datapath () {
		    return this.release ? `webasset/${this.release.web_asset_id}` : this.$openstate.DEADEND;
		},
		// webasset () {
		//     return this.$openstate.state[ this.webasset_datapath ];
		// },
		$webasset () {
		    return this.$openstate.metastate[ this.webasset_datapath ];
		},

		// download_datapath () {
		//     return this.webasset
		// 	? `web_assets/mere_memory/${this.webasset.mere_memory_addr}`
		// 	: this.$openstate.DEADEND;
		// },
		// $download () {
		//     return this.$openstate.metastate[ this.download_datapath ];
		// },

		unpublish_error () {
		    return this.$openstate.errors[ this.datapath ].unpublish;
		},

		unpublish_modal () {
		    return this.$refs["unpublish_modal"].modal;
		},
	    },
	    "methods": {
		async refresh () {
		    this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.datapath );

		    if ( !this.webasset ) {
			this.webasset	= await this.$openstate.get( this.webasset_datapath, {
			    "rememberState": false,
			});
		    }
		},
		async downloadFile () {
		    this.downloading		= true;

		    await this.delay();
		    // const bytes		= await this.$openstate.get( this.download_datapath, {
		    // 	"rememberState": false,
		    // });

		    this.download( `${this.gui.name}.zip`, this.webasset.bytes );

		    this.downloading		= false;
		},
		async unpublish () {
		    await this.$openstate.delete( this.datapath, "unpublish" );

		    this.unpublish_modal.hide();

		    this.$openstate.read(`gui/${this.gui_id}/releases`);
		    this.$router.push(`/guis/${this.gui_id}`);
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
