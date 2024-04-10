import { LocalInventoryClient } from "../../src/client/inventory.js";
import { TodaClient } from "../../src/client/client.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { TestRelayServer } from "./relay_server.js";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

async function initRelay(port, upstreamBaseUrl, upstreamHash, initTwists = 2) {
    const inv = new LocalInventoryClient("./files/" + uuid());
    const toda = new TodaClient(inv, upstreamBaseUrl + "/files");
    await toda.populateInventory();
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
    const toda = new TodaClient(inv, remoteFileServer);
    await toda.populateInventory();
    toda.shieldSalt = path.join(inv.invRoot, "salt");
    fs.writeFileSync(toda.shieldSalt, Buffer.from(uuid(), "utf-8"));
    toda.defaultRelayUrl = remoteRelayUrl;
    toda.defaultTopLineHash = topLineHash;
    const req = await SECP256r1.generate();
    toda.addSatisfier(req);
    const t0 = await toda.create(relayHash, req);
    toda.defaultRelayHash = t0.getHash();
    await toda.append(t0, relayHash, req);
    return { toda, hash: t0.getHash(), req };
}

async function mint(toda, qty, precision, tetherHash, topLineHash) {
    return await toda.mint(qty,
                           precision,
                           tetherHash,
                           topLineHash,
                           JSON.stringify({uuid: uuid()}));
}

export { initRelay, createLine, mint };
