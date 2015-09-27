/* global chrome:false */

// we need a queue of permission callback functions because of
// multiple async requests now needed... it's yucky and sad. Thanks, Chrome. :(
var permissionQueue = {
	count: 0,
	onloads: []
};


chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		switch (request.requestType) {
			case 'localStorage':
				if (typeof RESStorage.setItem !== 'function') {
					// if RESStorage isn't ready yet, wait a moment, then try setting again.
					var waitForRESStorage = function(request) {
						if ((typeof RESStorage !== 'undefined') && (typeof RESStorage.setItem === 'function')) {
							RESStorage.setItem(request.itemName, request.itemValue, true);
						} else {
							setTimeout(function() {
								waitForRESStorage(request);
							}, 50);
						}
					};
					waitForRESStorage(request);
				} else {
					RESStorage.setItem(request.itemName, request.itemValue, true);
				}
				break;
			case 'permissions':
				// TODO: maybe add a type here? right now only reason is for twitter expandos so text is hard coded, etc.
				// result will just be true/false here. if false, permission was rejected.
				if (!request.result) {
					modules['notifications'].showNotification('You clicked "Deny". RES needs permission to access the Twitter API at ' +
						request.data.origins[0] + ' for twitter expandos to show twitter posts in-line. ' +
						'Be assured RES does not access any of your information on twitter.com - it only accesses the API.',
						10);
					permissionQueue.onloads[request.callbackID](false);
				} else {
					permissionQueue.onloads[request.callbackID](true);
				}
				break;
			case 'subredditStyle':
				var toggle = !modules['styleTweaks'].styleToggleCheckbox.checked;
				modules['styleTweaks'].toggleSubredditStyle(toggle, RESUtils.currentSubreddit());
				break;
			case 'multicast':
				RESUtils.rpc(request.moduleID, request.method, request.arguments);
				break;
			default:
				// sendResponse({status: 'unrecognized request type'});
				break;
		}
	}
);

RESUtils.runtime = RESUtils.runtime || {};
RESUtils.runtime.ajax = function(obj) {
	var crossDomain = (obj.url.indexOf(location.hostname) === -1);

	if ((typeof obj.onload !== 'undefined') && (crossDomain)) {
		obj.requestType = 'ajax';
		if (typeof obj.onload !== 'undefined') {
			chrome.runtime.sendMessage(obj, function(response) {
				obj.onload(response);
			});
		}
	} else {
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
			if (obj.onreadystatechange) {
				obj.onreadystatechange(request);
			}
			if (request.readyState === 4 && obj.onload) {
				obj.onload(request);
			}
		};
		request.onerror = function() {
			if (obj.onerror) {
				obj.onerror(request);
			}
		};
		try {
			request.open(obj.method, obj.url, true);
		} catch (e) {
			if (obj.onerror) {
				obj.onerror({
					readyState: 4,
					responseHeaders: '',
					responseText: '',
					responseXML: '',
					status: 403,
					statusText: 'Forbidden'
				});
			}
			return;
		}
		if (obj.headers) {
			for (var name in obj.headers) {
				request.setRequestHeader(name, obj.headers[name]);
			}
		}
		request.send(obj.data);
		return request;
	}
};

RESLoadResourceAsText = function(filename, callback) {
	// Normally we'd grab these through an XHR, but that's broken (Bug 1208756)
	if (!filename in blobs) {
		console.error("Unable to load", filename);
	}
	callback(blobs[filename]);
};

