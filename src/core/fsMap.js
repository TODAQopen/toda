/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2024
*
* Apache License 2.0
*************************************************************/

/**
 * Implementation of Javascript Map which understands equality of our
 * Hash objects and backed by the file system.
 *
 * Is not opinionated about what values are used.
 */

import fs from 'fs-extra';
import path from 'path';
import { HashMap } from './map.js';
import { v4 } from 'uuid';

/* HashMap subclass that stores the values in a given json file and tries to
 * load them upon initialization
 */
class JSONFileBackedHashMap extends HashMap {
    constructor(
        filePath,
        iterable = [],
        deserializer = (x) => x,
        serializer = (x) => x
    ) {
        const fullFilePath = path.resolve(filePath);
        if (fs.existsSync(fullFilePath)) {
            const diskData = deserializer(
                JSON.parse(fs.readFileSync(fullFilePath))
            );
            iterable = iterable.concat(Object.entries(diskData));
        }
        super(iterable);
        this.filePath = fullFilePath;
        this.serializer = serializer;
    }

    commit() {
        const tmpPath = `${this.filePath}_${v4()}.tmp`;
        fs.writeFileSync(
            tmpPath,
            JSON.stringify(this.serializer(Object.fromEntries(this)))
        );
        fs.moveSync(tmpPath, this.filePath, { overwrite: true });
    }

    clone() {
        throw new Error("Not Implemented");
    }
}

export { JSONFileBackedHashMap };
