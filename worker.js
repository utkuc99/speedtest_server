//results
var pResult = ""; //ping result
var dResult = ""; //download result
var uResult = ""; //upload result
var dSize = ""; //download size (MB)
var uSize = ""; //upload size (MB)
var tStatus = 0; //test status 0:ready, 1:ping testing, 2:download testing, 3:upload testing
var dTime = "";
var uTime = "";

//settings
var ping_Testfile = "empty.php"; //ping test file
var download_Testfile = "100MB.zip"; //download test file options: 1MB.zip, 10MB.zip, 100MB.zip
var upload_Testfile = "empty.php"; //upload dummy file
var upload_Testfile_Size = 20; // size of blobs used in upload test (megabytes)
var download_Multistream = 6; // amount of download streams to preform
var upload_Multistream = 3; // amount of upload streams to preform
var multistream_Delay = 300; // delay between each download/upload stream
var max_Time = 15; // maximum time a stream can take

//eventListener
this.addEventListener("message", function(e) {
	var mes = e.data.split(" ");
	if(mes[0] == "start"){
		pingTest(); //start test sequence
	}
	else if(mes[0] == "status"){
		postMessage( //post results to html
			JSON.stringify({
				pResult: pResult,
				dResult: dResult,
				uResult: uResult,
				dSize: dSize,
				uSize: uSize,
				tStatus: tStatus,
				dTime: dTime,
				uTime: uTime
			})
		);
	}

});

// stops all ongoing tests
function stop() {
	if (xhr) {
		for (var i = 0; i < xhr.length; i++) {
			xhr[i].onprogress = null;
			xhr[i].onload = null;
			xhr[i].onerror = null;
			xhr[i].upload.onprogress = null;
			xhr[i].upload.onload = null;
			xhr[i].upload.onerror = null;
			xhr[i].abort();
			delete xhr[i];
		}
		xhr = null;
	}
}

//ping test
function pingTest() {
	console.log("Ping Test Started");
	tStatus = 1;
	var temp_Time = null;
	var ping = 0.0;
	var i = 0;
	xhr = [];

	var send_Ping = function() {
		console.log("Ping Test: " + i);
		temp_Time = new Date().getTime();
		xhr[0] = new XMLHttpRequest(); //create new request
		xhr[0].onload = function() {
			if (i === 0) {
				temp_Time = new Date().getTime();
			} else {
				var temp_Result = new Date().getTime() - temp_Time; // calculate ping of the last test

				var p = performance.getEntries(); // JavaScript Performance API
				p = p[p.length - 1];
				var d = p.responseStart - p.requestStart;
				if (d <= 0) d = p.duration; // d is performance result
				if (d > 0 && d < temp_Result) temp_Result = d; // Change temp_Result with performance result if its smaller

				if (i === 1) ping = temp_Result; // if its first test don't compare
				else {
					if (temp_Result < ping) ping = temp_Result; // check if new ping is smaller
				}
			}
			pResult = ping.toFixed(2); //trim result
			i++; // move to next test
			if (i < 10) send_Ping(); //ping again
			else { //test ended
				console.log("Ping Test Ended");
				setTimeout(downloadTest,1000); // proceed to download test
			}
		}.bind(this);
		xhr[0].onerror = function() {
			send_Ping(); //on error ping again
		}.bind(this);
		xhr[0].open("GET", ping_Testfile + "?r=" + Math.random(), true); // create request
		xhr[0].send(); // send request
	}.bind(this);
	send_Ping(); // start ping test
}

function downloadTest(){
	console.log("Download Test Started");
	tStatus = 2;
	var downloaded = 0.0; // bytes
	var start_time = new Date().getTime();
	xhr = [];

	var dTest = function(i, delay) { // test stream function
		setTimeout(
			function() {
				var lastStream = 0; // bytes transmitted by previous streams
				xhr[i] = new XMLHttpRequest(); // create new request
				xhr[i].onprogress = function(event) {
					var diff = event.loaded <= 0 ? 0 : event.loaded - lastStream; //calculate new loaded bytes
					downloaded += diff; // add new loaded bytes to total
					lastStream = event.loaded;
				}.bind(this);

				try {
					xhr[i].responseType = "arraybuffer"; //try to set array buffer
				} catch (e) {}
				xhr[i].open("GET", download_Testfile + "?r=" + Math.random(), true); // create request
				xhr[i].send(); // send request
			}.bind(this),
			1 + delay
		);
	}.bind(this);

	for (var i = 0; i < download_Multistream; i++) {
		dTest(i, multistream_Delay * i); //start new stream
		console.log("Download Test: " + i + " Starting");
	}

	interval = setInterval(
		function() {
			var t = new Date().getTime() - start_time; //test length in time
			if (t < 200) return; //if test length shorter thant 200 milliseconds don't report result
			var speed = downloaded / (t / 1000.0); // calculate speed
			dTime = (t / 1000).toFixed(2);
			dResult = ((speed * 8) / 1000000).toFixed(2); //trim result
			dSize = (downloaded / 1000000).toFixed(2); //trim result
			if (t / 1000.0 > max_Time) {
				stop(); // test time is taking to long stop!
				clearInterval(interval); // delete interval
				console.log("Download Test Finished");
				setTimeout(uploadTest, 1000); // resume to upload test
			}
		}.bind(this),
		200
	);

}



function uploadTest(){
	console.log("Upload Test Started");
	tStatus = 3;
	var uploaded = 0.0; // bytes
	var start_time = new Date().getTime();
	xhr = [];


	// create garbage data/blob for upload test
	var data = new ArrayBuffer(1048576);
	var max = Math.pow(2, 32) - 1;
	try {
		data = new Uint32Array(data);
		for (var i = 0; i < data.length; i++) data[i] = Math.random() * max;
	} catch (e) {}
	var blob = [];
	for (var i = 0; i < upload_Testfile_Size; i++) blob.push(data);
	blob = new Blob(blob);

	var uTest = function() {
		var uStream = function(i, delay) {
			setTimeout(
				function() {
					var lastStream = 0; // bytes transmitted by previous streams
					xhr[i] = new XMLHttpRequest(); // create new request
					xhr[i].upload.onprogress = function(event) {
						var diff = event.loaded <= 0 ? 0 : event.loaded - lastStream; //calculate new loaded bytes
						uploaded += diff; // add new loaded bytes to total
						lastStream = event.loaded;
					}.bind(this);

					xhr[i].open("POST", upload_Testfile + "?r=" + Math.random(), true); // create request
					xhr[i].send(blob); //send request
				}.bind(this),
				delay
			);
		}.bind(this);

		for (var i = 0; i < upload_Multistream; i++) {
			uStream(i, multistream_Delay * i); //start new stream
			console.log("Upload Test: " + i + " Starting");
		}

		interval = setInterval(
			function() {
				var t2 = new Date().getTime() - start_time; //test length in time
				if (t2 < 200) return; //if test length shorter thant 200 milliseconds don't report result
				var speed = uploaded / (t2 / 1000.0); // calculate speed
				uTime = (t2 / 1000).toFixed(2);
				uResult = ((speed * 8) / 1000000).toFixed(2); //trim result
				uSize = (uploaded / 1000000).toFixed(2); //trim result
				if (t2 / 1000.0 > max_Time) {
					stop(); // test time is taking to long stop!
					clearInterval(interval); // delete interval
					console.log("Upload Test Finished"); // test finished do nothing
					tStatus = 0;
					console.log("Test Finished");
				}

			}.bind(this),
			200
		);
	}.bind(this);
	uTest(); // start upload test
}

