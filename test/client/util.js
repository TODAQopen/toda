import { LocalInventoryClient } from "../../src/client/inventory.js";
import { TodaClientV2 } from "../../src/client/client.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { TestRelayServer } from "./relay_server.js";
import { Abject } from "../../src/abject/abject.js";
import { P1String } from "../../src/abject/primitive.js";
import { DQ } from "../../src/abject/quantity.js";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

async function initRelay(port, upstreamBaseUrl, upstreamHash, initTwists = 2) {
    const inv = new LocalInventoryClient("./files/" + uuid());
    const toda = new TodaClientV2(inv, upstreamBaseUrl + "/files");
    toda.shieldSalt = path.join(inv.invRoot, "salt");
    fs.writeFileSync(toda.shieldSalt, Buffer.from(uuid(), "utf-8"));
    const req = await SECP256r1.generate();
    toda.addSatisfier(req);
    toda.defaultRelayUrl =  upstreamBaseUrl + "/hoist";
    toda.defaultRelayHash = upstreamHash;
    const config = { port };
    if (upstreamBaseUrl) {
        config.fileServerRedirects = [upstreamBaseUrl + "/files"];
    }
    const server = new TestRelayServer(toda, config);
    await server.start();

    const t0 = await toda.create(upstreamHash, req);
    const twists = [t0];
    for (let i = 1; i < initTwists; i ++) {
        twists.push(await toda.append(twists[twists.length - 1], upstreamHash));
    }
    return { toda, server, twists, req };
}

async function createLine(relayHash, 
                          topLineHash = relayHash, 
                          remoteFileServer = "http://localhost:8090/files", 
                          remoteRelayUrl = "http://localhost:8090/hoist") {
    const inv = new LocalInventoryClient("./files/" + uuid());
    const toda = new TodaClientV2(inv, remoteFileServer);
    toda.shieldSalt = path.join(inv.invRoot, "salt");
    fs.writeFileSync(toda.shieldSalt, Buffer.from(uuid(), "utf-8"));
    toda.defaultRelayUrl = remoteRelayUrl;
    toda.defaultTopLineHash = topLineHash;
    toda.defaultRelayHash = relayHash;
    const req = await SECP256r1.generate();
    toda.addSatisfier(req);
    const t0 = await toda.create(toda.defaultRelayHash, req);
    await toda.append(t0, toda.defaultRelayHash, req);
    return { toda, hash: t0.getHash(), req };
}

async function mint(toda, qty, precision, tetherHash, topLineHash) {
    // FIXME: at least a little surprised a mint function isn't in Client...
    const mintingInfo = new P1String(JSON.stringify({uuid: uuid()}));
    const dq = DQ.mint(qty, precision, mintingInfo);
    topLineHash ||= toda.defaultTopLineHash;
    if (topLineHash) {
        dq.setPopTop(topLineHash);
    }
    const dqTwist = await toda.finalizeTwist(dq.buildTwist(),
                                             tetherHash);
    const dqNext = Abject.fromTwist(dqTwist).createSuccessor();
    // FIXME: I can't believe there's no function better than _append...
    await toda._append(dqTwist,
                       dqNext.buildTwist(),
                       tetherHash);
    return dqTwist;
}

export { initRelay, createLine, mint };