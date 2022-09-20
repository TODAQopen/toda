/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { Hash, NullHash } = require("../../../core/hash");
const { ArbitraryPacket, PairTriePacket, HashPacket, BasicTwistPacket, BasicBodyPacket } = require("../../../core/packet");
const { RequirementMonikers } = require("../../../core/reqsat");
const { ProcessException } = require("./process-exception");
require("node-json-color-stringify");
const chalk = require("chalk");
const DisplayRows = 20;

/**
 * Accepts an object or an array of object entries and returns an object with those Hash values stringified
 * @param arr <Array|Object> the array or object to stringify
 * @returns <Object> An object with the
 */
function stringifyValues(arr) {
    if (!Array.isArray(arr)) {
        arr = Object.entries(arr);
    }

    return arr.reduce((acc, [k, v]) => {
        acc[k] = v instanceof Hash ? v.toString() : v;
        return acc;
    }, {});
}

/** Given an array, return a tab-delimited string representing the array items, up to a maximum limiit
 * @param arr <Array> the array to parse
 * @param showAll <bool> The number of rows to display
 * @param indentLevel <int> The indentation level of the list
 * @param displayRows <int> the number of rows to display
 * @returns <Array> the distinct values in the array
 */
function toPagedString(arr, showAll, indentLevel = 0, displayRows = DisplayRows) {
    let indent = "\t".repeat(indentLevel);
    let details = arr.join(`${indent}\n`);

    let remaining = arr.length - displayRows;
    if (remaining > 0 && !showAll) {
        details = arr.slice(0, displayRows).join(`${indent}\n`);
        details += `${indent}\n... (and ${remaining} more)`;
    }

    return details;
}

/**
 * Accepts the hash of a packet and recursively hydrates it
 * @param hash <Hash> the hash of a packet to hydate
 * @param twist <Twist> the twist to use for packet lookup
 * @returns <Object> a json object representing the hydrated contents of the packet
 */
function hydrateHash(hash, twist) {
    if (hash.isNull() || hash.isSymbol()) {
        return hash.toString();
    }

    let packet = twist.get(hash);
    let shapedVal = packet.getShapedValue();

    if (packet instanceof ArbitraryPacket) {
        return shapedVal.toUTF8String();
    } else if (packet instanceof BasicTwistPacket) {
        return stringifyValues(formatTwistPacket(packet, twist));
    } else if (packet instanceof BasicBodyPacket) {
        return stringifyValues(formatBodyPacket(packet, twist));
    } else if (packet instanceof PairTriePacket) {
        let res = {};
        for (let [keyHash, valueHash] of Array.from(shapedVal.entries())) {
            res[keyHash] = hydrateHash(valueHash, twist);
        }

        return res;
    } else if (packet instanceof HashPacket) {
        let res = [];
        for (let h of shapedVal) {
            res.push(hydrateHash(h, twist));
        }

        return res;
    } else {
        throw new ProcessException(1, `Unknown packet type for hash ${hash}`);
    }
}

/**
 * Accepts the hash of a reqs/sats trie and formats it into friendly json
 * @param trieHash <Hash> the hash of a reqs or sats trie
 * @param twist <Twist> the twist to use for packet lookup
 * @returns <Object> the formatted trie as a json object
 */
function formatReqSats(trieHash, twist) {
    let reqs = {};
    if (!trieHash || trieHash.isNull()) {
        return new NullHash();
    }

    let trie = (twist.get(trieHash)).getShapedValue();
    for (let [keyHash, valueHash] of Array.from(trie.entries())) {
        let moniker = RequirementMonikers[keyHash] || RequirementMonikers._;
        let packet = twist.get(valueHash);
        let shapedValue = packet.getShapedValue();

        if (packet instanceof HashPacket) {
            let reqsList = [];

            for (let rih of shapedValue) {
                let p = twist.get(rih);
                if (p instanceof PairTriePacket) {
                    reqsList.push(formatReqSats(rih, twist));
                } else if (p instanceof HashPacket) {
                    let [weight, req] = p.getShapedValue();
                    reqsList.push({
                        weight: (twist.get(weight)).getShapedValue()[0],
                        requirement: formatReqSats(req, twist)
                    });
                }
            }

            reqs[moniker] = reqsList;
        } else {
            reqs[moniker] = shapedValue.toString();
        }
    }

    return reqs;
}

/**
 *  Retrieves a nicely formatted object representing the body packet details.
 *  @param packet <BasicBodyPacket>
 *  @param twist <Twist> the twist to use for packet lookup
 *  @returns <Object> a json object representing the hydrated contents of the packet
 **/
function formatBodyPacket(packet, twist) {
    return {
        prev: packet.getPrevHash(),
        tether: packet.getTetherHash(),
        shield: packet.getShieldHash(),
        reqs: formatReqSats(packet.getReqsHash(), twist),
        rigging: packet.getRiggingHash(),
        cargo: hydrateHash(packet.getCargoHash(), twist)
    };
}

/**
 *  Retrieves a nicely formatted object representing the twist packet details.
 *  @param packet <BasicTwistPacket>
 *  @param twist <Twist> the twist to use for packet lookup
 *  @returns <Object> a json object representing the hydrated contents of the packet
 **/
function formatTwistPacket(packet, twist) {
    return {
        body: hydrateHash(packet.getBodyHash(), twist),
        sats: formatReqSats(packet.getSatsHash(), twist)
    };
}

/**
 * Accepts a json object and formats it as a tab delimited string
 * @param obj <Object> the object to format
 * @param indentLevel <int> the current indentation level for the display
 * @returns <String> A tab-delimited string representing the json object
 */
function formatTabDelimited(obj, indentLevel = 0) {
    let indent = "\t".repeat(indentLevel);
    let output = "";

    Object.entries(obj).forEach(([k, v]) => {
        output += chalk.dim.white(`${indent}${k.padEnd(10)}\t`);

        if (Array.isArray(v)) {
            //todo(mje): Apply the paging logic here
            let res = v.map(item => {
                if (typeof item == "object") {
                    return `${formatTabDelimited(item, indentLevel + 1)}`;
                }

                return `${indent}\t${item}`;
            }).join("\n");
            output += `\n${res}`;
        } else if (typeof v == "object") {
            output += `\n${formatTabDelimited(v, indentLevel + 1)}`;
        } else {
            output += chalk.white(`${v}\n`);
        }
    });

    return output;
}

/**
 * Converts an integer number of bytes to a human readable string
 * @param bytes <int> the number of bytes
 * @returns <String> the bytes formatted as a human readable string
 */
function formatBytes(bytes) {
    const k = 1024;
    const sizeChars = "BKMGTPEZY";
    let sizeIdx = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, sizeIdx)).toFixed(2))}${sizeChars[sizeIdx]}`;
}

function logFormatted(data, isJson) {
    if (isJson) {
        console.log(JSON.colorStringify(data, null, 2));
    } else {
        console.log(data);
    }
}

exports.stringifyValues = stringifyValues;
exports.toPagedString = toPagedString;
exports.hydrateHash = hydrateHash;

exports.formatReqSats = formatReqSats;
exports.formatTabDelimited = formatTabDelimited;
exports.formatBodyPacket = formatBodyPacket;
exports.formatTwistPacket = formatTwistPacket;
exports.formatBytes = formatBytes;

exports.logFormatted = logFormatted;
