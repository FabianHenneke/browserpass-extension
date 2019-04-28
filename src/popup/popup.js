//------------------------------------- Initialisation --------------------------------------//
"use strict";

require("chrome-extension-async");
const errors = require("../errors");
const Interface = require("./interface");
const helpers = require("../helpers");

run();

//----------------------------------- Function definitions ----------------------------------//

/**
 * Show a status message to the user
 *
 * @since 3.1.1
 *
 * @param {string|Error} status A textual status message or an Error instance
 */
function showStatus(status) {
    const node = document.createElement("div");
    if (status instanceof Error) {
        node.setAttribute("class", "part error");
        if (status instanceof errors.HostError) {
            // HostErrors provide a dedicated HTML description
            status.appendAsHtmlTo(node);
        } else {
            node.textContent = status.toString();
        }
    } else {
        node.setAttribute("class", "part notice");
        node.textContent(status);
    }
    document.body.innerHTML = "";
    document.body.appendChild(node);
}

/**
 * Run the main popup logic
 *
 * @since 3.0.0
 *
 * @return void
 */
async function run() {
    try {
        var response = await chrome.runtime.sendMessage({ action: "getSettings" });
        if (response.status != "ok") {
            throw new errors.ExtensionError(response.message);
        }
        var settings = response.settings;

        if (settings.hasOwnProperty("hostError")) {
            throw settings.HostError;
        }

        if (typeof settings.host === "undefined") {
            throw new errors.ExtensionError("Unable to retrieve current tab information");
        }

        // get list of logins
        response = await chrome.runtime.sendMessage({ action: "listFiles" });
        if (response.status != "ok") {
            throw new Error(response.message);
        }

        const logins = helpers.prepareLogins(response.files, settings);
        for (let login of logins) {
            login.doAction = withLogin.bind({ settings: settings, login: login });
        }

        var popup = new Interface(settings, logins);
        popup.attach(document.body);
    } catch (e) {
        handleError(e);
    }
}

/**
 * Do a login action
 *
 * @since 3.0.0
 *
 * @param string action Action to take
 * @return void
 */
async function withLogin(action) {
    try {
        // replace popup with a "please wait" notice
        switch (action) {
            case "fill":
                handleError("Filling login details...", "notice");
                break;
            case "launch":
                handleError("Launching URL...", "notice");
                break;
            case "launchInNewTab":
                handleError("Launching URL in a new tab...", "notice");
                break;
            case "copyPassword":
                handleError("Copying password to clipboard...", "notice");
                break;
            case "copyUsername":
                handleError("Copying username to clipboard...", "notice");
                break;
            default:
                handleError("Please wait...", "notice");
                break;
        }

        // Firefox requires data to be serializable,
        // this removes everything offending such as functions
        const login = JSON.parse(JSON.stringify(this.login));

        // hand off action to background script
        var response = await chrome.runtime.sendMessage({
            action: action,
            login: login
        });
        if (response.status != "ok") {
            throw new Error(response.message);
        } else {
            window.close();
        }
    } catch (e) {
        handleError(e);
    }
}
