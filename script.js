// ==UserScript==
// @name YouTube Name Colorizer
// @version 1.2
// @author JakeBathman
// @description Color certain names in YouTube stream chat
// @match https://*.youtube.com/*
// @license MIT
// @grant none
// @namespace https://github.com/jakebathman/YouTube-Name-Colorizer
// ==/UserScript==
console.log('############ YouTube Name Colorizer');

let MutationObserver =
    window.MutationObserver ||
    window.WebKitMutationObserver ||
    window.MozMutationObserver;

let localStorageKey = 'yt-name-colorizer';
let listenToInputEvents = false;

let settingsModalElement;
var settingsModalSave;
var settingsModalCancel;
var settingsModalType;
var settingsShow;

// Get settings for colorized names
let SETTINGS = JSON.parse(localStorage.getItem(localStorageKey)) || {};
let COLORIZED_USERS_NORMAL = settingsGet('users_normal', []);
let COLORIZED_USERS_TEMP = settingsGet('users_temp', []);
let AT_MENTIONABLE = [];
let AUTHORS_IN_CHAT = [];

console.log({ COLORIZED_USERS_NORMAL });
console.log({ COLORIZED_USERS_TEMP });
console.log({ AT_MENTIONABLE });
console.log({ AUTHORS_IN_CHAT });

console.debug('SETTINGS', SETTINGS);

let MESSAGE_TAG = 'yt-live-chat-text-message-renderer';
let OTHER_USER_COLOR = 'FF69B4';
let CURRENT_USER_COLOR = 'ff5722';
let TEMP_USER_COLOR = 'ffff2a';
let MENTIONED_USER_COLOR = '612155';
let CURRENT_USER = '';

function settingsGet(key, defaultValue = null) {
    let settings = JSON.parse(localStorage.getItem(localStorageKey)) || {};

    console.debug('settings', settings);
    if (!settings.hasOwnProperty(key)) {
        return defaultValue;
    }

    return settings[key];
}

function settingsSet(key, value) {
    let settings = JSON.parse(localStorage.getItem(localStorageKey)) || {};

    if (!settings.hasOwnProperty(key)) {
        settings[key] = {};
    }

    settings[key] = value;

    localStorage.setItem(localStorageKey, JSON.stringify(settings));

    COLORIZED_USERS_NORMAL = settingsGet('users_normal', []);
    COLORIZED_USERS_TEMP = settingsGet('users_temp', []);
    AT_MENTIONABLE = getAtMentionableUsers();
    console.debug({ AT_MENTIONABLE });

    processExistingMessages();
}

function getAtMentionableUsers() {
    return Array.from(
        new Set(
            AUTHORS_IN_CHAT.concat(COLORIZED_USERS_NORMAL).concat(
                COLORIZED_USERS_TEMP
            )
        )
    );
}

function addUserInChat(username) {
    AUTHORS_IN_CHAT = addItemToArray(AUTHORS_IN_CHAT, username);
    AT_MENTIONABLE = getAtMentionableUsers();
}

function addItemToArray(array, item) {
    array.push(item);
    array = Array.from(new Set(array));
    return array;
}

function settingsAddUser(username, type = 'normal') {
    let typeKey = `users_${type}`;
    let users = settingsGet(typeKey, []);

    users = addItemToArray(users, username);

    settingsSet(typeKey, users);
}

function settingsRemoveUser(username, type = 'normal') {
    let itemWasRemoved = false;
    let typeKey = `users_${type}`;
    let users = settingsGet(typeKey, []);
    const index = users.indexOf(username);

    if (index > -1) {
        users.splice(index, 1);
        itemWasRemoved = true;
    }

    if (!itemWasRemoved) {
        // Item wasn't removed, so don't continue and reprocess messages
        return;
    }

    settingsSet(typeKey, users);
}

