# TODA Web tools
## Inventory viewer web application

### Compiles and hot-reloads for development
```
npm run serve-web
```

### toda.web.dist.js
Note that TodaWeb relies on a bundled version of the core `toda` library. If you make any changes to todajs, you will need to rebuild the web distribution with `npm run build` before they are reflected in the web app.

### Compiles and minifies for production
- Change the `server` variable in `config.yml` to point to your inventory server
- Update the `publicPath` variable in `vue.config.js` to point to the relative path where you will be hosting the web app. (Defaults to `"/"`)
    - eg. If you want to host todaweb at `http://localhost:3000/some/deeper/path`, set `publicPath: /some/deeper/path`.

Then:
```
npm run build-web
```

- Copy the resulting `dist` folder to your server's root directory.
- You'll need to configure `/dist` as a static assets folder. If you're using express:

```
app.use('/some/deeper/path', express.static(path.join(__dirname, '/dist')));
```

### Sass
Have any changes to your sass files automatically compile to `main.css`
```
npm run watch-sass
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## Inventory server
Runs a server to list and retrieve files from a local inventory store. Details for active dev:

### Run the servers
```
$ toda serve
Web && Inventory server running on http://localhost:3000
```

Go ahead and navigate to `http://localhost:3000` and you should be able to view all of the files we've created. In particular take a look at the Capability we authorized! You'll see the hash (in our example here, `417b3b2061ab152ca4bb10552cffe89f6d025801f12ffc2bec052092f04eb716c2`) in the inventory listing, or you can navigate directly to it at `http://localhost:3000/#/417b3b2061ab152ca4bb10552cffe89f6d025801f12ffc2bec052092f04eb716c2`


### Configuration
Edit `config.yml` to change configurable parameters:
- inventory: a home dir relative path to local inventory; i.e., absolute path will be `~/<config-inventory-path>`
- port: the port on which the server will start with `npm run server`
