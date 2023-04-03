/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import path from 'path';

const config = {
    mode: "production",
    entry: {
        app: new URL('../app.js', import.meta.url),
        lib: "./todainv.js"
    },
    output: {
        path: new URL('../dist', import.meta.url),
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

export default [config];
