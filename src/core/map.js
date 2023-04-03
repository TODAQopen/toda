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

    get(key) {
        return super.get(this.hashes[key]);
    }

    has(key) {
        return !!this.hashes[key];
    }

    set(key, value) {
        //console.log("this:", this, this.hashes);

        // XXX(acg): hack - if args are passed to super(), 'set' will otherwise fail
        if(this.hashes === undefined) {
            this.hashes = {};
        }

        let keystring = key.toString();
        if (!this.hashes[keystring]) {
            this.hashes[keystring] = key;
        }

        return super.set(this.hashes[keystring], value);
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

export { HashMap };
