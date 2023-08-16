import express from "express";
import { PairTriePacket } from "../../src/core/packet.js";
import { HashMap } from "../../src/core/map.js";
import axios from "axios";
import { LocalNextRelayClient } from "../../src/client/relay.js";
import { Hash } from "../../src/core/hash.js";

function relayServerV2(toda, config = {}) {

    const CONFIG_DEFAULTS = {
        maxFileSize: "100kb"
    };
    config = {
        ...CONFIG_DEFAULTS,
        ...config
    };
    const app = express();

    app.use(express.json());

    // For debugging + tests
    app.requestLogs = [];
    app.use((req, res, next) => {
        app.requestLogs.push(req.method + " " + req.url);
        next();
    });

    app.toda = toda;
    app.address = toda.defaultRelayHash;
    app.fileServerRedirects = config.fileServerRedirects ?? [];

    app.use(express.raw({ limit: config.maxFileSize }));

    async function redirect(file)
    {
        for (const url of app.fileServerRedirects)
        {
            const req = await axios({
                method: "GET",
                url: file,
                baseURL: url,
                responseType: "arraybuffer"
            }).catch(r => r);
            if (req?.status == 200) return req.data;
        }
    }

    function findLocal(file)
    {
        const hex = file.substring(0, file.indexOf('.'));
        const ext = file.substring(file.indexOf('.'));
        const hash = Hash.fromHex(hex);
        const relay = new LocalNextRelayClient(app.toda, hash);
        if (ext == ".shield") {
            const shield = relay._getShield(hash);
            if (!shield) return;
            return Buffer.from(shield.serialize());
        }
        if (ext == ".next.toda") {
            const twist = relay._getNext(hash);
            if (!twist) return;
            return Buffer.from(twist.getAtoms().toBytes());
        }
    }

    app.get("/files/:file", async (req, res, next) => {
        try {
            const file = req.params.file;
            const b = findLocal(file) ?? await redirect(file);
            if (b) return res.status(200).send(b);
            return res.status(404).send();
        } catch (err) {
            next(err);
        }
    });

    app.post("/hoist", async (req, res, next) => {
        const hex = req.body["relay-twist"];
        try {
            const hash = Hash.fromHex(hex);
            const quad = req.body["hoist-request"];
            const hashes = new HashMap();
            for (const [k, v] of Object.entries(quad))
                hashes.set(Hash.fromHex(k), Hash.fromHex(v));

            const updatedTwist = app.toda.get(hash);
            const pairtrie = PairTriePacket.createFromUnsorted(hashes);
            // DON'T WAIT!
            app.toda.append(updatedTwist,
                            updatedTwist.lastFast()?.getTetherHash(),
                            null,
                            null,
                            () => {},
                            pairtrie);
            return res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    app.use((err, req, res, next) => {
        console.error(err)
        return res.status(500);
    });

    return app;
}

async function start(server, { port }) {
    // starts a server and returns it
    let runningServer;
    return new Promise((res, rej) => {
        runningServer = server.listen(port, (err) => {
            if (err) rej(err);
            res();
        });
    }).then(() => runningServer);
}

async function stopRelay(server) {
    // useful for testing
    return new Promise(res => server.close(() => res()));
}

async function startRelay(toda, config) {
    const app = relayServerV2(toda, config);
    const server = await start(app, config);
    server.app = app;
    return server;
}

export { startRelay, stopRelay }