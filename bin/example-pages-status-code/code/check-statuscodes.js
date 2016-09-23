var fs = require("fs"),
    urlsFile = "urls.txt",
    resultsFile = "results.csv",
    urls = [],
    results = [["Url, Status"]];

try {
  urls = fs.read(urlsFile).replace(/\r?\n|\r/g, "\n").replace(/\n+/g, "\n").split("\n");
} catch(err) {
  console.log("Error parsing urls file");
  phantom.exit();
}

getNextUrl();

function getNextUrl() {
  if (urls.length < 1) {
    return finish();
  }

  var url = urls.pop();

  if (url.length < 1) {
    return getNextUrl();
  }

  getUrlStatus(url, function(err, url, status){
    if (err) {
      console.log(err);
    }

    results.push(['"'+url+'", "'+status+'"']);

    getNextUrl();
  });
}

function getUrlStatus(url, done) {

  var webPage = require('webpage'),
      page = webPage.create(),
      finished = false;

  console.log("Processing "+url+" ("+urls.length+" left)");

  page.settings.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:41.0) Gecko/20100101 Firefox/41.0';
  page.settings.resourceTimeout = 30000;

  page.viewportSize = {
    width: 1024,
    height: 768
  };

  page.onResourceRequested = function(requestData, networkRequest) {
    if (finished || requestData.url.match(/\.(?:css|js|gif|jpg|png)$/)) {
      networkRequest.abort();
    }
  };

  page.onResourceReceived = function(response) {

    if (finished || response.stage != 'end' || response.url.length<1) {
      return;
    }

    finished = true;

    done(null, url, response.status || 404);
  };

  page.open(url, function(status){
    if (!finished) {
      return done('Invalid request to '+url, url, 0);
    }
  });
}

function finish() {
  fs.write(resultsFile, results.join("\n"), "w");
  console.log("DONE");
  phantom.exit();
}
