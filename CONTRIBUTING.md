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
| `/dnas/mine`                  | &ndash; View DNAs related to my Agent                     |
| `/dnas/<id>`                  | &ndash; View a specific DNA                               |
| `/dnas/create`                | &ndash; Create a new DNA                                  |
| `/dnas/<id>/update`           | &ndash; Update a specific DNA                             |
| `/dnas/<id>/versions`         | &ndash;&ndash; View Versions for the relative DNA         |
| `/dnas/<id>/versions/create`  | &ndash;&ndash; Create a new Version for the relative DNA  |
| `/dnas/<id>/versions/<id>`    | &ndash;&ndash; View a specific DNA Version                |
| `/dnas/<id>/versions/update`  | &ndash;&ndash; Update a specific DNA Version              |
| `/zomes`                      | Zome discovery                                            |
| `/zomes/mine`                 | &ndash; View Zomes related to my Agent                    |
| `/zomes/<id>`                 | &ndash; View a specific Zome                              |
| `/zomes/create`               | &ndash; Create a new Zome                                 |
| `/zomes/<id>/update`          | &ndash; Update a specific Zome                            |
| `/zomes/<id>/versions`        | &ndash;&ndash; View Versions for the relative Zome        |
| `/zomes/<id>/versions/create` | &ndash;&ndash; Create a new Version for the relative Zome |
| `/zomes/<id>/versions/<id>`   | &ndash;&ndash; View a specific Zome Version               |
| `/zomes/<id>/versions/update` | &ndash;&ndash; Update a specific Zome Version             |
| `/happs`                      | hApp discovery                                            |
| `/happs/mine`                 | &ndash; View hApps related to my Agent                    |
| `/happs/<id>`                 | &ndash; View a specific hApp                              |
| `/happs/create`               | &ndash; Create a new hApp                                 |
| `/happs/<id>/update`          | &ndash; Update a specific hApp                            |
| `/happs/<id>/releases`        | &ndash;&ndash; View Releases for the relative hApp        |
| `/happs/<id>/releases/create` | &ndash;&ndash; Create a new Release for the relative hApp |
| `/happs/<id>/releases/<id>`   | &ndash;&ndash; View a specific hApp Release               |
| `/happs/<id>/releases/update` | &ndash;&ndash; Update a specific hApp Release             |
| `/profiles`                   | Profile discovery                                         |
| `/profiles/mine`              | &ndash; View My profiles                                  |
| `/profiles/mine/update`       | &ndash; Update my Agent's profiles                        |
| `/profiles/<id>`              | &ndash; View a specific Agent's profiles                  |


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
Enter `nix-shell` for development environment dependencies.

### Development Environment Support

#### Tested on

- Ubuntu 20.04.2 LTS (focal)

#### Expected to work on

- Debian based distributions

#### Not expected to work on

- Microsoft Windows


### Setup requirements

1. NPM - `npm i`
2. Lair `make lair`
3. Conductor `make conductor`
4. HTTP Server - see below


## Build

```bash
npm run build
```


## Development HTTP Server

> We cannot use a simple HTTP server because this Web UI implements
[SPA](https://en.wikipedia.org/wiki/Single-page_application) concepts that utilizes the browsers
[`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) for URL
updating.

Visit [http://devhub.holochain.org](http://devhub.holochain.org) after following setup instructions.

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
