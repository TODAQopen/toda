const { DQ } = require("../abject/quantity");
const { Twist } = require("../core/twist");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const BIconArrowDownRight = path.resolve(__dirname, "assets/arrow-down-right.png");
const BIconArrowRight = path.resolve(__dirname, "assets/arrow-right.png");
const BIconArrowUp = path.resolve(__dirname, "assets/arrow-up.png");
const BIconArrowUpLeft = path.resolve(__dirname, "assets/arrow-up-left.png");
const BIconStars = path.resolve(__dirname, "assets/stars.png");

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
    doc.fontSize(8);

    // Adds assets common to each page
    formatPage(doc, `Audit Report for ${dq.getHash()}`);
    doc.on("pageAdded", () => formatPage(doc));

    await renderDescription(doc, description);

    // Finalize PDF file
    addPageNumbers(doc);
    doc.end();
}

function formatPage(doc, title) {
    if (title) {
        doc.image(path.resolve(__dirname, "assets/favicon.ico"), { width: 8, height: 8 });
        doc.moveUp(1);
        doc.font("Courier-Bold").text(title, doc.x + 10, doc.y + 1);
        doc.x -= 10;
    }

    doc.font("Courier").moveDown(4);
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

function getTwistIcon(twist, inner) {
    if (twist.master) {
        return BIconStars;
    } else if (twist.parent) {
        return BIconArrowDownRight;
    } else if (twist.latest && inner) {
        return BIconArrowUpLeft;
    } else if (twist.latest) {
        return BIconArrowRight;
    } else {
        return BIconArrowUp;
    }
}

function getTwistLabel(twist, inner) {
    if (twist.master) {
        return "Minted";
    } else if (twist.latest && inner) {
        return "Split note";
    } else if (twist.latest) {
        return "Latest revision";
    } else if (twist.parent) {
        return "New note";
    } else {
        return "";
    }
}

// todo(mje): What do we do if there are many levels of indenting that would take us off the page?
async function renderDescription(doc, description, inner = 0) {
    // Need to apply an X modifier to everything based inner/indent level
    const labelSpacing = 72;
    const indent = inner > 0 ? 20 : 0;
    doc.x += indent;

    for (let twist of description) {
        // Value
        doc.text("     ", { continued: true });
        doc.text(twist.value.toString().padEnd(10), { continued: true });

        // Icon (Add this after adding the text, since text can trigger a new page but image cannot)
        doc.image(getTwistIcon(twist, inner > 0), { width: 8, height: 8, align: "center", valign: "center" });
        doc.moveUp(1);

        // Twist hash & QR code
        doc.text(twist.hash);
        let qrURL = await QRCode.toDataURL(`toda:${twist.hash}`);
        doc.image(qrURL, doc.x + 400, doc.y -15, { height: 40, width: 40, align: "center", valign: "center" });

        // Tether hash
        doc.text("     Tether:   ", {continued: true});
        doc.text(twist.tether, doc.x, doc.y);

        // Sub Label details
        let label = twist.spent.length > 0 ?
            `${getTwistLabel(twist, inner > 0)} · Spent ${twist.spent[0]}` :
            getTwistLabel(twist, inner > 0);

        doc.text(label, doc.x + labelSpacing, doc.y);
        doc.x -= labelSpacing;
        doc.moveDown(4);

        // Recurse
        if (twist.parent) {
            await renderDescription(doc, twist.parent, inner + 1);
        }
    }

    doc.x -= indent;
}

// Borrowed from TodaTwin
//todo(acg): consider adding something like this to abject/delegableActionable
function describe(dq) {
    let res = [];
    let parent = null;
    let addTwist = function(x) {
        let tw = new Twist(x.serialize(), x.getHash());
        let descr = {value: x.value(), spent: [], hash: x.getHash().toString(), tether: tw.tether()?.getHash().toString()};
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
        res[res.length - 1].parent = describe(parent.delegateOf());
    }

    return res;
}

exports.generateAuditReport = generateAuditReport;
