// This is a template for a Node.js scraper on morph.io (https://morph.io)

var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var ranger = require('power-ranger');

var endpoint = "http://www.aec.gov.au/Enrolling_to_vote/Enrolment_stats/gazetted/{yr}/{mth}.htm";

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		db.run("CREATE TABLE IF NOT EXISTS data (year INTEGER, month INTEGER, division TEXT, state TEXT, enrollment INTEGER, deviation NUMBER, PRIMARY KEY (year, month, division))");
		callback(db);
	});
}

function updateRow(db, values) {
	// Insert some data.
	var statement = db.prepare("INSERT OR REPLACE INTO data VALUES (?,?,?,?,?,?)");
	statement.run(values);
	statement.finalize();
}


function fetchPage(url, callback) {
	// Use request to read in pages.
	console.log("Fetching: " + url);
	request(url, function (error, response, body) {
		if (error) {
			console.error("Error requesting page: " + error);
			return;
		}

		callback(body);
	});
}

function run(db) {
	// Use request to read in pages.

	var date = new Date(2004, 0);
	var now = new Date();

	while (date.getFullYear() < now.getFullYear() || (date.getFullYear() === now.getFullYear() && date.getMonth() < now.getMonth())) {
		var year, month;
		year = date.getFullYear();
		month = date.getMonth()+1;
		db.get('SELECT COUNT(*) AS count FROM data WHERE month = ? AND year = ?', [month, year], checkExisting(db, year, month));
		date.setMonth(date.getMonth() + 1);
	}
}

function checkExisting(db,year,month) {
	var url = endpoint.replace('{yr}', year).replace('{mth}', pad(month,2));
	return function(err, result){
		if (err) {
			console.error("Error checking for existing records: " + error);
		}

		if (result.count > 0) {
			console.log("Records exist for " + year + '-' + month);
		} else {
			fetchPage(url, scrapeData(db, year, month));
		}
	};
}

function scrapeData(db, year, month) {
	return function scrapeData(body) {

		// Use cheerio to find things in the page with css selectors.
		var count = 0,
			$ = cheerio.load(body);

		$('table').each(function() {
			var state = $(this).attr('id');
			$(this).find('tbody tr').each(function(){
				var $row = $(this);
				count++;
				updateRow(db,[
					year,
					month,
					$row.children().eq(0).text(),
					state,
					$row.children().eq(1).text(),
					$row.children().eq(2).text()
				]);
			});
		});
		console.log(count + ' records found for ' + year + '-' + month);
	};
}

// https://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript#10073788
function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

initDatabase(run);
