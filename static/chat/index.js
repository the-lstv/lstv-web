website.register(document.currentScript, class Chat extends LS.Context {
    static MESSAGE_TEMPLATE = LS.CompileTemplate((data, logic) => ({
        class: "chat-message",
        inner: [
            {
                class: "chat-message-avatar"
            },
            {
                class: "chat-message-content",
                inner: [
                    {
                        class: "chat-message-username",
                        textContent: data.username || "Unknown User"
                    },
                    {
                        class: "chat-message-text",
                        textContent: data.message || ""
                    }
                ]
            }
        ]
    }));

    static COMMUNITY_ICON_TEMPLATE = LS.CompileTemplate((data, logic) => ({
        class: "server-item-icon",
        tooltip: logic.or(data.name, "Unnamed Community"),
    }));

    #token = null;

    async #getToken() {
        if (!this.#token || this.#token.expiresAt < Date.now()) {
            try {
                this.#token = await auth.getIntentToken('chat');
                return this.#token.token;
            } catch (error) {
                console.error('Failed to get token:', error);
                throw error;
            }
        }

        return this.#token.token;
    }

    constructor(context, container) {
        super();
        context.setOptions({
            title: "Chat",
            contextName: "Chat",
            dynamicAccount: true
        });

        context.registerSPAExtension("/chat/{,*,user/*,community/*,community/*/*}", this.handleNavigation.bind(this));

        this.context = context;
        this.container = container;
        this.auth = this.context.requestPermission(["auth"]).auth;

        this.api = "https://api.extragon." + (location.hostname.endsWith("localhost")? "localhost" : "cloud") + "/chat/";

        LS.Resize.set(this.container.querySelector("#chat-right-area"), {
            left: true,
            snapArea: 80,
            snapHorizontal: true,
            snapCollapse: true,
            store: "chat-right-area-width"
        });
    
        LS.Resize.set(this.container.querySelector("#chat-left-area"), {
            right: true,
            snapArea: 80,
            store: "chat-left-area-width",
            snapHorizontal: true,
            snapCollapse: true
        });

        this.currentCommunityWrapper = this.addDestroyable(LS.Reactive.wrap("chat_community", {}));

        // Containers
        this.communityListContainer = this.container.querySelector("#server-list");

        this.loginSwitch = this.addDestroyable(new LS.Util.ElementSwitch([this.container.querySelector('.loadingIndicator'), LS.Create('div', {
            class: "login-notice container-content",
            inner: [
                N("h3", "You are not logged in"),
                N("button", {
                    textContent: "Log in",
                    class: "pill",
                    onclick: () => website.showLoginToolbar()
                })
            ]
        }), this.container.querySelector('.loadingContent')], null, {
            mode: "dom",
            parent: this.container,
            initial: -1
        }));

        this.first = true;

        this.container.querySelector('.loadingIndicator h3').textContent = "Connecting...";
    
        // TODO: Handle account switching
        context.watchUser((loggedIn, fragment) => {
            if (loggedIn) {
                this.#token = null; // Force refresh
                this.init();
            } else {
                this.loginSwitch.set(1);
            }
        });
    }

    async init() {
        if(this.initialized) {
            this.loginSwitch.front();
            return;
        }

        this.initialized = true;
        await this.#getToken();

        const self = this;

        // Add destroyable will automatically close the WebSocket
        this.ws = this.addDestroyable(new LS.WebSocket(this.api, {
            get initialPayload() {
                return self.#token?.token;
            }
        }));

        this.ws.on('open', this.wsOpened.bind(this));
        this.ws.on('message', this.wsMessage.bind(this));
        this.ws.on('close', this.wsClosed.bind(this));
        this.handleNavigation();
    }

    wsOpened() {
        this.first = true;
        this.context.log("WebSocket connection opened");
    }

    wsMessage(message) {
        if (this.first) {
            this.first = false;
            this.loginSwitch.front();
            this.container.querySelector('#chat-main').style.display = "";
        }

        const msgObj = JSON.parse(message);
        if(msgObj.error) {
            // TODO: Handle
            this.context.error("WebSocket error:", msgObj.error);
            this.ws.close();
            return;
        }

        switch(msgObj.type) {
            case 'bootstrap':
                this.context.log("Received bootstrap data:", msgObj);

                this.refreshCommunities(msgObj.communities);
                break;
        }
    }

    wsClosed(code, reason) {
        this.context.log(`WebSocket connection closed: ${code} - ${reason}`);
    }

    async request(method, endpoint, data = null, asBuffer = false) {
        const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
        const url = `${this.api}${normalizedEndpoint}`;

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${await this.#getToken()}`
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
            options.headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, options);

            if (asBuffer && response.ok) {
                return await response.arrayBuffer();
            }

            return await response.json();
        } catch (error) {
            console.error(`Error during ${method} request to ${endpoint}:`, error);
            return { error }
        }
    }

    handleNavigation() {
        const url = window.location.pathname.toLowerCase().split("/").filter(s => s.length > 0);
        url.shift(); // Remove 'chat' part
    }

    destroy() {
        this.#token = null;
        LS.Resize.remove(this.container.querySelector("#chat-right-area"));
        LS.Resize.remove(this.container.querySelector("#chat-left-area"));
        super.destroy();
    }







    // -- REST API

    async refreshCommunities(data) {
        if(!data) data = await this.request('GET', 'communities');
        this.context.log("Communities data:", data);

        this.communityListContainer.innerHTML = '';

        for (const community of data) {
            const communityElement = this.constructor.COMMUNITY_ICON_TEMPLATE(community).root;
            this.communityListContainer.appendChild(communityElement);
            // communityElement.onclick = () => {
            // };
        }
    }

    async upsertCommunity(data, isPatch = data.id !== undefined) {
        try {
            const result = await this.request(isPatch ? 'PATCH' : 'POST', 'communities', data);
            this.refreshCommunities();
            return result;
        } catch (error) {
            console.error("Failed to upsert community:", error);
            throw error;
        }
    }

    async deleteCommunity(communityId) {
        try {
            const result = await this.request('DELETE', `communities/${communityId}`);
            this.refreshCommunities();
            return result;
        } catch (error) {
            console.error("Failed to delete community:", error);
            throw error;
        }
    }

    async setActiveCommunity(communityId) {
        const info = await this.request('GET', `communities/${communityId}`);
        this.currentCommunityWrapper.__bind.swapObject(info);
        this.activeCommunity = communityId;
        return info;
    }

    async createInvite(communityId, options = {}) {
        return this.request('POST', `communities/${communityId}/invites`, options);
    }

    async updateInvite(inviteCode, options = {}) {
        return this.request('PATCH', `invites/${inviteCode}`, options);
    }

    async deleteInvite(inviteCode) {
        return this.request('DELETE', `invites/${inviteCode}`);
    }

    async joinInvite(inviteCode) {
        return this.request('POST', `invites/${inviteCode}/join`);
    }

    async listChannels(communityId) {
        return this.request('GET', `communities/${communityId}/channels`);
    }

    async createChannel(communityId, data) {
        return this.request('POST', `communities/${communityId}/channels`, data);
    }

    async updateChannel(communityId, channelId, data) {
        return this.request('PATCH', `communities/${communityId}/channels/${channelId}`, data);
    }

    async deleteChannel(communityId, channelId) {
        return this.request('DELETE', `communities/${communityId}/channels/${channelId}`);
    }

    async getMessages(channelId, options = {}) {
        return this.request('GET', `channels/${channelId}/messages?` + new URLSearchParams(options).toString());
    }

    async postMessage(channelId, message) {
        return this.request('POST', `channels/${channelId}/messages`, message);
    }

    async editMessage(messageId, data) {
        return this.request('PATCH', `messages/${messageId}`, data);
    }

    async deleteMessage(messageId) {
        return this.request('DELETE', `messages/${messageId}`);
    }

    async openDm(userId) {
        return this.request('POST', `dms`, { user: userId });
    }

    async closeDm(dmId) {
        return this.request('DELETE', `dms/${dmId}`);
    }

    async blockUser(userId) {
        return this.request('POST', `users/${userId}/block`);
    }

    async unblockUser(userId) {
        return this.request('DELETE', `users/${userId}/block`);
    }
});

function markdown(text) {
    let i = 0;
    for(let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);

        if(char === 42) { // *
            // Bold or italic
        } else if(char === 95) { // _
            // Italic or underline
        } else if(char === 126) { // ~
            // Strikethrough
        } else if(char === 96) { // `
            // Code
        } else if(char === 91) { // [
            // Link
        }
    }
}