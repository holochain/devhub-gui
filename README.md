
# DevHub GUI
A web-based UI that works with Holochain's collection of DevHub DNAs.

## Beta User Testing
This project has completed single conductor multi-agent testing.  It is now ready for
multi-conductor multi-agent testing using real-world networking.


### Testing Setup

Enter nix shell for Holochain and Lair binaries
```bash
nix-shell
```

Run Holochain
```bash
[nix-shell:devhub-gui]$ npm i
[nix-shell:devhub-gui]$ make run-holochain
```

The required DNAs must be downloaded into the `./dnas/` directory.
```
[nix-shell:devhub-gui]$ ls -l ./dnas
total 3576
-rw-r--r-- 1 user group 1755087 Aug 24 18:03 dnarepo.dna
-rw-r--r-- 1 user group 1056049 Aug 24 18:03 happs.dna
-rw-r--r-- 1 user group  846196 Aug 24 18:03 webassets.dna
```

Run all administrative calls to setup DNAs, Agent, and App.
```bash
[nix-shell:devhub-gui]$ make setup
```

View the created agent pubkey
```bash
[nix-shell:devhub-gui]$ cat ./tests/AGENT
uhCAkQ1xBkDZwHKD05MKrLaIJQDvJG_RwlDbKNfMbEoqwDvrqs5Wx
```

Build GUI assets
```bash
[nix-shell:devhub-gui]$ npm run build
```

Run any simple HTTP server from the `dist` directory.

Example
```bash
cd dist; python3 -m http.server 8888
```


#### Browser `console` commands

Set the agent pubkey that was created during `make setup`.
```javascript
// Example - you must replace this Agent pubkey with the one in ./tests/AGENT
localStorage.setItem( "AGENT_PUBKEY", "uhCAkQ1xBkDZwHKD05MKrLaIJQDvJG_RwlDbKNfMbEoqwDvrqs5Wx" );
```

**Optional settings**

If you change the app port in `./tests/setup.js`, override the default port with `APP_PORT`
```javascript
localStorage.setItem( "APP_PORT", 44001 );
```

If you follow the `CONTRIBUTING.md` instructions for setting up an SPA for push state, you can set the app host with `APP_HOST`.
```javascript
localStorage.setItem( "APP_HOST", "devhub.holochain.org" );
localStorage.setItem( "PUSH_STATE", "true" );
```

Turn on logging
```javascript
localStorage.setItem( "LOG_LEVEL", "trace" );
// trace, debug, info, normal, warn, error, fatal
```


### Reset Environment
This will reset the environment by removing the Holochain databases & configuration, Lair databases,
and saved hash files.

```bash
make reset-holochain
```


## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
