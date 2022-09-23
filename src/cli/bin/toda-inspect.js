#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");
const { Hash } = require("../../core/hash");
const { ArbitraryPacket, HashPacket, PairTriePacket, BasicBodyPacket, BasicTwistPacket } = require("../../core/packet");
const { ByteArray } = require("../../core/byte-array");
const { getFileOrInput, getArgs, getPacketSize } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { stringifyValues, hydrateHash, formatTabDelimited,
    formatBodyPacket, formatTwistPacket, logFormatted } = require("./helpers/formatters");

const arbDisplayBytes = 32;
const formattingFns = {
    [ArbitraryPacket.getShapeCode()]: formatArbitraryPacket,
    [HashPacket.getShapeCode()]: formatHashPacket,
    [PairTriePacket.getShapeCode()]: formatPairTriePacket,
    [BasicBodyPacket.getShapeCode()]: (packet, twist) => stringifyValues(formatBodyPacket(packet, twist)),
    [BasicTwistPacket.getShapeCode()]: (packet, twist) => stringifyValues(formatTwistPacket(packet, twist))
};

// Searches a .toda file for a value associated with the specified hash
// toda inspect 41b447036b33a994cc23bf3e918f2074b2f9ba1b431fbc593756e41162a7605519
// <~/.toda/store/41e231509e8df76c8cc64cfcaef3599e03a2c4812cc957d9bb435e013d51b596c6.toda
void async function () {
    try {
        let args = getArgs();
        let hash = Hash.parse(new ByteArray(Buffer.from(args["_"][0], "hex")));

        let bytes = await getFileOrInput(args["_"][1]);
        let twist = new Twist(Atoms.fromBytes(bytes));
        let res = inspect(twist, hash, args);

        let isJson = args["json"];
        logFormatted(formatOutput(res, isJson), isJson);
    } catch (pe) {
        handleProcessException(pe);
    }
}();

function inspect(twist, hash, args) {
    //todo(mje): Add logic to handle Symbols
    let packet = twist.get(hash);
    let formatFn = formattingFns[packet.constructor.getShapeCode()];
    let content = args["packet"]
        ? formatFn(packet, twist, args["C"], args["raw"], args["list"])
        : hydrateHash(hash, twist);
    return wrapPacketHeaders(content, packet, args["h"]);
}

/* Formatters */
function formatArbitraryPacket(packet, twist, isContent, isRaw) {
    if (isContent) {
        if (isRaw) {
            return packet.getContent();
        }

        return packet.getContent().toString();
    }

    return getArbContent(packet);
}

function formatHashPacket(packet, twist, isContent, isRaw, isList) {
    let hashes = packet.getShapedValue().map(h => h.toString());

    if (isContent) {
        if (isRaw) {
            return packet.getContent();
        } else if (isList) {
            return hashes.map(h => `${h}\n`).join("").slice(0, -1);
        }

        return packet.getContent().toString();
    }

    return getHashPacketContent(packet);
}

function formatPairTriePacket(packet, twist, isContent, isRaw, isList) {
    let hashes = Array.from(packet.getShapedValue().entries());

    if (isContent) {
        if (isRaw) {
            return packet.getContent();
        } else if (isList) {
            return hashes.map(([h, p]) => `${h}\t${p}\n`).join("").slice(0, -1);
        }

        return packet.getContent().toString();
    }

    return getPairTriePacketContent(packet);
}

/* Content Getters */
function getArbContent(packet) {
    let content = packet.getContent().slice(0, arbDisplayBytes).toString();
    let remaining = packet.getContent().length - arbDisplayBytes;
    if (remaining > 0) {
        content += `... (${remaining} more bytes)`;
    }

    return content;
}

function getHashPacketContent(packet) {
    return packet.getShapedValue().map(h => h.toString());
}

function getPairTriePacketContent(packet) {
    return stringifyValues(Array.from(packet.getShapedValue().entries()));
}

/* Helpers */
function wrapPacketHeaders(content, packet, friendly) {
    return {
        type: packet.constructor.getMoniker(),
        size: getPacketSize(packet, friendly),
        content: content
    };
}

function formatOutput(details, isJson) {
    return isJson ? details : formatTabDelimited(details);
}
