/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

class Cache extends Map {
    constructor() {
        super();
        this.expiry = 60000;
    }

    getAtomKey(key) {
        return `atoms_${key}`;
    }

    set(key, value) {
        super.set(key, [value, Date.now()]);
    }

    get(key) {
        if (this.has(key)) {
            let [val, expires] = super.get(key);
            
            if ((Date.now() - expires) > this.expiry) {
                this.delete(key);
                return;
            }

            return val;
        }
    }
}

exports.cache = new Cache();
