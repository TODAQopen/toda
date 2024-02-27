/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

import fs from 'fs-extra';
import path from 'path';
import { Hash } from '../core/hash.js';
import { DQ } from '../abject/quantity.js';

/**
 * A persistent and in-memory cache of DQ information 
 *  owned by a client.
 * Stored structure: 
 *   {<fileHash>: <DQInfo>,
 *    ...}
 * 
 * Where DQInfo is an object as follows:
 * @typedef {Object} DQInfo
 * @property {Number} displayPrecision
 * @property {Number} quantity
 * @property {Hash} rootId
 * @property {Hash} poptop
 */
class DQCache {
    /**
     * @param {string} filePath 
     */
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        this._loadFromDisk();
    }

    isEmpty() {
        return Object.keys(this.cache).length == 0;
    }

    /**
     * Remove the specified DQ from the cache, then
     *  persist that change to disk
     * @param {Hash} hash of the DQ to remove
     */
    remove(hash) {
        delete this.cache[hash];
        this._saveToDisk();
    }

    /**
     * Add the specified DQ and its information to
     *  the cache, then persist that change to disk
     * @param {DQ} the DQ(s) to add
     */
    add(...dqs) {
        for (const dq of dqs) {
            this.cache[dq.getHash()] = 
                { rootId: dq.rootId(),
                  quantity: dq.quantity,
                  displayPrecision: dq.displayPrecision,
                  poptop: dq.popTop() };
        }
        this._saveToDisk();
    }
    
    /**
     * Clears all dqs from the cache, then persist that
     *  change to disk
     */
    clear() {
        this.cache = {};
        this._saveToDisk();
    }

    /**
     * @typedef {Object} BalanceInfo
     * @property {Number} displayPrecision
     * @property {Hash} poptop
     * @property {Number} totalQuantity
     * @property {Number} totalDisplay
     * @property {Object} fileQuantities : A mapping of file hashes
     *                      to that file's quantity
     */

    /**
     * @param {Hash} rootId
     * @returns {BalanceInfo | null} An object containing information about
     *                                  that DQ type
     */
    getBalance(rootId) {
        const files = Object.keys(this.cache)
                            .filter(h => this._getDQInfo(h)
                                             .rootId
                                             .equals(rootId));
        if (files.length == 0) {
            return null;
        }
        const displayPrecision = this._getDQInfo(files[0])
                                     .displayPrecision;
        const poptop = this._getDQInfo(files[0])
                           .poptop;
        let totalQuantity = 0;
        const balanceInfo = {displayPrecision,
                             fileQuantities: {},
                             poptop};
        for (const h of files) {
            const info = this._getDQInfo(h);
            balanceInfo.fileQuantities[h] = info.quantity;
            totalQuantity += info.quantity;
        }
        balanceInfo.totalQuantity = totalQuantity;
        balanceInfo.totalDisplay = DQ.quantityToDisplay(totalQuantity, 
                                                        displayPrecision);
        return balanceInfo;
    }

    /**
     * @param {Hash} fileHash 
     * @returns {Number | null}
     */
    getQuantity(fileHash) {
        return this._getDQInfo(fileHash)?.quantity;
    }

    /**
     * @param {Hash} fileHash 
     * @returns {Number | null}
     */
    getDisplay(fileHash) {
        const info = this._getDQInfo(fileHash);
        if (!info) {
            return null;
        }
        return DQ.quantityToDisplay(info.quantity, 
                                    info.displayPrecision);
    }

    /**
     * @param {Hash} fileHash 
     * @returns {Hash | null}
     */
    getRootId(fileHash) {
        return this._getDQInfo(fileHash)?.rootId;
    }

    /**
     * @param {Hash} fileHash 
     * @returns {Hash | null}
     */
    getPoptopForRootId(rootId) {
        return Object.values(this.cache)
                     .find(info => info.rootId.equals(rootId))
                     ?.poptop;
    }

    /**
     * @param {Hash} fileHash 
     * @returns {Hash | null}
     */
    getDisplayPrecisionForRootId(rootId) {
        return Object.values(this.cache)
                     .find(info => info.rootId.equals(rootId))
                     ?.displayPrecision;
    }

    /**
     * @returns {Array<Hash>} All files in the cache
     */
    listAll() {
        return Object.keys(this.cache)
                     .map(Hash.fromHex);
    }

    _loadFromDisk() {
        if (!fs.existsSync(this.filePath)) {
            this.cache = {};
            return;
        }
        const o = JSON.parse(fs.readFileSync(this.filePath));
        for (const key of Object.keys(o)) {
            o[key].rootId = Hash.fromHex(o[key].rootId);
            // Support null poptop
            o[key].poptop = o[key].poptop ? Hash.fromHex(o[key].poptop) : null;
        }
        this.cache = o;
    }

    _saveToDisk() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.cache));
    }

    /**
     * @param {Hash} fileHash 
     * @returns {DQInfo}
     */
    _getDQInfo(fileHash) {
        return this.cache[fileHash];
    }
}

export { DQCache };