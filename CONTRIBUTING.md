[Back to README.md](./README.md)

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
