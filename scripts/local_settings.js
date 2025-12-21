function getLocalSettings(name, defaultValue=null) {
    return localStorage.getItem(name) || defaultValue;
}

function setLocalSettings(name, value) {
    localStorage.setItem(name, value);
}

function clearLocalSettings(name) {
    localStorage.removeItem(name);
}

function clearAllLocalSettings() {
    localStorage.clear();
}

function getAllLocalSettings() {
    let settings = {};
    for (let i = 0; i < localStorage.length; i++) {
        settings[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    }
    return settings;
}
