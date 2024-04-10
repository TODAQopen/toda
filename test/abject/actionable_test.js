import { MockSimpleHistoricRelay } from '../client/mocks.js';
import { Abject } from '../../src/abject/abject.js';
import { DQ } from '../../src/abject/quantity.js';
import { Sha256 } from '../../src/core/hash.js';
import { Shield } from '../../src/core/shield.js';
import { hexToBytes } from '../../src/core/byteUtil.js';
import { ArbitraryPacket } from '../../src/core/packet.js';
import { Atoms } from '../../src/core/atoms.js';
import assert from 'node:assert/strict';

// Builds a root and a delegate that point up to a topline
async function buildMockDelegate() {
    let relay = new MockSimpleHistoricRelay("http://localhost:8083");
    await relay.initialize();
    await relay.append();

    let root0 = DQ.mint(12, 1);
    root0.setPopTop(relay.first().getHash());
    let root0_shield = new ArbitraryPacket(hexToBytes("001122"));
    root0.buildTwist().setShield(root0_shield);
    root0.buildTwist().setTether(relay.latest());

    let delegate0 = root0.delegate(7);
    let delegate0_shield = new ArbitraryPacket(hexToBytes("334455"));
    delegate0.buildTwist().setShield(delegate0_shield);
    delegate0.buildTwist().setTether(relay.latest());

    let root1 = root0.createSuccessor();
    root1.confirmDelegate(delegate0);
    root1.buildTwist().setTether(relay.latest());

    let delegate1 = delegate0.createSuccessor();
    delegate1.completeDelegate(root1);
    delegate1.buildTwist().setTether(relay.latest());

    await relay.append(null, Shield.rigForHoist(delegate0.getHash(), delegate1.getHash(), delegate0_shield));
    await relay.append(null, Shield.rigForHoist(root0.getHash(), root1.getHash(), root0_shield));

    let final_tw = delegate1.buildTwist().twist();
    final_tw.addAtoms(relay.latest().getAtoms());

    return {topline: relay.twists(),
            delegate: Abject.fromTwist(final_tw),
            root0_shield, delegate0_shield};
}

describe("checkAllRigs", async () => {
    it("Valid root, delegate, and topline: ", async () => {
        let mock = await buildMockDelegate();
        await mock.delegate.checkAllRigs();
    });

    it("Valid delegate and topline, root's shield missing: ", async () => {
        let mock = await buildMockDelegate();
        let atoms = mock.delegate.getAtoms();
        let hash = Sha256.fromPacket(mock.root0_shield);
        mock.delegate.atoms = Atoms.fromPairs(atoms.toPairs().filter(([h,p]) => h+"" === hash+""));
        await assert.rejects(() => mock.delegate.checkAllRigs());
    });

    it("Valid root and topline, delegates's shield missing: ", async () => {
        let mock = await buildMockDelegate();
        let atoms = mock.delegate.getAtoms();
        let hash = Sha256.fromPacket(mock.delegate0_shield);
        mock.delegate.atoms = Atoms.fromPairs(atoms.toPairs().filter(([h,p]) => h+"" === hash+""));
        await assert.rejects(() => mock.delegate.checkAllRigs());
    });

    it("Valid root and delegate, topline sat missing: ", async () => {
        let mock = await buildMockDelegate();
        let satHash = mock.topline[1].packet.getSatsHash();
        let atoms = mock.delegate.getAtoms();
        mock.delegate.atoms = Atoms.fromPairs(atoms.toPairs().filter(([h,p]) => h+"" === satHash + ""));
        await assert.rejects(() => mock.delegate.checkAllRigs());
    });
});