let showModal = function (username) {
    settingsModalSave = document.getElementById('ytncSave');
    settingsModalCancel = document.getElementById('ytncCancel');
    settingsModalType = document.getElementById('ytncModal__colorize-type');

    if (COLORIZED_USERS_NORMAL.includes(username)) {
        settingsModalType.value = 'normal';
    } else if (COLORIZED_USERS_TEMP.includes(username)) {
        settingsModalType.value = 'temp';
    } else {
        settingsModalType.value = 'none';
    }

    colorModalSelect(settingsModalType);

    settingsModalType.addEventListener('change', (event) => {
        colorModalSelect(event.target);
    });

    settingsModalCancel.onclick = function () {
        hideModal();
    };

    settingsModalSave.onclick = function () {
        switch (settingsModalType.value) {
            case 'normal':
                settingsAddUser(username, 'normal');
                settingsRemoveUser(username, 'temp');
                break;

            case 'temp':
                settingsAddUser(username, 'temp');
                settingsRemoveUser(username, 'normal');
                break;

            default:
                // Remove from both lists
                settingsRemoveUser(username, 'normal');
                settingsRemoveUser(username, 'temp');
                break;
        }

        hideModal();
    };

    settingsModal().querySelector('.ytnc__username').innerText = username;
    settingsModal().style.display = 'flex';
};

let colorModalSelect = function (selectElement) {
    let value = selectElement.value;

    if (value === 'normal') {
        selectElement.style.color = `#${OTHER_USER_COLOR}`;
        selectElement.style.borderColor = `#${OTHER_USER_COLOR}`;
        selectElement.style.outlineColor = `#${OTHER_USER_COLOR}`;
        selectElement.style.backgroundColor = '#000';
    } else if (value === 'temp') {
        selectElement.style.color = `#${TEMP_USER_COLOR}`;
        selectElement.style.borderColor = `#${TEMP_USER_COLOR}`;
        selectElement.style.outlineColor = `#${TEMP_USER_COLOR}`;
        selectElement.style.backgroundColor = '#000';
    } else {
        selectElement.style.color = 'gray';
        selectElement.style.borderColor = 'gray';
        selectElement.style.outlineColor = 'gray';
        selectElement.style.backgroundColor = '#000';
    }
};

let hideModal = function () {
    settingsModal().style.display = 'none';
};

let settingsModal = function () {
    if (!settingsModalElement) {
        settingsModalElement = document.getElementById('ytncModal');
    }

    return settingsModalElement;
};

let currentUser = function () {
    if (!CURRENT_USER) {
        CURRENT_USER = frameContext().querySelector(
            'yt-live-chat-message-input-renderer .yt-live-chat-author-chip'
        ).innerText;
    }

    return CURRENT_USER;
};

function createModal() {
    console.log('[YTNC] Creating modal div');
    // Add the modal shell
    const modal = document.createElement('div');
    let modalHtml = `
    <div id="ytncModal" style="display:none;width: 100%;height: 100%;top: 0;left: 0;position:absolute;">
        <div class="modal-content"
            style="background-color: #fefefe;margin: auto;padding: 0;border: 1px solid #888;box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);z-index: 999999;">
            <div class="modal-header">
                <h2 class="ytncModal__header" style="padding: 2px 16px;background-color: #5cb85c;color: white;">YouTube Name Colorizer</h2>
            </div>
            <div class="modal-body" style="padding: 12px 16px;font-size:1.7em;text-align:center;">
                <p><span class="ytnc__action">Colorize</span> <span class="ytnc__username"
                        style="font-weight:bold;color:#${OTHER_USER_COLOR};">{user}</span>?</p>
                <div style="display:flex;justify-content:center;">
                    <select id="ytncModal__colorize-type" style="height: 42px;margin-top: 12px;padding: 0px 19px 0px 5px;font-size: 16px;line-height: 1.75;color: #808080;background-color: #000;background-image: none;border: 2px solid #808080;border-radius: 6px;outline-color:#808080;">
                        <option value="none">None</option>
                        <option value="normal">Normal</option>
                        <option value="temp">Temp</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer" style="padding: 8px 16px;display: flex;justify-content: space-between;height:32px;">
                <button id="ytncCancel">Cancel</button><button id="ytncSave">Save</button>
            </div>
        </div>
    </div>`;

    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    let showDiv = document.createElement('div');
    showDiv.innerHTML = `<button id="ytncShowSettings">Show</button>`;
    document
        .querySelector('.ytd-video-primary-info-renderer .title')
        .appendChild(showDiv);
}
window.onload = (event) => {
    console.log('[YTNC] Page is fully loaded');

    createModal();

    attachInputListener();

    processExistingMessages();
};

