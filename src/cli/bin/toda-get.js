#!/usr/bin/env nodeimport fs from 'fs/promises';
import { default as axios } from 'axios';
import { logFormatted } from './helpers/formatters';
import { handleProcessException, ProcessException } from './helpers/process-exception';
import { getArgs, formatInputs } from './util';
import { Hash } from '../../core/hash';
import { Atoms } from '../../core/atoms';
import path from 'path';

void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        let hash, inventoryServer;
        if (args["_"].length > 0) {
          let fileSource = args["_"][0];
          [hash, inventoryServer] = fileSource.split("@");
        }
        inventoryServer = inventoryServer || inputs.inventoryServer;

        let response = await axios({
            method: "GET",
            url: `${inventoryServer}/files/${hash}`,
            headers: { "Content-Type": "application/octet-stream" },
            // TODO(sfertman): add capability header once inventory server supports it
            responseType: "arraybuffer",
        });

        let bytes = response.data;

        if (bytes.length == 0) {
            logFormatted(`WARNING: document ${hash} not found on ${inventoryServer}`);
            process.exit(1);
        }

        // NOTE(sfertman): integrity checks
        let atoms = Atoms.fromBytes(bytes);
        if (!atoms.focus.equals(hash)) {
            logFormatted("WARNING: focus hash does not match document name"); // dx: think: do we really want this? the filename doesn't matter.
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
        logFormatted(`Successfully downloaded ${hash} from ${inventoryServer}`);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
