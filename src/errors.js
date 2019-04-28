function logToConsole(error) {
    if (error instanceof ExtensionError || error instanceof HostError) {
        error.logToConsole();
    } else {
        chrome.runtime.getBackgroundPage().console.error(error);
    }
}

class ExtensionError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExtensionError";
        this.alreadyLogged = false;

        if (Error.captureStackTrace) {
            // Chrome
            Error.captureStackTrace(this, HostError);
        } else {
            // Firefox
            this.stack = new Error().stack || "";
        }
    }

    logToConsole() {
        if (!this.alreadyLogged) {
            chrome.runtime.getBackgroundPage().console.error(this);
            this.alreadyLogged = true;
        }
    }

    appendAsHtmlTo() {
        // TODO
    }
}

class HostError extends Error {
    constructor(response) {
        if (response.status !== "error" || response.params === undefined) {
            super("Invalid error response");
            this.rawResponse = response;
        } else {
            super(response.params.message);
        }
        this.name = "HostError";
        this.alreadyLogged = false;

        this.version = response.version;
        this.code = response.code;
        this.params = {};
        this.unexpectedParams = {};
        if (this.code in HostError.KNOWN_ERRORS) {
            this.genericDescription = HostError.KNOWN_ERRORS[this.code].description;
            for (const param of HostError.KNOWN_ERRORS[this.code].expectedParams) {
                this.params[param] = "n/a";
            }
            for (const param of Object.keys(response.params)) {
                if (this.params.hasOwnProperty(param)) {
                    this.params[param] = response.params[param];
                } else {
                    this.unexpectedParams[param] = response.params[param];
                    this.rawResponse = response;
                }
            }
        } else {
            this.genericDescription = "Unknown error code";
            this.unexpectedParams = response.params;
            this.rawResponse = response;
        }

        if (Error.captureStackTrace) {
            // Chrome
            Error.captureStackTrace(this, HostError);
        } else {
            // Firefox
            this.stack = new Error().stack || "";
        }
    }

    get versionString() {
        if (typeof this.version === "number") {
            const patch = this.version % 1000;
            const minor = ((this.version - patch) % 1000000) / 1000;
            const major = Math.floor(this.version / 1000000);
            return `${major}.${minor}.${patch}`;
        } else {
            return `"${this.version}" (invalid)`;
        }
    }

    logToConsole() {
        if (!this.alreadyLogged) {
            const bg = chrome.runtime.getBackgroundPage();
            bg.console.error(this);
            bg.console.error(
                `Host version : ${this.versionString}\n` +
                    `Generic error: ${this.genericDescription} (${this.code})`
            );
            if (Object.keys(params).length > 0) {
                bg.console.table(this.params, ["Parameter", "Value"]);
            }
            if (Object.keys(unexpectedParams).length > 0) {
                bg.console.error("There were unexpected parameters:");
                bg.console.table(this.unexpectedParams, ["Parameter", "Value"]);
            }
            if (this.rawResponse) {
                bg.console.error("Raw response: ", this.rawResponse);
            }
            this.alreadyLogged = true;
        }
    }

    appendAsHtmlTo(container) {
        const p = container.createElement("p");
        p.textContent = this.message;
        // TODO
    }
}

HostError.KNOWN_ERRORS = {
    "10": { description: "Unable to parse browser request length", expectedParams: ["error"] },
    "11": { description: "Unable to parse browser request", expectedParams: ["error"] },
    "12": { description: "Invalid request action", expectedParams: ["action"] },
    "13": {
        description: "Inaccessible user-configured password store",
        expectedParams: ["action", "error", "storeId", "storePath", "storeName"]
    },
    "14": {
        description: "Inaccessible default password store",
        expectedParams: ["action", "error", "storePath"]
    },
    "15": {
        description: "Unable to determine the location of the default password store",
        expectedParams: ["action", "error"]
    },
    "16": {
        description: "Unable to read the default settings of a user-configured password store",
        expectedParams: ["action", "error", "storeId", "storePath", "storeName"]
    },
    "17": {
        description: "Unable to read the default settings of the default password store",
        expectedParams: ["action", "error", "storePath"]
    },
    "18": {
        description: "Unable to list files in a password store",
        expectedParams: ["action", "error", "storeId", "storePath", "storeName"]
    },
    "19": {
        description: "Unable to determine a relative path for a file in a password store",
        expectedParams: ["action", "error", "storeId", "storePath", "storeName", "file"]
    },
    "20": { description: "Invalid password store ID", expectedParams: ["action", "storeId"] },
    "21": { description: "Invalid gpg path", expectedParams: ["action", "error", "gpgPath"] },
    "22": {
        description: "Unable to detect the location of the gpg binary",
        expectedParams: ["action", "error"]
    },
    "23": { description: "Invalid password file extension", expectedParams: ["action", "file"] },
    "24": {
        description: "Unable to decrypt the password file",
        expectedParams: ["action", "error", "storeId", "storePath", "storeName", "file"]
    }
};
