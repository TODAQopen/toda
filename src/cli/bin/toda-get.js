#!/usr/bin/env node
const fs = require("fs/promises");
const { default: axios } = require("axios");
const { logFormatted } = require("./helpers/formatters");
const { handleProcessException, ProcessException } = require("./helpers/process-exception");
const { getArgs, getConfig } = require("./util");
const { Hash } = require("../../core/hash");
const { Atoms } = require("../../core/atoms");

void async function () {
    try {
        let args = getArgs(process);
        let config = getConfig(args["config"]);
        let fileSpec = args["_"][0];
        let [hashstr, invServer] = fileSpec.split("@");
        let hash = Hash.fromHex(hashstr);
        invServer = invServer || args.server || config.inventoryServer;

        let response = await axios({
            method: "GET",
            url: `${invServer}/files/${hash}`,
            headers: { "Content-Type": "application/octet-stream" },
            // TODO(sfertman): add capability header once inventory server supports it
            responseType: "arraybuffer",
        });

        let bytes = response.data;

        if (bytes.length == 0) {
            logFormatted(`WARNING: document ${hash} not found on ${invServer}`);
            process.exit(1);
        }

        // NOTE(sfertman): integrity checks
        let atoms = Atoms.fromBytes(bytes);
        if (!atoms.lastAtomHash().equals(hash)) {
            logFormatted("WARNING: focus hash does not match document name");
            process.exit(0);
        }

        let outputFile = args.out || path.join(config.store, `${hash}.toda`);
        await fs.access(outputFile)
            .then(
                () => Promise.reject(new ProcessException(1, "File already exists!")), // no err: file exists
                (err) => { // err: possibly doesn't exist
                    if (err.code == "ENOENT") { // file doesn't exist
                        return fs.writeFile(outputFile, bytes);
                    }
                    return Promise.reject(err); // some other error -- re-throw it
                });
        logFormatted(`Successfully downloaded ${hash} from ${invServer}`);
    } catch (pe) {
        handleProcessException(process, pe);
    }
}();
