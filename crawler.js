var phantom = require('phantom');
var async = require("async");

var sitepage = null;
var phInstance = null;

function wait(expression) {
    return new Promise(function (resolve, reject) {
        var interval = setInterval(function () {
            sitepage.evaluate(expression).then(function (val) {
                if (val) {
                    clearInterval(interval);
                    resolve();
                }
            });
        }, 1000);   //Check every 1s
    });
}

var q;

function goToFirstSearchResultPage(firstName, lastName) {
    return phantom.create()
        .then(instance => {
            phInstance = instance;
            return instance.createPage();
        })
        .then(page => {
            sitepage = page;

            page.onConsoleMessage = function (msg, lineNum, sourceId) {
                console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
            };

            return page.open('https://a836-acris.nyc.gov/DS/DocumentSearch/PartyName');
        })
        .then(() => {
            console.log("Page opened");
            console.log("Filling values");
            sitepage.evaluate(function (param) {
                //Javascript runs on the page
                document.getElementsByName("edt_first")[0].value = param.first;
                document.getElementsByName("edt_last")[0].value = param.last;
                document.getElementsByName("DATA")[0].submit();
            }, {first: firstName, last: lastName});
        })
        .then(function () {
            console.log("Waiting for result page");
            return wait(function () {
                return document.title == "ACRIS Search By Name Results";
            })
        });
}

function processOtherResults() {
    var count = 0;

    q = async.queue(function (data, callback) {
        console.log(`Go to ${data} page`);
        sitepage.evaluate(function () {
            //Javascript runs on the page
            go_next();
        });

        setTimeout(function () {
            wait(function () {
                //Javascript runs on the page
                //You can put further check here for different pages.
                return document.title == "ACRIS Search By Name Results";
            }).then(function () {
                //Jus for debugging, output the screen shot so it is easier to view the page

                console.log("Render screen shot");
                count++;
                sitepage.render(`${count}.png`);
                if (count < 4) {
                    //I put a count here to stop the crawler
                    q.push(count, function () {
                        //Do nothing
                    });
                }

                callback();
            });
        }, 1000);   //1s wait to wait page load
    });

    q.push(count, function () {
        //Do nothing here
    });

    q.drain = function () {
        console.log('all items have been processed');
        sitepage.render("final.png");
        phInstance.exit();
    };
}

goToFirstSearchResultPage("", "brown")
    .then(processOtherResults)
    .catch(error => {
        console.log(error);
        sitepage.render("error.png");
        phInstance.exit();
    });
