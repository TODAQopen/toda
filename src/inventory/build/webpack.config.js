/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const path = require("path");

const config = {
    mode: "production",
    entry: {
        app: path.resolve(__dirname, "..", "app.js"),
        lib: "./todainv.js"
    },
    output: {
        path: path.resolve(__dirname, "../dist"),
        filename: "todainv.[name].dist.js"

    },
    module: {
        rules: [{
            test: /\.(js|jsx)$/i,
            loader: "babel-loader",
        }]
    },
    target: "node"
};

module.exports = [config];
