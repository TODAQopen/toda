/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

class NamedError extends Error {
    get name() {
        return this.constructor.name;
    }
}

class HashNotFoundError extends NamedError {
    constructor(hash, meta) {
        let msg = "Hash not found in store: " + hash;
        super(msg);

        this.details = msg;
        this.hash = hash;
        this.meta = meta;
    }
}

export {
    NamedError,
    HashNotFoundError
};
