const { DQ } = require("../abject/quantity");
const { Twist } = require("../core/twist");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

//todo(mje): CERTIFICATES
// https://medium.com/@eduardoqgomes/creating-a-certificate-template-with-pdfkit-in-node-js-dd843e09e6cf

async function generateAuditReport(dq, out) {
    let description = describe(dq);

    // Create a document and pipe the output
    const doc = new PDFDocument({
        font: "Courier",
        bufferPages: true,
        margins: {
            top: 25,
            bottom: 25,
            left: 36,
            right: 36
        },
        info: {
            Title: dq.getHash().toString(),
            Author: "TodaQ",
            Subject: "Audit Report",
        }
    });

    // We could instead return a blob and have some other fn write it out
    doc.pipe(fs.createWriteStream(path.resolve(__dirname, out || "examples/output.pdf")));
    doc.fontSize(6);

    // Adds assets common to each page
    formatPage(doc, `Audit Report for ${dq.getHash()}`);
    doc.on("pageAdded", () => formatPage(doc));

    await renderDescription(doc, description);

    // Finalize PDF file
    addPageNumbers(doc);
    doc.end();
}

function formatPage(doc, title) {
    doc.font("Courier-Bold");

    if (title) {
        doc.text(title, { align: "center" });
        doc.moveDown(4);
    }

    doc.text("Value".padEnd(15), { continued: true });
    doc.text("Spent".padEnd(15), { continued: true });
    doc.text("Notes".padEnd(20), { continued: true });
    doc.text("Date".padEnd(35), { continued: true });
    doc.text("Twist".padEnd(30), { continued: true });
    doc.text("Tether".padEnd(20), { continued: true });

    doc.font("Courier").moveDown(4);

    // Resets the doc.y position
    doc.text("");
}

async function addQR(doc, data, x, y) {
    let qr = await QRCode.toDataURL(`toda:${data}`, {
        color: {
            dark: "#000",
            light: "#0000"
        }
    });
    doc.image(qr, x, y, { height: 20, width: 20 });
}

async function renderDescription(doc, description) {
    let alt = false;

    for (let twist of description) {
        // This is to ensure a new page is triggered before doing the rectangle fill
        doc.text("");

        // Colour the row background
        let fill = alt ? "#aef2dc" : "#e9fbf6";
        doc.rect(doc.page.margins.left - 5, doc.y - 10, doc.page.width - doc.page.margins.right - doc.page.margins.left, 26).fill(fill);
        doc.fill("black");

        // Value
        doc.text(twist.value.toString().padEnd(15), { continued: true });

        // Spent
        let spent = twist.spent[0] > 0 ? twist.spent[0] : "-";
        doc.text(`${spent}`.padEnd(15), { continued: true });

        // Notes
        doc.text(getTwistLabel(twist).padEnd(20), { continued: true });

        // Date
        if (twist.timestamp) {
            doc.text(new Date(twist.timestamp).toLocaleString("en-US", { hour12: false }).padEnd(42), { continued: true });
        } else {
            doc.text("-".padEnd(42), { continued: true });
        }


        // Twist & tether hash
        doc.text(twist.hash.substring(0, 7).padEnd(30), { continued: true });
        doc.text(twist.tether.substring(0, 7).padEnd(20));

        // Twist & tether QR
        await addQR(doc, twist.hash, doc.x + 304, doc.y -14);

        if (twist.tether) {
            await addQR(doc, twist.tether, doc.x + 412, doc.y - 14);
        }

        doc.moveDown(3);
        alt = !alt;
    }
}

function addPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.count; i++) {
        doc.switchToPage(i);

        // Footer: Add page number
        // Have to remove bottom margin in order to write into it
        let oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.text(`Page: ${i + 1} of ${range.count}`, 0, doc.page.height - (oldBottomMargin/2), { align: "center" });
        doc.page.margins.bottom = oldBottomMargin;
    }
}

function getTwistLabel(twist) {
    if (twist.master) {
        return "Minted";
    } else if (twist.latest && twist.inner) {
        return "Split note";
    } else if (twist.latest) {
        return "Latest revision";
    } else if (twist.hasParent) {
        return "New note";
    } else {
        return "";
    }
}

// Borrowed from TodaTwin
//todo(acg): consider adding something like this to abject/delegableActionable
function describe(dq, isParent) {
    let res = [];
    let parent = null;
    let addTwist = function (x) {
        let atoms = x.serialize();
        let tw = new Twist(atoms, x.getHash());

        let descr = {
            value: x.value(),
            spent: [],
            hash: x.getHash().toString(),
            tether: tw.isTethered() ? tw.body.getTetherHash().toString() : "",
            timestamp: x.getPoptopTimestamp(),
            inner: isParent
        };

        let cd = x.confirmedDelegates();
        if (cd) {
            for (let del of cd) {
                descr.spent.push(x.quantityToValue(del.getContext().getFieldAbject(DQ.context.fieldSyms.quantity)));
            }
        }
        let _parent = x.delegateOf();
        if (_parent) {
            parent = _parent;
        }

        if (x.isFirst() && !parent) {
            descr.master = "true";
        }

        res.push(descr);
    };

    if (dq.isFirst()) {
        addTwist(dq);
    } else {
        while (dq.prev()) {
            addTwist(dq);
            dq = dq.prev();
        }
        addTwist(dq);
    }
    res[0].latest = "true";

    if (parent) {
        res.pop();
        let parentDesc = describe(parent.delegateOf(), true);
        res[res.length - 1].hasParent = true;
        res = res.concat(parentDesc);
    }

    return res;
}

exports.generateAuditReport = generateAuditReport;
