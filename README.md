
# DevHub GUI
A web-based UI that works with Holochain's collection of DevHub DNAs.

## Beta User Testing
This project has completed single conductor multi-agent testing.  It is now ready for
multi-conductor multi-agent testing using real-world networking.

### Testing Setup

```bash
nix-shell
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

#### Browser `console` commands

Set the app port that was attached during `make setup`
```javascript
localStorage.setItem( "APP_PORT", 44001 );
```

Set the agent pubkey that was created during `make setup`
```javascript
// Example - you must replace this Agent pubkey with the one in ./tests/AGENT
localStorage.setItem( "AGENT_PUBKEY", "uhCAkQ1xBkDZwHKD05MKrLaIJQDvJG_RwlDbKNfMbEoqwDvrqs5Wx" );
```

Turn on logging *(optional)*
```javascript
localStorage.setItem( "LOG_LEVEL", "trace" );
// trace, debug, info, normal, warn, error, fatal
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
