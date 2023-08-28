/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

class HashNotFoundError extends Error {
    constructor(hash, meta) {
        let msg = "Hash not found in store: " + hash;
        super(msg);

        this.details = msg;
        this.hash = hash;
        this.meta = meta;
    }
}

export { HashNotFoundError };