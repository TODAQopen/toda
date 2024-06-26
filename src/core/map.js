/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

/**
 * Implementation of Javascript Map which understands equality of our
 * Hash objects.
 *
 * Is not opinionated about what values are used.
 */

import fs from 'fs-extra';
import path from 'path';

class HashMap extends Map {
    // This could be probably done more efficiently, but this is a
    // first-pass stab we've used other places.

    constructor(iterable) {
        super(iterable);
        if (this.hashes === undefined) {
            this.hashes = {}; /** @type Object.<String,Hash> */
        }
    }

    clear() {
        this.hashes = {};
        return super.clear();
    }

    delete(key) {
        let res = super.delete(this.hashes[key]);
        delete this.hashes[key];
        return res;
    }

    get(key) { // dx: perf: this is expensive! how can we make it faster?
        if (!key) {
            return undefined;
        }
        let h = key.toString();
        let k = this.hashes[h];
        return super.get(k);
    }

    has(key) {
        if (!key) {
            return false;
        }
        return !!this.hashes[key.toString()];
    }

    set(key, value) {
        // XXX(acg): hack - if args are passed to super(),
        //  'set' will otherwise fail
        if (this.hashes === undefined) {
            this.hashes = {};
        }

        let keystring = key.toString();
        let currentKey = this.hashes[keystring];

        if (!currentKey) {
            this.hashes[keystring] = key;
            currentKey = key;
        }

        return super.set(currentKey, value);
    }

    clone() {
        return new this.constructor(this);
    }

    // Destructively updates in-place
    merge(atoms) {
        for (let [k,v] of atoms) {
            this.set(k,v);
        }
        return this.atoms;
    }
}

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
        fs.writeFileSync(
            this.filePath,
            JSON.stringify(this.serializer(Object.fromEntries(this)))
        );
    }

    clone() {
        throw new Error("Not Implemented");
    }
}

export { HashMap, JSONFileBackedHashMap };
