/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { PairTriePacket } from './packet.js';
import { byteConcat } from './byteUtil.js';

// doesn't really need a class
class Shield {

    /**
     * @returns <Hash>
     */
    static _shield(twistHash, bytesToShield, shieldBytes) {
        return twistHash.constructor.fromBytes(shieldBytes ?
            byteConcat(shieldBytes, bytesToShield) :
            bytesToShield);
    }

    /**
     * @returns <Hash>
     */
    static shield(twistHash, hashToShield, shieldPacket) {
        if (shieldPacket) {
            return this._shield(twistHash,
                hashToShield.toBytes(),
                shieldPacket.toBytes().subarray(5)); // dx: perf
        }
        return this._shield(twistHash, hashToShield.toBytes());
    }

    /**
     * @returns <Hash>
     */
    static doubleShield(twistHash, hashToShield, shieldPacket) {
        return this.shield(twistHash, this.shield(twistHash,
            hashToShield,
            shieldPacket),
        shieldPacket);
    }

    static rigForHoist(leadHash, meatHash, shieldPacket) {
        return PairTriePacket.createFromUnsorted(
            new Map([[this.shield(leadHash, leadHash, shieldPacket), meatHash],
                     [this.doubleShield(leadHash, leadHash, shieldPacket),
                      this.shield(leadHash, meatHash, shieldPacket)]]));
    }
}

export { Shield };
