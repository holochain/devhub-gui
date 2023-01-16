[Back to README.md](./README.md)

# Design

## Dependencies

### Primary

- [Vue.js](https://next.router.vuejs.org/) - Application framework
- [Vue Router](https://next.router.vuejs.org/) - Navigation manager
- [Vuex](https://next.vuex.vuejs.org/guide/) - State manager

### Secondary

- [showdown](https://github.com/showdownjs/showdown) - Markdown to HTML converter

## Routes

| URL Path                      | Page's Purpose                                            |
|-------------------------------|-----------------------------------------------------------|
| `/`                           | Dashboard                                                 |
| `/dnas`                       | DNA discovery                                             |
| `/dnas/create`                | &ndash; Create a new DNA                                  |
| `/dnas/<id>`                  | &ndash; View a specific DNA                               |
| `/dnas/<id>/update`           | &ndash; Update a specific DNA                             |
| `/dnas/<id>/versions`         | &ndash;&ndash; View Versions for the relative DNA         |
| `/dnas/<id>/versions/create`  | &ndash;&ndash; Create a new Version for the relative DNA  |
| `/dnas/<id>/versions/<id>`    | &ndash;&ndash; View a specific DNA Version                |
| `/dnas/<id>/versions/update`  | &ndash;&ndash; Update a specific DNA Version              |
| `/zomes`                      | Zome discovery                                            |
| `/zomes/create`               | &ndash; Create a new Zome                                 |
| `/zomes/<id>`                 | &ndash; View a specific Zome                              |
| `/zomes/<id>/update`          | &ndash; Update a specific Zome                            |
| `/zomes/<id>/versions`        | &ndash;&ndash; View Versions for the relative Zome        |
| `/zomes/<id>/versions/create` | &ndash;&ndash; Create a new Version for the relative Zome |
| `/zomes/<id>/versions/<id>`   | &ndash;&ndash; View a specific Zome Version               |
| `/zomes/<id>/versions/update` | &ndash;&ndash; Update a specific Zome Version             |
| `/happs`                      | hApp discovery                                            |
| `/happs/create`               | &ndash; Create a new hApp                                 |
| `/happs/<id>`                 | &ndash; View a specific hApp                              |
| `/happs/<id>/update`          | &ndash; Update a specific hApp                            |
| `/happs/<id>/releases`        | &ndash;&ndash; View Releases for the relative hApp        |
| `/happs/<id>/releases/create` | &ndash;&ndash; Create a new Release for the relative hApp |
| `/happs/<id>/releases/<id>`   | &ndash;&ndash; View a specific hApp Release               |
| `/happs/<id>/releases/update` | &ndash;&ndash; Update a specific hApp Release             |
| `/profiles`                   | Profile discovery                                         |
| `/profiles/<id>`              | &ndash; View a specific Agent's profiles                  |
| `/profiles/<id>/update`       | &ndash; Update my Agent's profiles                        |


## Modules

- `./src/store.js` - [State management](https://next.vuex.vuejs.org/guide/)
- `./src/common.js` - [Global mixins](https://v3.vuejs.org/guide/mixins.html#global-mixin)
- `./src/filters.js` - Vue.js filters
  - *using [`globalProperties` workaround](https://v3.vuejs.org/guide/migration/filters.html#global-filters) since v3 removed template filters*
- `./src/components.js` - [Vue.js components](https://v3.vuejs.org/guide/component-basics.html)
- `./src/index.js` - App main entry point
- `./src/*_controllers.js` - Router components grouped by data type
  - eg. `zome`, `zome_version`, `dna`, etc...


# Development


## Environment

- Developed using Node.js `v14.17.3`
- Enter `nix-shell` for development environment dependencies.
  - Lair Keystore
  - Holochain

#### Tested on

- Ubuntu 20.04.2 LTS (focal)

#### Expected to work on

- Debian based distributions

#### Not expected to work on

- Microsoft Windows


## Build

```bash
npm i
npm run build
```


## Testing

No automated testing.


## HTTP Server

> We cannot use a simple HTTP server because this Web UI implements
[SPA](https://en.wikipedia.org/wiki/Single-page_application) concepts that utilizes the browsers
[`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) for URL
updating.

Visit [http://devhub.holochain.org](http://devhub.holochain.org) after completing the following
setup instructions.  Don't forget to change the `APP_HOST` in the browser console

```javascript
localStorage.setItem( "APP_HOST", "devhub.holochain.org" );
```

### Install
If you don't already have `nginx` installed
```bash
sudo apt-get install nginx
```

### Edit `/etc/hosts`
Add this line to `/etc/hosts`
```
127.0.0.1       devhub.holochain.org
```

### Nginx Config

```bash
make /etc/nginx/sites-available/devhub
```

What that make target does...

- Copy `./tests/nginx/devhub` into `/etc/nginx/sites-available/` while replacing `PWD` with the result of bash command `pwd`
- Create symbolic link in `/etc/nginx/sites-enabled/` pointing to the copied config file
- Reload nginx service


## Dependencies

- DevHub GUI
  - DevHub DNAs
  - `@whi/holochain-client`
    - Holochain Conductor API
  - dev / testing
    - `@whi/holochain-backdrop`
      - Holochain Conductor API
      - Holochain App/DNA Manifest


#### [DevHub DNAs](https://github.com/holochain/devhub-dnas)

Sometimes a Holochain release does not require any architectural changes in which case swapping out
the DNAs is the only task.  However, significant changes such as the addition of Link Types, or the
integrity/coordinator zome split, may cause a redesign on the front-end.

See more on
[Contributing.md#dependencies](https://github.com/holochain/devhub-dnas/blob/master/CONTRIBUTING.md#dependencies)


#### [`@whi/holochain-client`](https://github.com/mjbrisebois/js-holochain-client)

If the Conductor API has changed, this library will most likely need to be updated.  DevHub GUI uses
this for all its communications to the Holochain engine.


#### [`@whi/holochain-backdrop`](https://github.com/mjbrisebois/node-holochain-backdrop)

DevHub GUI uses this for development setup.  This library is used to programmatically run the
Holochain binary, install hApps, creates agents, and make capability grants.  If the client
(`@whi/holochain-client`) API or Holochain manifests have changed, this library might need to be
updated.


### Upgrading for a new Holochain release

When there is a new Holochain release, we ony have to update affected parts.  This Causal Tree lists
the downstream DevHub components for parts of the Holochain engine.

#### Causal Tree

- HDI / HDK
  - DevHub DNAs
    - DevHub Webhapp
- Conductor API
  - `@whi/holochain-client`
    - DevHub Webhapp
  - `@whi/holochain-backdrop`
- WebApp/App/DNA Manifest
  - `@whi/holochain-backdrop`
