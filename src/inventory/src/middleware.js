/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

function hostnameRouting({enableHostnameRouting}) {
    if (enableHostnameRouting) {
        return function (req, res, next) {
            req.toda = {...req.toda, subdir: req.hostname || ""};
            next();
        };
    } else {
        return function (req, res, next) {
            req.toda = {...req.toda, subdir: ""};
            next();
        };
    }
}

exports.hostnameRouting = hostnameRouting;