RESUtils.runtime.storageSetup = function(thisJSON) {
	// we've got chrome, get a copy of the background page's localStorage first, so don't init until after.
	chrome.runtime.sendMessage(thisJSON, function(response) {
		// Does RESStorage have actual data in it?  If it doesn't, they're a legacy user, we need to copy
		// old school localStorage from the foreground page to the background page to keep their settings...
		if (!response || typeof response.importedFromForeground === 'undefined') {
			// it doesn't exist.. copy it over...
			var ls = {};
			for (var i = 0, len = localStorage.length; i < len; i++) {
				if (localStorage.key(i)) {
					ls[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
				}
			}
			var thisJSON = {
				requestType: 'saveLocalStorage',
				data: ls
			};
			chrome.runtime.sendMessage(thisJSON, function(response) {
				RESStorage.setup.complete(response);
			});
		} else {
			RESStorage.setup.complete(response);
		}
	});
};


RESUtils.runtime.sendMessage = function(thisJSON) {
	chrome.runtime.sendMessage(thisJSON);
};

/* Use generic fallback method from browsersupport.js
 * See Bug 1197417
RESUtils.runtime.deleteCookie = function(cookieName) {
	var deferred = new $.Deferred();

	var requestJSON = {
		requestType: 'deleteCookie',
		host: location.protocol + '//' + location.host,
		cname: cookieName
	};
	chrome.runtime.sendMessage(requestJSON, function(response) {
		deferred.resolve(cookieName);
	});

	return deferred;
};
*/

RESUtils.runtime.openInNewWindow = function(thisHREF) {
	var thisJSON = {
		requestType: 'keyboardNav',
		linkURL: thisHREF
	};
	chrome.runtime.sendMessage(thisJSON);
};

RESUtils.runtime.openLinkInNewTab = function(thisHREF) {
	var thisJSON = {
		requestType: 'openLinkInNewTab',
		linkURL: thisHREF
	};
	chrome.runtime.sendMessage(thisJSON);
};

RESUtils.runtime.addURLToHistory = (function() {
	var original = RESUtils.runtime.addURLToHistory;

	return function(url) {
		if (chrome.extension.inIncognitoContext) {
			return;
		}

		original(url);
	};
})();

// Huge kludge to skirt around Bug 1208756
blobs = {};

blobs["modules/hosts/hosts.json"] = `{
	"hosts": [ "imgrush" ]
}`

blobs["core/templates.html"] = `<!doctype html>
<!--
	If you want a new template, add something like this:
		<div id="example">
			Mustache template goes here: {{ foobar }}
		</div>
	And then it'll be available with this:
		RESTemplates.compile("example")
		RESTemplates.example.text({ foobar: "Hello, world" }) -> "Mustache template goes here: Hello, world"
		RESTemplates.example.html({ foobar: "Hello, world" }) -> HTML element
-->
<html>
	<body>
		<div id="test">
			<p>Hello, {{ name }}</p>
		</div>


		<div id="commandLine">
			<div id="keyCommandLineWidget">
				<form id="keyCommandForm">
					<input id="keyCommandInput" type="text">
					type a command, ? for help, esc to close

					<div id="keyCommandInputTip"></div>
					<div id="keyCommandInputError"></div>
				</form>
			</div>
		</div>

		<style type="text/css" id="spoiler-styles">
			a[href="/s"], a[href="/spoiler"], a[href="#s"], a[href="#spoiler"]
			{
				color: transparent !important;
				background-color: #000;
				outline: 1px #111 solid;
				cursor: default;
				{{#transition}}
				-webkit-transition: color 1.5s ease-in-out;
				-moz-transition: color 1.5s ease-in-out;
				-o-transition: color 1.5s ease-in-out;
				transition: color 1.5s ease-in-out;
				{{/transition}}
			}
			.res-nightmode a[href="/s"], .res-nightmode a[href="/spoiler"], .res-nightmode a[href="#s"], .res-nightmode a[href="#spoiler"]
			{
				background-color: #111 !important;
				outline: 1px #222 solid;
			}

			.res a[href="/s"]:hover, .res a[href="/spoiler"]:hover, .res a[href="#s"]:hover, .res a[href="#spoiler"]:hover,
			.res a[href="/s"]:active, .res a[href="/spoiler"]:active, .res a[href="#s"]:active, .res a[href="#spoiler"]:active
			{
				color: #ddd !important;
				background-image: none;
			}
		</style>

		<!-- Submit issues wizard -->
		<style type="text/css" id="submitWizardCSS">
		#submittingToEnhancement { display: none; min-height: 300px; font-size: 14px; line-height: 15px; margin-top: 10px; width: 518px; position: absolute; z-index: 999; } #submittingToEnhancement ol { margin-left: 10px; margin-top: 15px; list-style-type: decimal; } #submittingToEnhancement li { margin-left: 25px; }
		.submittingToEnhancementButton { border: 1px solid #444; border-radius: 2px; padding: 3px 6px; cursor: pointer; display: inline-block; margin-top: 12px; }
		#RESSubmitAprilFools { background: #F87; color: black; margin-top: 2em;  padding: 1em;}
		#RESBugReport, #RESFeatureRequest { display: none; }
		#RESSubmitOptions .submittingToEnhancementButton { margin-top: 30px; }
		</style>


		<div id="submitWizard">
			<h3>Let's talk about Reddit Enhancement Suite</h3>
			<div class="RESDialogContents">
				<div id="RESSubmitOptions">
					What's on your mind?<br>

					{{#foolin}}
					<div id="RESSubmitAprilFools">
						Enjoy April Fool's. RES can't turn off any of reddit's shenanigans. However, <a href="/r/Enhancement/wiki/faq/srstyle" target="_blank">you can turn off subreddit styles</a>.
					</div>
					{{/foolin}}

					<div id="RESSubmitBug" class="submittingToEnhancementButton" title="Post a problem to /r/RESissues">
						I'm having issues or found a bug
					</div><br>
					<div id="RESSubmitFeatureRequest" class="submittingToEnhancementButton" title="Post a request to /r/Enhancement">I have an idea for a feature</div><br>
					<div id="RESSubmitOther" class="submittingToEnhancementButton" title="Start a discussion on  /r/Enhancement">I'm not having any problems, but have a question</div>
				</div>
				<div id="RESBugReport">
					Do you need help with RES or want to report a bug?
					<br>
					<ol>
						<li>Try <a href="/r/RESissues/wiki/postanissue">troubleshooting it yourself</a>.</li>
						<li>Have you <a target="_blank" href="/r/RESissues/search?restrict_sr=on">searched /r/RESIssues</a> to see if someone else has reported it?</li>
						<li>Check the <a target="_blank" href="/r/Enhancement/wiki/faq">RES FAQ</a> </li>
						<li>
							This might already be a known issue:
							<ul id="RESKnownBugs"><li style="color: red;">Loading...</li></ul>
						</li>
					</ol>

					<span id="submittingBug" class="submittingToEnhancementButton">I've checked, double-checked, and still want to post an issue.</span>
				</div>
				<div id="RESFeatureRequest">
					So you want to request a feature. Great! Please just consider the following first:<br>
					<ol>
						<li>Have you <a target="_blank" href="/r/Enhancement/search?restrict_sr=on">searched /r/Enhancement</a> to see if someone else has requested it?</li>
						<li>Would your idea appeal to many redditors? Personal or subreddit-specific requests usually aren't added to RES.</li>
						<li>See if someone else has already requested this:
							<ul id="RESKnownFeatureRequests"><li style="color: red;">Loading...</li></ul>
						</li>
					</ol>
					<span id="submittingFeature" class="submittingToEnhancementButton">I still want to submit a feature request!</span>
				</div>
			</div>



		</div>

		<!-- RESConsole -->
		<div id="settingsConsole">
			<div id="RESConsoleContainer">
				<div id="RESConsoleHeader">
					<div id="RESConsoleTopBar" class="RESDialogTopBar">
						<img id="RESLogo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAMAAABHRo19AAAACXBIWXMAAA7EAAAOxAGVKw4bAAACxFBMVEXw8/wAAAD+//8EBAQSEhIPDw/w8/v+/v4JCQkHBwcCAgKSk5W8vLz9SADz8/MtLS0iIiIcHBz/VAAYGBmRkZFkZGUkJCQVFhZiYmOZmp2QkpfQ09r9/f3n6vA5OTkvLy//TAAxMTEUFRTl5eVqa2zu8fnt7/fV19ydnqCen6Lt8Pj/TwDk5ORaWlrg4ug1NTUpKSrX19cgICDp6/J6enrFxcW1trpDQ0M7OzwnJyenp6f6TQAXFxj/WACFhojr6+uNjpBHR0cfHx+vr7GSkpJMTEwYGBg+Pj5cXF3CwsJISEj29vYQEBDe3t7+SwBmZmixsbH19fXo6OhQUFAgICJgYWXHyM3q7PTs7vW3uLvb3eKqq650dXbS09js7/aTlJY5OjmUlJeenp7r7vWWl5n8/Px4eHihoqWEhYfO0NTj5euDg4Pa3OGRkpTJy8/g4ODe4Obc3Nzv8vqjo6O1tbW3uLyrq6t1dXX5ya5/f3/5xqxZWVqKiopra2v4uJb99vLCw8fFxsouLS6Oj5Hs7OzY2t+jpKZ4eXv2tY8NDQ35WQny8vJkZGT2lWGQkJB8fHzi5OrLzNFAQUPm6O/3f0W7u7v3oXP4dTb2nXH62MX3pHb87+bn5+dWV1dvb3E0NDT4lWP3jFP4vJn2cS79+vaJioxNTU376d72f0H4Wwf2fT7759z9+fX1lmH4XAv2bSb40bheX2A6Ojr9+vj76t/9+vf76+H5XxVGRkZxcnPQ0te+vr52dnaztLfExMT2tZFYWFhSUlLV1dVwcXL52MS4uLiysrKam5rW1tZPT1CVlZWYmJiUlJRHR0ipqq0qKiqzs7P39/fq6urj4+P89fH09PT6+vo4ODjq7PNsbW4oKCh0dHTv7++3t7fk5u2IiYtFRUU3NzdPT0/Kysru7u6NjY1tbW1gYGBfX19sbGyHh4fh4eEzPXfuAAACPElEQVR4Xq3SQ9fkQBTH4bpVSdru17Zt28bYtm3btm3btm37S8yk0oteTKc7c+a3uf/Nc3JyEvT/48KF69Uhu7dk3AfaZ48PRiHgUwLdpGLdtFbecrkPOxvjuSRcmp2vaIsQt6gdLME4UtlGGs6NFW7+GIw7Qidp2BAq3KaQWg650mwC9LSs6JpRfZG03PTo32reMrmzIW3IlGaSZY/W+aCcoY/xq1SCKXAC5xAaGObkFoSmZoK3uaxqlgzL6vol3UohjIpDLWq6J4jaaNZUnsb4syMCsHU5o10q4015sZAshp2LuuCu4DSZFzJrrh0GURj3Ai8BNHrQ08TdyvZXDsDzYBD+W4OJK5bFh9nGIaRuKKTTxw5fOtJTUCtWjh3H31NQiCdOso2DiVlXSsXGDN+M6XRdnlmtmUNXYrGaLPhD3IFvoQfQrH4KkMdRsjgiK2IZXcurs4zHVvFrdSasQTaeTFu7DtPWa4yaDXSd0xh9N22mMyUVieItWwW8bfuOnbvo2r1n7779mOZ6QByHHsRChw4fsXwsz6OPsdDxE0i0kyQA20rLFIhjzuW0TVxIgpB4Z+AsBRXn1RZTdeEivXFyFbLXJTaJvmkDNJgLrly95iR3juTt9eIbyH6ucJPq2hJGQQiru63lbbriDocc6C7cu1/BgwcPH9U/4cdT9TNQIcd6/oK8fFWbg4Vev0n0I6VvkcO9A38Fq495X5T3wZkhLvAROZ6KYT59Lvvy9VvU9x8/1fW/DEygHfEbNdeCkgdk4HMAAAAASUVORK5CYII=">
						<h1>{{name}}</h1>
						<div id="RESConsoleVersionDisplay">v{{version}}</div>


						<button id="moduleOptionsSave">save options</button>
						<div id="moduleOptionsSaveStatus" class="saveStatus" style="display: none;">Options have been saved...</div>
						<a id="RESConsoleSubredditLink" href="/r/Enhancement" alt="The RES Subreddit">/r/Enhancement</a>
						<span id="RESClose" class="RESCloseButton">×</span>
					</div>
				</div>

				<div id="RESConsoleContent">
					<div id="RESConfigPanelModulesPane">
						<div id="SearchRES-input-container"></div>

						<div id="RESConfigPanelModulesList"></div>

						<label id="RESAllOptionsSpan">
							<input id="RESAllOptions" type="checkbox">
							<span>Show advanced options</span>
						</label>
					</div>
					<div id="RESConfigPanelOptions">
						<div class="moduleHeader">
							<span class="moduleName">Module Name</span>
							<div class="moduleToggle toggleButton enabled" moduleID="moduleID">
								<span class="toggleOn noCtrlF" data-text="on"></span>
								<span class="toggleOff noCtrlF" data-text="off"></span>
							</div>

							<div class="moduleDescription"></div>
						</div>
						<div id="allOptionsContainer"></div>
						<div id="noOptions" class="optionContainer">
							There are no configurable options for this module.
						</div>
					</div>
				</div>
			</div>
		</div>

		<div id="settingsConsoleSearch">
			<form id="SearchRES-input-container">
				<input id="SearchRES-input" type="text" placeholder="search RES settings" />
				<button id="SearchRES-input-submit" type="submit">
					<span class="res-icon">&#xF094;</span>
				</button>
			</form>
		</div>

		<div id="settingsConsoleModuleSelector">
			<ul>
			{{#categories}}
				<li class="RESConfigPanelCategory" data-category="{{name}}">
					<h3 class="categoryButton" data-category="{{name}}">{{name}}</h3>
					<ul>
					{{#modules}}
						<li class="moduleButton {{#isEnabled}}enabled{{/isEnabled}}" data-module="{{moduleID}}">
							{{moduleName}}
						</li>
					{{/modules}}
					</ul>
				</li>
			{{/categories}}
			</ul>
		</div>


		<div id="contributeRESPanel">
			<div id="contributeContents">
				<p>RES is entirely free - as in beer, as in open source, as in everything.  If you like our work, a contribution would be greatly appreciated.</p>

				<p>When you contribute, you make it possible for the team to cover hosting costs and other expenses so that we can focus on doing what we do best: making your Reddit experience even better.</p>

				<h2>Fee-free donation methods:</h2>

				<div class="donateOption">
					<p>Dwolla</p>
					<a target="_blank" href="https://www.dwolla.com/u/812-686-0217"><img src="data:image/png;base64,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"></a>
				</div>



				<div class="donateOption">
					<p>Dogecoin</p>
					<a href="dogecoin:DNmr7pr6b2MKojd1YaLuSuBCgwDnkt3gYb">
						<img src="data:image/png;base64,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"><br>
						<p><em>DNmr7pr6b2MKojd1YaLuSuBCgwDnkt3gYb</em></p>
					</a>
				</div>

				<div class="donateOption">
					<p>Bitcoin via BitPay</p>
					<form action="https://bitpay.com/checkout" method="post" >
						<input type="hidden" name="action" value="checkout" />
						<input type="hidden" name="posData" value="" />
						<input type="hidden" name="data" value="ddFrz5v8dCQ/2oQV9a+OLm3nVrlinxOo1WYFsRjZR5IoouplTgMj7zg8OB3i5xSYiPTbyUmBiNjoY9z/iuEwqPvQClXqQdGINb+IVIzjuZobCUDsLUztc2qdQHvU/sLQzf3a339vzs9JAwSj6W/IpNt90WN1Bdab491xtPpeCIwcS84WY0T+QDjN0c5+1k8/rNqr6A6hFX4TWwZrxQiv35Bl/xyo+YLrE9OUM0K+2cu1hsc7/sOMNsqIB1v4W5CMkQFP40sq9CWf14nyvYbZtg==" />
						<input type="image" src="data:image/png;base64,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" border="0" name="submit" alt="BitPay, the easy way to pay with bitcoins." ><br>
						<input type="text" name="price" size="2" value="" /> bitcoins
					</form>
				</div>

				<div class="donateOption">
					<p>Bitcoin</p>
					<a href="bitcoin:178fi133fomyp1kTn9TMPEE8ucwTzrp8b1">
						<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAABKCAYAAAAc0MJxAAAEOElEQVR4Ae3YwY4TQAwD0C3i/38ZEOrbg0dWptsew8XYcTLFiVqJx59/f772z5jAr9Gxhv8JbFCXh7BBXQb1O32PxyOlK96+6sx7t+5DmGNu6jhMH31C7/DtRUliwOOi+DNRemJuLHn6k+c72X9b15d+7zVdHZqDw70oSQxYL0pfS3ja0FRv8/Xlu8n5zLnFnKNvmrcXJakBx4sa+o+yzdgczkjHW53On5xuDqTz09/FvajLBD9+UTbqfTw3nJyfro+emD48fZ/ie1GXSY4X9dNN6Zsuw+dMX/arp47nnNTVm67ecC+qJRN6vSgbDP/HqXdsGs+Hst549uFtrvqEe1FTQs/6499mPvo/nDZnLO7zpJ6cL5GPnnPp6aO/i3tRlwkeF5WbsiE6bj4dzzq9+ej6kuuHU50P8uMw30sdh3tRkhjw+NWTtD4boePqqbc6P+TLfvWG6cebP/XJn59L/16UJAY8Lkqi+myAnjx1fbeonz/nJ3/Vxw/be61O34uSxIDXv3rDnC+bahfQ+vnV2xw+df6G/Or66Mn5Gu5FtWRCP76jon5cirqN4JCem1On4/y4Oh1Xh6nzqyenw+yn68v6XpSEBjy+o9Iv4dTxTJ6uT71x/nfx3Xdav8+1FyWJAY/vKJsf+r5yA/x0+Oo8c/SZQ2/Ir47rx9VTV6fzwb0oSQx4XFT6JSzxVk+9+fnMxfmbzqfOT2+YPv38ePrU4V6UJAasv3pTwrmJ5Pluq9PT7/2f1s0zB4evzt2LktyAx0XZgMQbN5cPh9mXOj5hzs+5jZur/9anL3EvKhMp/PjVs4H0t43Q04+3undaXf+rOM31Hp/5dDzre1GSGfC4KMlmoua0euq4PvNSzzo++VpdP0xffg6cPzl9L0oSA46/eq0/N8WXG+FLnR/y4c0/+aa6+Q315/t7US2x0I/vKElKNvzflO9beP5FnzpMXR8dT3/qONSvjw5bnc434V7UlNCzflxUS3ramPea71b3fvrp+U7T+RL5cz6fOg73oiQx4PGrx5/Jtg00Px22/k+9M81vdZ/P52i+vShJDXhcVEuWbp7k6bj6q7o+qB9/db6+CW/n7kVNST7rx69eJmzOrZ6XoL/p6pDPezjkg3R+enI6P36Le1GXSR0X9dPEc4ON387nyzn+Xep4Q76cg6vrp+NwL0oSAx4Xxd+SVYdtI01vfXTv6od0vkS+1FsfvzoO6ebtRUliwHpR+iSMw0ycDtX1w9Sbn36LOdd7P+3Pvr2oTKTw8aJKX5VzkzadDbd6zss5yXPuu/3m70VJYsCPX1RutL1v0+lvujnqeOvPevapJ/Ll3L2oTKrw8aIy2TLnW86N4AzTPHV9uP5b1GfOq33p34vKRAqvF/XqJnJ+66dPG8867p3kdJjv0BtO/r2ollzox/9wRn3pM4G9qMtT2KA2qMsELm1/AV1/4bh7WdHeAAAAAElFTkSuQmCC">
						<p>178fi133fomyp1kTn9TMPEE8ucwTzrp8b1</p>
					</a>
				</div>

				<div class="clear"></div>

				<h2>Donation methods we pay a fee on:</h2>

				<div class="donateOption">
					<!-- > $10 ID: WDLLZSYL5CPF6 -->
					<p>PayPal (least preferred, charges fees)</p>
					<form action="https://www.paypal.com/cgi-bin/webscr" method="post"><input type="hidden" name="cmd" value="_s-xclick"><input type="hidden" name="hosted_button_id" value="S7TAR7QU39H22"><input type="image" src="data:image/gif;base64,R0lGODlhPAAmANUzAICQmUBigDNml/3TiZmqs7+/s9nUws/KuczLv2aIplBthq+zrPLlyfu5RUBunHOQqe/hxr/DvObcxhA/bN/WvyBKc7O6uZ+npoyhr4CZrJmqsk13nzBWeWaIpI+cn4CZq/7gqmB5jHCEk6aytubcxVl/o013nr/Du7O6uFl/of/pwaaytXOQqEBumv7cn/moGDNmmQAzZv/tzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAADMALAAAAAA8ACYAAAb/wJlw9ioaj8ikcslUDofFxsBFrVqv2Kx2Wx00itDXQEYum8/otHqdHoCJY7Z8Tm+/iI26fi//ivmAgWRuLy6Ch3ouRYiMcyqLjZFqkJKVZZSWlZiZkZucjJ4KAaOjABCAEgmqqg8WbAYdHSQjCBEGmxQxursxHIAWMMHCMARrHwICBhgZGRibF7oKBQC7BwcA2AALMgsAF2XTABQZwRgRD8EbMggE7QQGZCnIMgYGEhKbIbrbMrsLvLpEBNB1QMYBXRMgbAjGYF0wBxGGBYsgA1mHM5s46DrlAeGBANhE6AK5T8bAGAAYpJPBgByMVg/aoSOGAJkGjC/MQAC469sB/w8AFIyEhvJfjAoyIkqE4QAeOwIlghHQgOwETjNGeQUoAOEkLwAHYyiooKuADAxLH0gwsFAiAhbIGprBRC1GiAJmyQiN4YFCXbMAFZBJEIwWgjIOmFpgQBiGjBYCTKDBdLKgmQm6KBQgG4OMRoQUyDw8YyBYCQYWEicggezD5JxlEKLxusuXjL0oySAI9uAMg8QSMaBAtuK1GWz8zBwQJQ1b3roVTsmQ0A7emQiqMjxdq0GD3LmwD51MbsnTHqIBPskwr4fshNCf2Nc5wFX9+vD2EcnPr2c/fzpFgPCfIIr8MSAghORxIB9fwLGgHm4IUUQcD7JBSBhSGFKhGSB48QvGE02EKOKISTwRBAA7" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"><img alt="" border="0" src="https://www.paypal.com/en_US/i/scr/pixel.gif" width="1" height="1"></form>
				</div>

				<div class="donateOption">
					<p>Flattr, Gratipay and other options are also available:</p>

					<a target="_blank" class="RESDonateButton" href="http://redditenhancementsuite.com/contribute.html">DONATE - THE ULTIMATE UPVOTE</a>
				</div>
			</div>
		</div>
		<div id="aboutRESPanel">
			<h3>RES Team</h3>
			<p><a target="_blank" href="http://www.honestbleeps.com/">Steve Sobel</a> (<a target="_blank" href="http://www.reddit.com/user/honestbleeps/">/u/honestbleeps</a>) is the primary developer of RES.  Beyond that, there are a number of people who have contributed code, design and/or great ideas to RES.  <a target="_blank" href="/r/Enhancement/w/about/team">Read more about the RES team.</a></p>

			<h3>What is RES?</h3>
			<p>Reddit Enhancement Suite is a collection of modules that makes browsing reddit a whole lot easier.</p>

			<p>Read more about what RES can do for you on the <a href="http://www.reddit.com/r/Enhancement/wiki">/r/Enhancement wiki</a> or look over the <a href="http://www.reddit.com/r/Enhancement/faq">Frequently Asked Questions</a>.</p>

			<h3>Want to talk?</h3>

			<p>If something looks broken, <a href="http://www.reddit.com/r/RESissues/search?restrict_sr=on">search in /r/RESissues</a> or <a href="http://www.reddit.com/r/RESIssues/submit">post a bug report</a>.</p>


			<p>If you have an idea or want to chat with other RES users, <a href="http://www.reddit.com/r/Enhancement/search?restrict_sr=on">search in /r/Enhancement</a> or <a href="http://www.reddit.com/r/Enhancement/submit">submit a feature request or discussion</a>.</p>

			<p>If you'd like to contribute code to RES, check out <a href="https://github.com/honestbleeps/Reddit-Enhancement-Suite" target="_blank">RES on GitHub</a>.</p>

			<h3>The Fine Print</h3>

			<p>License: Reddit Enhancement Suite is released under the <a target="_blank" href="http://www.gnu.org/licenses/gpl-3.0.html">GPL v3.0</a>.</p>

			<p><strong>Note:</strong> Reddit Enhancement Suite will check, at most once a day, to see if a new version is available.  No data about you is sent to me nor is it stored.</p>
		</div>
		<div id="teamRESPanel">
			<p>Steve Sobel (<a target="_blank" href="http://www.reddit.com/user/honestbleeps/">honestbleeps</a>) is the primary developer of RES.  Beyond that, there are a number of people who have contributed code, design and/or great ideas to RES.  To read more about the RES team, visit <a target="_blank" href="http://redditenhancementsuite.com/about.html">the RES website.</a></p>
		</div>
		<div id="searchRESPanel">
			<div id="SearchRES-results-container">
				<div id="SearchRES-count"></div>
				<ul id="SearchRES-results"></ul>
				<p id="SearchRES-results-hidden">Some results have been hidden because advanced options are currently hidden. <a href="#">Show advanced options.</a></p>
			</div>
			<div id="SearchRES-boilerplate">
				<p>You can search for RES options by module name, option name, and description. For example, try searching for "daily trick" in one of the following ways:</p>
				<ul>
					<li>type <code>daily trick</code> in the search box to the left and click the magnifying glass button</li>
					<li>press <code>.</code> to open the RES console, type in <code>search <em>daily trick</em></code>, and press Enter</li>
				</ul>
			</div>
		</div>
		<!-- /RESConsole -->

		<!-- Quick Message Dialog -->
		<style type="text/css" id="quickMessageCSS">
			#quickMessage { display: none; position: fixed; top: 0; bottom: 0; left: 0; right: 0; background-color: rgba(0, 0, 0, 0.74902); z-index: 2000; }
			#quickMessageDialog { position: fixed; top: 20%; left: 25%; width: 50%; z-index: 100001; }
			#quickMessageDialog .gearIcon { float: right; margin-right: 40px; }
			#quickMessageDialog label { margin-top: 9px; clear: both; float: left; }
			#quickMessageDialog input[type=text], #quickMessageDialog textarea { margin-top: 5px; width: calc(100% - 70px); float: right; border: 1px solid #c7c7c7; border-radius: 3px; margin-bottom: 6px; padding: 3px; }
			#quickMessageDialog select { margin-top: 5px; width: calc(100% - 63px); float: right; border: 1px solid #c7c7c7; border-radius: 3px; margin-bottom: 6px; padding: 3px; }
			#quickMessageDialog textarea { resize: vertical; min-height: 100px; }
			#quickMessageDialog input[type=button] { cursor: pointer; position: absolute; right: 16px; bottom: 16px; padding: 3px 5px; font-size: 12px; color: #fff; border: 1px solid #636363; border-radius: 3px; background-color: #5cc410; }
			#quickMessageDialog .clear { margin-bottom: 10px; }
			#quickMessageDialog .moderator::after { width: 16px; height: 16px; margin-left: 5px; display: inline-block; vertical-align: top; content: ""; background: url(https://www.redditstatic.com/sprite-reddit.EMWQffWtZwo.png) no-repeat -44px -796px; }
		</style>
		<div id="quickMessage" type="application/x-template">
			<div id="quickMessageDialog" class="RESDialogSmall">
				<h3>Send Message<a class="gearIcon" href="#!settings/quickMessage"></a></h3>
				<div id="quickMessageDialogClose" class="RESCloseButton">×</div>
				<div id="quickMessageDialogContents" class="RESDialogContents clear">
					<form name="quickMessageDialogForm" action="">
						<label for="quickMessageDialogFrom">From</label>
						<select id="quickMessageDialogFrom"></select>
						<label for="quickMessageDialogTo">To</label>
						<input type="text" id="quickMessageDialogTo" value=""/>
						<label for="quickMessageDialogSubject">Subject</label>
						<input type="text" id="quickMessageDialogSubject" value=""/>
						<label for="quickMessageDialogBody">Body</label>
						<textarea id="quickMessageDialogBody"></textarea>
						<div class="clear"></div>
						<input type="button" id="quickMessageDialogSend" value="✓ send message"/>
						<a href="/message/compose" class="fullMessageForm blueButton">open full message form</a>
					</form>
				</div>
			</div>
		</div>
		<!-- /Quick Message Dialog -->

		<!-- Submit Page Repost Warning -->
		<div id="repostWarning" type="application/x-template">
			<div class="spacer" style="display: none">
				<div style="display: block;" class="roundfield info-notice res-repost">
					<a style="float: right;" class="gearIcon" href="#!settings/submitHelper/warnAlreadySubmitted"></a>
					<p>This link was submitted to <a class="subredditLink" href="#"></a>:<span class="time"></span><a class="seeMore" href="#" target="_blank">(see more)</a></p>
				</div>
			</div>
		</div>
		<!-- /Submit Page Repost Warning -->

		<!--VideoUI-->
		<!--Adapted from MediaCrush video player-->
		<script id="VideoUI" type="application/x-template">
			<div class="res-player video {{ brand.name }}">
				<video {{#autoplay}}autoplay="true"{{/autoplay}} {{#loop}}loop="true"{{/loop}} {{#poster}}poster="{{ poster }}"{{/poster}} preload>
					{{#sources}}
					<source src="{{ source }}" {{#type}}type="{{ type }}"{{/type}}>
					{{/sources}}
				</video>
				{{#brand}}
				<a class="brand" href="{{ brand.url }}" target="_blank"><img src="{{ brand.img }}" width="16" height="16" /> {{ brand.name }}</a>
				{{/brand}}
				<a class="start {{#autoplay}}hidden{{/autoplay}}" href="#">
					<span class="res-icon">&#xF16B;</span>
				</a>
				<div class="controls {{#muted}}muted{{/muted}}">
					<a href="#" class="res-icon play-pause {{#autoplay}}pause{{/autoplay}}{{^autoplay}}play{{/autoplay}}"></a>
					<div class="seek">
						<div class="background"></div>
						<div class="loading progress"></div>
						<div class="hidden loaded"></div>
						<div class="hidden played"></div>
						<div class="clickable"></div>
					</div>
					<div class="right">
						{{^muted}}
						<span class="toggleable volume">
							<a href="#" class="res-icon">&#xF03B;</a>
							<div>
								<span>
									<span class="background"></span>
									<span class="amount"></span>
									<span class="clickable"></span>
								</span>
							</div>
						</span>
						{{/muted}}
						<a href="#" class="res-icon fullscreen"></a>
						<span class="toggleable settings">
							<span class="res-icon">&#xF04E;</span>
							<div>
								<div class="playback-speed">
									<div class="header">Playback Speed</div>
									<div class="speeds">
										<a href="#" data-speed="0.5">50%</a><a href="#" data-speed="1" class="selected">100%</a><a href="#" data-speed="1.5">150%</a>
									</div>
								</div>
								<div class="highlight">
									<a href="#" class="loop">
										<span class="text">Loop {{#loop}}ON{{/loop}}{{^loop}}OFF{{/loop}}</span><span class="res-icon loop {{#loop}}disabled{{/loop}}">&#xF0B2;</span>
									</a>
								</div>
								{{#download}}
								<div class="highlight"><a href="{{download}}" class="download">Download<span class="res-icon">&#xF0BD;</span></a></div>
								{{/download}}
							</div>
						</span>
					</div>
				</div>
			</div>
		</script>
		<!--/VideoUI-->
		<!--GfycatUI-->
		<script id="GfycatUI" type="application/x-template">
			<div class="res-player video gfycatR">
				<a class="madeVisible" href="{{ directurl }}" target="_blank">
				<video autoplay loop muted preload class="gfyRVid" poster="{{ poster }}">
					{{#sources}}
					<source src="{{ source }}" {{#type}}type="{{ type }}"{{/type}} class="{{ class }}">
					{{/sources}}
				</video>
				</a>
				<div style="height: 35px;" class="ctrlContainer">
					<div style="width: 90px; height: 25px; float: right; padding: 5px; display: none;" class="ctrlBox">
						<div  class="res-icon res-lightweight-player-controls gfyRCtrlFaster" >&#xf14c;</div>
						<div  class="res-icon res-lightweight-player-controls gfyRCtrlSlower" >&#xf14d;</div>
						<div  class="res-icon res-lightweight-player-controls gfyRCtrlReverse" style="margin-right: 6px;">&#xf169;</div>
						<div  class="res-icon res-lightweight-player-controls gfyRCtrlPause" style="marginright: 4px;">&#xf16c;</div>
					</div>
				</div>
			</div>
		</script>
		<!--/GfycatUI-->
		<!--gifyoutubeUI-->
		<script id="gifyoutubeUI" type="application/x-template">
			<div class="res-player video gifyoutube">
				<a class="madeVisible" href="{{ directurl }}" target="_blank">
				<video autoplay loop muted preload class="gifyoutubeVid">
					{{#sources}}
					<source src="{{ source }}" {{#type}}type="{{ type }}"{{/type}} class="{{ class }}">
					{{/sources}}
				</video>
				</a>
				<div style="height: 35px;" class="ctrlContainer">
					<div class="gifyoutube-source">
						<a target="_blank" class="res-icon res-lightweight-player-controls gifyoutube-source-button">Watch Full Video</a>
					</div>
					<div class="gifyoutube-controls">
						<div class="res-icon res-lightweight-player-controls gifyoutubeCtrlSlower" >&#xf169;</div>
						<div class="res-icon res-lightweight-player-controls gifyoutubeCtrlPause" style="marginright: 4px;">&#xf16c;</div>
						<div class="res-icon res-lightweight-player-controls gifyoutubeCtrlFaster" >&#xf16d;</div>
					</div>
				</div>
			</div>
		</script>
		<!--/gifyoutubeUI-->
		<!--imgurgifvUI-->
		<script id="imgurgifvUI" type="application/x-template">
			<div class="res-player video imgurgifv">
				<a class="madeVisible" href="{{ directurl }}" target="_blank">
				<video autoplay loop muted preload  class="imgurgifvVid">
					{{#sources}}
					<source src="{{ source }}" {{#type}}type="{{ type }}"{{/type}} class="{{ class }}">
					{{/sources}}
				</video>
				</a>
				<div style="height: 35px;" class="ctrlContainer">
					<div class="imgurgifv-brand">
						<img src="//imgur.com/favicon.ico">
					</div>
					<div class="imgurgifv-download">
						<a href="{{ downloadurl }}">download</a>
					</div>
				</div>
			</div>
		</script>
		<!--/imgurgifvUI-->
		<!--GiphyUI: modified from MediaCrush Player-->
		<script id="GiphyUI" type="application/x-template">
			<div class="res-player video giphyres">
				<a href="{{ giphyUrl }}" target="_blank">
					<video autoplay loop muted preload class="giphyVid">
						{{#sources}}
						<source src="{{ source }}" {{#type}}type="{{ type }}"{{/type}}>
						{{/sources}}
					</video>
				</a>
				<!--MediaCrush Controls: unused-->
				<a class="brand" style="display:none"></a>
				<div class="controls" style="display:none">
					<a href="#" class="res-icon play-pause pause"></a>
					<div class="seek">
						<div class="background"></div>
						<div class="loading progress"></div>
						<div class="hidden loaded"></div>
						<div class="hidden played"></div>
						<div class="clickable"></div>
					</div>
					<div class="right">
						<span class="toggleable settings">
							<a href="#" class="loop"></a>
						</span>
					</div>
				</div>
				<!--/MediaCrush Controls-->
			</div>
		</script>
		<!--/GiphyUI-->


		<div id="searchResultOptionHtml" type="application/x-template">
			<div class="SearchRES-result-header">
				<span class="SearchRES-result-title">{{title}}</span>
				<span class="SearchRES-breadcrumb">RES settings console
					&gt; {{category}}
					&gt; {{moduleName}} ({{moduleID}})
					{{#optionKey}} &gt; {{optionKey}}{{/optionKey}}
				</span>
			</div>
			<div class="SearchRES-result-description">
				{{description}}
			</div>
		</div>


		<pre id="optionLinkSnudown" type="application/x-template">
**[{{title}}]({{url}})**
-- [](#gear)
[RES settings console]({{settingsUrl}}) > {{category}} > [{{moduleName}}]({{moduleUrl}} "{{moduleID}}") {{#optionKey}} > [{{optionKey}}]({{optionUrl}}){{/optionKey}}

{{description}}
		</pre>

		<div id="RESHoverDefault">
			<div class="RESHover">
				<div data-hover-element="0" />
				<div data-hover-element="1" />
				<div data-hover-element="2" />
				<div data-hover-element="3" />
			</div>
		</div>

		<div id="RESHoverInfoCard">
			<div class="RESHover RESHoverInfoCard RESDialogSmall">
				<h3 id="RESHoverTitle" data-hover-element="0"></h3>
				<div class="RESCloseButton">x</div>
				<div id="RESHoverBody" class="RESDialogContents" data-hover-element="1"></div>
			</div>
		</div>

		<div id="RESHoverDropdownList">
			<div class="RESHover RESHoverDropdownList RESDropdownList">
				<ul class="RESDropdownOptions" data-hover-element="0"></ul>
			</div>
		</div>

		<style id="RESHoverStyle" type="text/css">
			.RESHover, .RESHover.RESDialogSmall { display: none; position: absolute; z-index: 10001; }

			.RESHoverInfoCard:before { content: ""; position: absolute; top: 10px; left: -26px; border-style: solid; border-width: 10px 29px 10px 0; border-color: transparent #c7c7c7; display: block; width: 0; z-index: 1; }
			.RESHoverInfoCard:after { content: ""; position: absolute; top: 10px; left: -24px; border-style: solid; border-width: 10px 29px 10px 0; border-color: transparent #f0f3fc; display: block; width: 0; z-index: 1; }
			.RESHoverInfoCard.right:before { content: ""; position: absolute; top: 10px; right: -26px; left: auto; border-style: solid; border-width: 10px 0 10px 29px; border-color: transparent #c7c7c7; display: block; width: 0; z-index: 1; }
			.RESHoverInfoCard.right:after { content: ""; position: absolute; top: 10px; right: -24px; left: auto; border-style: solid; border-width: 10px 0 10px 29px; border-color: transparent #f0f3fc; display: block; width: 0; z-index: 1; }
			.RESHoverInfoCard.below:before, .RESHoverInfoCard.below:after { content: none; }
		</style>


		<style id="commentNavigatorCSS" type="text/css">
			#REScommentNavBox { clear: both; margin-top: 10px; width: 265px; border: 1px solid gray; background-color: #fff; opacity: 0.3; user-select: none; -webkit-user-select: none; -moz-user-select: none; -webkit-transition:opacity 0.5s ease-in; -moz-transition:opacity 0.5s ease-in; -o-transition:opacity 0.5s ease-in; -ms-transition:opacity 0.5s ease-in; -transition:opacity 0.5s ease-in; }
			#REScommentNavBox:hover { opacity: 1 }
			#REScommentNavToggle { clear: left; }
			.commentarea .menuarea { margin-right: 0; }
			.menuarea > .spacer { margin-right: 0; }
			#commentNavButtons { margin: auto; }
			#commentNavUp, #commentNavDown { cursor: pointer; color: #1278D3; border: none; background: transparent; padding: 0; font-size: 35px; line-height: 0.9; }
			#commentNavUp:focus, #commentNavDown:focus { outline: none; text-shadow: 0 0 5px #1278D3; }
			#commentNavUp[disabled], #commentNavDown[disabled] { opacity: 0.3; cursor: default; }
			#commentNavButtons { display: none; margin-left: 12px; text-align: center; user-select: none; -webkit-user-select: none; -moz-user-select: none; }
			.commentNavSortType { cursor: pointer; font-weight: bold; display: inline-block; }
			#commentNavPostCount { color: #1278d3; }
			.noNav #commentNavPostCount { color: #666; }
			.commentNavSortTypeDisabled { color: #666; }
			.commentNavSortType:hover { text-decoration: underline; }
			.menuarea > .spacer { float: left; margin-bottom: 10px; }
		</style>

		<div id="commentNavigator">
			<h3>
				Navigate by:
				<select id="commentNavBy">
					<option name=""></option>
					<option name="submitter">submitter</option>
					<option name="moderator">moderator</option>
					<option name="friend">friend</option>
					<option name="me">me</option>
					<option name="admin">admin</option>
					<option name="highlighted">highlighted</option>
					<option name="gilded">gilded</option>
					<option name="IAmA">IAmA</option>
					<option name="images">images</option>
					<option name="videos">videos</option>
					<option name="popular">popular</option>
					<option name="new">new</option>
				</select>
			</h3>
			<div id="commentNavCloseButton" class="RESCloseButton">&times;</div>
			<div class="RESDialogContents">
				<div id="commentNavButtons">
					<button id="commentNavUp" type="button" disabled>&#x25B2;</button> <div id="commentNavPostCount"></div> <button id="commentNavDown" type="button" disabled>&#x25BC;</button>
				</div>
			</div>
		</div>

		<style id="pageNavigator-CSS" type="text/css">
			.pageNavigator {
				cursor: pointer;
				padding: 3px 3px;
				line-height: 1;
				font-size: 16px;
				text-align: center;
				color: #888;
			}
		</style>

		<style type="text/css" id="floater-visibleAfterScroll-CSS">
			.res-floater-visibleAfterScroll {
				position: fixed;
				z-index: 10000000;
				top: {{ offset }}px;
				right: 8px;
				display: block;
			}
			.res-floater-visibleAfterScroll > ul {
				float: right;
				list-style: none;
			}
			.res-floater-visibleAfterScroll > ul > li {
				display: block;
				float: left;
				opacity: 0.7;
			}
			.res-floater-visibleAfterScroll > ul > li:hover {
				opacity: 1.0;
			}
		</style>

		<style type="text/css" id="neverEndingReddit-CSS">
			#NERModal { display: none; z-index: 999; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; opacity: 0.6; }
			#NERContent { display: none; position: fixed; top: 40px; z-index: 1000; width: 720px; background-color: #FFF; color: #000; padding: 10px; font-size: 12px; }
			#NERModalClose { position: absolute; top: 3px; right: 3px; }
			#NERFail { min-height: 30px; width: 95%; font-size: 14px; border: 1px solid #999; border-radius: 10px; padding: 5px; text-align: center; bgcolor: #f0f3fc; cursor: auto; }
			#NERFail .nextprev { font-size: smaller; display: block; }
			#NERFail .nextprev a + a { margin-left: 2em; }
			.NERdupe p.title:after { color: #000; font-size: 10px; content: ' (duplicate from previous page)'; }
			.NERPageMarker { text-align: center; color: #7f7f7f; font-size: 14px; margin-top: 6px; margin-bottom: 6px; overflow: hidden; font-weight: normal; background-color: #f0f3fc; border: 1px solid #c7c7c7; border-radius: 3px; padding: 3px 0; }
			/* hide next/prev page and random subreddit indicators */
			.res-ner-listing div.nav-buttons { display: none; }
			.res-ner-listing .nav-buttons .nextprev { display: none; }
			.res-ner-fade-dupes .NERdupe { opacity: 0.3; }
			.res-ner-hide-dupes .NERdupe { display: none; }
			/* set the style for our little loader widget */
			#progressIndicator {
				height: 60px;
				display: -webkit-flex; -webkit-align-items: center; -webkit-justify-content: center; -webkit-flex-direction: column;
				display: flex; align-items: center; justify-content: center; flex-direction: column;
				font-size: 14px; border: 1px solid #999; border-radius: 10px; padding: 10px; background-color: #f0f3fc; cursor: pointer;
			}
			#progressIndicator h2 { margin-bottom: .5em; }
			#progressIndicator .gearIcon { margin-left: 1em; }
			#progressIndicator .RESThrobber { margin-top: 10px; margin-bottom: 0; }
			#NREPause { cursor: pointer; }
			#NREPause::after { font: normal 100% Batch; color: #888; display: block; width: 10px; height: 10px; padding: 0 2px 4px; margin: 3px; border: 1px solid #888; border-radius: 50%; }
			#NREPause::after, #NREPause.paused.reversePause::after { content: "\\F16C"; }
			#NREPause.paused::after, #NREPause.reversePause::after { content: "\\F16B"; }
		</style>

		<style type="text/css" id="searchHelper-searchPageTabs">
			/* reddit search page tabs */
			ul.res-search-tabs li.res-search-tab-facets a:before {
				content: "\\F0B7";
			}
			ul.res-search-tabs li.res-search-tab-subs a:before {
				content: "\\F030";
			}
			ul.res-search-tabs li.res-search-tab-options a:before {
				content: "\\F06B";
			}

			.search-page .searchpane { height: auto; }
			.search-page #search { margin: 0; height: auto; position: static; }
			.combined-search-page #previoussearch .searchfacets { max-width: none; border: none; padding: 0 0 0; margin: 0; overflow: visible; }
			.combined-search-page #previoussearch .searchfacets h4.title { display: none; }
			.combined-search-page #previoussearch .searchfacets ol { padding: 10px 0 0 0; }
			.combined-search-page #previoussearch .search-result-group-header { display: none; }
			ul.res-search-tabs { margin: 10px 0 0 0; padding: 0; list-style: none; clear: left; }
			ul.res-search-tabs li { font-weight: bold; display: inline-block; margin: 0 2px 0 0; padding: 0; background: linear-gradient(to top, rgb(240,240,240), rgb(225,225,225)) }
			ul.res-search-tabs li:last-child { margin-right: none; }
			ul.res-search-tabs li.res-search-tab-active { background: rgb(255,255,255); }
			ul.res-search-tabs a { border-top: 1px solid transparent; padding: 5px 5px 5px 10px; display: inline-block;  }
			ul.res-search-tabs li a:after { content: "+"; text-align: center; display: inline-block; padding: 0 3px; width: 1em; visibility: hidden; }
			ul.res-search-tabs li.res-search-tab-active a:after { content: "-"; }
			ul.res-search-tabs li:hover a:after { visibility: visible; }
			ul.res-search-tabs li.res-search-tab-active a { border-color: rgb(51,102,153) }
			.res-search-options { margin: 0; padding: 0; line-height: 1.5; }
			.res-search-options p { margin: 10px 0; }
			.res-search-options dl { padding: 15px; -webkit-column-count: 2; -moz-column-count: 2; }
			.res-search-options dt { font-weight: normal; margin-left: 0; }
			.res-search-options dd { margin: 0 0 5px; color: rgb(150,150,150); }
			.combined-search-page #previoussearch .search-result-group { margin: 0; padding: 0; }
			.combined-search-page #previoussearch .search-result { margin: 0 0 15px; padding: 0; }
			.combined-search-page #previoussearch .search-result-listing { margin: 0; }
			.combined-search-page #previoussearch .res-search-pane { padding: 10px; background-color: rgb(255,255,255); }
			.combined-search-page .search-result-group footer .nav-buttons { margin-bottom: 0; }
			ul.res-search-tabs li.res-search-tab-facets a:before, ul.res-search-tabs li.res-search-tab-subs a:before, ul.res-search-tabs li.res-search-tab-options a:before { font: 100%/1 "Batch"; display: inline-block; margin-right: 10px; }

		</style>
	</body>
</html>`
