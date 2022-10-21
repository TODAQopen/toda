/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const path = require("path");
const express = require("express");
const cors = require("cors");
const { hostnameRouting } = require("./middleware");
const { putFile, listFiles, getFile } = require("./files");

/**
 *
 * @param {string} invPath
 * @param {ConfigParams} config
 * @typedef {Object} ConfigParams
 * @property {string} maxFileSize
 * @property {boolean} enableHostnameRouting
 * @returns
 */
function app(invPath=__dirname, config={}) {

    const CONFIG_DEFAULTS = {
        maxFileSize: "250mb",
        enableHostnameRouting: true
    };

    config = {
        ...CONFIG_DEFAULTS,
        ...config
    };

    let expressapp = express();

    // middleware
    expressapp.use(express.raw({limit: config.maxFileSize}));
    expressapp.use(hostnameRouting(config));
    expressapp.use(cors());

    // routes
    expressapp.post("/", async (req, res, next) => {
        return putFile(path.join(invPath, req.toda.subdir), req.body)
            .then(data => {
                res.setHeader("Content-Type", "application/octet-stream");
                res.status(201).end(Buffer.from(data));
            }, next);
    });

    expressapp.get("/", (req, res, next) => {
        return listFiles(path.join(invPath, req.toda.subdir))
            .then(data => {
                res.setHeader("Content-Type", "application/octet-stream");
                res.write(Buffer.from(data));
                res.end();
            }, next);
    });

    expressapp.get("/:hex", (req, res, next) => {
        return getFile(path.join(invPath, req.toda.subdir), req.params.hex)
            .then(data => {
                res.setHeader("Content-Type", "application/octet-stream");
                res.write(Buffer.from(data));
                res.end();
            }, next);
    });

    expressapp.use((err, req, res, next) => {
        if (err.constructor.name == "PayloadTooLargeError") {
            return res.status(413).send(err.message);
        }
        console.error(err.stack);
        return res.status(500).send("This should not be happening -- see logs!");
    });

    return express().use("/files", expressapp);
}

exports.app = app;