let frameContext = function () {
    let frameContext = document.querySelector('ytd-live-chat-frame iframe');

    if (frameContext) {
        frameContext = frameContext.contentDocument.body;
    } else {
        frameContext = document.body;
    }

    return frameContext;
};

let processExistingMessages = function () {
    console.log('[YTNC] Processing existing messages');
    let messages = frameContext().querySelectorAll(
        'yt-live-chat-text-message-renderer'
    );
    messages.forEach((message) => {
        processMessage(message);
    });
};

let attachInputListener = function () {
    if (!listenToInputEvents) {
        return;
    }

    console.log('[YTNC] Attaching listener to input');
    let input = frameContext().querySelector(
        '#input.yt-live-chat-text-input-field-renderer'
    );

    // Check for existing listener to this element
    if (input.getAttribute('ytncListener') !== null) {
        // Already set
        return;
    }

    console.debug(input);

    if (input) {
        input.addEventListener('input', (event) => {
            console.debug('[YTNC] input', event);
            if (event.key === 'Enter') {
                let message = input.querySelector(
                    '.yt-live-chat-message-input-renderer-message-input'
                );
                if (message) {
                    processMessage(message);
                }
            }
        });

        input.setAttribute('ytncListener', true);
    }
};

if (MutationObserver) {
    console.log('Mutation observer exists');
}

// Process new messages as they're added to the DOM
let observer = new MutationObserver((mutations) => {
    try {
        // look through all mutations that just occurred
        for (var i = 0; i < mutations.length; ++i) {
            // look through all added nodes of this mutation

            for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                // was a child added with ID of 'bar'?

                var el = mutations[i].addedNodes[j];
                var tag = el.tagName;
                if (tag && tag.localeCompare(MESSAGE_TAG, 'en') > -1) {
                    processMessage(el);
                }
            }
        }
    } catch (error) {
        console.error('#### YTNC error!', error);
    }
});

let processMessage = function (msg) {
    let commonStyles = 'font-weight:bold;cursor:pointer;';

    // New message added to the list
    var author = msg.querySelector('#author-name');

    if (author) {
        let authorName = author.innerText;

        // Log the author name so it can be @mentioned
        addUserInChat(authorName);

        console.debug('[YTNC] Found author', authorName);
        if (currentUser() == authorName) {
            author.style.cssText += `color:#${CURRENT_USER_COLOR};${commonStyles}`;
        } else if (COLORIZED_USERS_NORMAL.includes(authorName)) {
            author.style.cssText += `color:#${OTHER_USER_COLOR};${commonStyles}`;
        } else if (COLORIZED_USERS_TEMP.includes(authorName)) {
            author.style.cssText += `color:#${TEMP_USER_COLOR};${commonStyles}`;
        } else {
            // Remove color override (if user was removed from all lists)
            author.style.color = '';
        }

        // Add author onclick
        author.onclick = function () {
            showModal(authorName);
        };

        // Move user badges before author chip element
        var badges = msg.querySelector('#chat-badges.yt-live-chat-author-chip');

        if (badges) {
            badges.after(author);
        }

        // Process the message text
        var message = msg.querySelector('#message');
        console.debug({ message });

        if (message) {
            if ('originalHtml' in message.dataset === false) {
                message.dataset.originalHtml = message.innerHTML;
            }

            let newHtml = message.dataset.originalHtml;

            // Loop over AT_MENTIONABLE and colorize any mentions found
            let commonAtMentionStyles = 'padding: 2px 3px;border-radius: 2px;';

            AT_MENTIONABLE.forEach((user) => {
                if (user == CURRENT_USER) {
                    return;
                }

                let regex = new RegExp(`@${user}`, 'gi');
                let matches = newHtml.match(regex);
                if (matches) {
                    newHtml = newHtml.replace(
                        regex,
                        `<span style="background-color:#${MENTIONED_USER_COLOR};${commonAtMentionStyles}">${matches[0]}</span>`
                    );
                }
            });

            console.log('[YTNC] Updating message innerHTML', { newHtml });
            message.innerHTML = newHtml;
        }

        // Attach input listener (try every time)
        attachInputListener();
    }
};

observer.observe(document.body, { childList: true, subtree: true });
