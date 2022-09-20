/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { hydrateHash, formatReqSats } = require("./formatters");
const { NullHash } = require("../../../core/hash");

function getHistory(twist) {
    let body = twist.getBody();
    let details = {
        twist: twist.getHash(),
        sats: formatReqSats(twist.getPacket().getSatsHash(), twist),
        prev: twist.prev() ? twist.prev().getHash() : new NullHash(),
        tether: body.getTetherHash(),
        shield: body.getShieldHash(),
        reqs: formatReqSats(body.getReqsHash(), twist),
        rigging: body.getRiggingHash(),
        cargo: hydrateHash(body.getCargoHash(), twist)
    };

    let res = [details];
    if (twist.prev()) {
        res = getHistory(twist.prev()).concat(res);
    }

    return res;
}

exports.getHistory = getHistory;
