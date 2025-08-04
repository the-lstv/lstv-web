window._assistantCallback = async (app, auth) => {
    window.__assistant = true;

    let TOKEN;

    async function getToken() {
        if (!TOKEN || TOKEN.expiresAt < Date.now()) {
            try {
                TOKEN = await auth.getIntentToken('arisen');
                return TOKEN.token;
            } catch (error) {
                console.error('Failed to get token:', error);
                throw error;
            }
        }

        return TOKEN.token;
    }

    const container = O("#toolbarAssistant");
    const chatInput = O("#assistant-input");

    app.assistant = {
        GET: 1,
        POST: 2,
        PUT: 3,
        DELETE: 4,
    
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    
        api: "https://api.extragon." + (location.origin.endsWith("localhost")? "localhost": "cloud") + '/arisen',
    
        cache: {
            user: null,
            models: null,
            chats: null
        },

        get generating() {
            return container.classList.contains("generating");
        },

        set generating(value) {
            if (value) {
                container.classList.add("generating");
            } else {
                container.classList.remove("generating");
            }
        },

        chatContainer: container.querySelector('.generated-content'),

        async request(method, endpoint, data = null, asBuffer = false) {
            const url = `${this.api}/${endpoint}`;
            const methodName = this.methods[method - 1];
    
            const options = {
                method: methodName,
                headers: {
                    'Authorization': `Bearer ${await getToken()}`
                }
            };
    
            if (data) {
                options.body = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
            }
    
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                if (asBuffer) {
                    return await response.arrayBuffer();
                }
                return await response.json();
            } catch (error) {
                console.error(`Error during ${methodName} request to ${endpoint}:`, error);
                throw error;
            }
        },
    
        async getUser() {
            try {
                return await this.request(this.GET, 'user');
            } catch (error) {
                console.error('Failed to fetch user:', error);
                throw error;
            }
        },
    
        async patchUser(data) {
            try {
                return await this.request(this.PUT, 'user', data);
            } catch (error) {
                console.error('Failed to update user:', error);
                throw error;
            }
        },
    
        async getChats() {
            try {
                return await this.request(this.GET, 'chats');
            } catch (error) {
                console.error('Failed to fetch chats:', error);
                throw error;
            }
        },
    
        async getChat(chatId) {
            try {
                return await this.request(this.GET, `chat/${chatId}`);
            } catch (error) {
                console.error(`Failed to fetch chat ${chatId}:`, error);
                throw error;
            }
        },
    
        async getModels() {
            try {
                return await this.request(this.GET, 'models');
            } catch (error) {
                console.error('Failed to fetch models:', error);
                throw error;
            }
        },
    
        async createChat(chatData, onChunk = () => {}) {
            let first = true, info = null;
            try {
                return await this.openStream('chat/new', chatData, chunk => {
                    if (first) {
                        first = false;
                        info = chunk;
                    }
    
                    onChunk(chunk, info);
                });
            } catch (error) {
                console.error('Failed to create chat:', error);
                throw error;
            }
        },
    
        async importChat(data) {
            try {
                return await this.request(this.POST, 'chat/import', data);
            } catch (error) {
                console.error('Failed to import chat:', error);
                throw error;
            }
        },
    
        async postMessage(chatId, data, onChunk) {
            try {
                return await this.openStream(`chat/${chatId}`, data, onChunk);
            } catch (error) {
                console.error(`Failed to post message to chat ${chatId}:`, error);
                throw error;
            }
        },
    
        async updateChat(chatId, data) {
            try {
                return await this.request(this.PUT, `chat/${chatId}`, data);
            } catch (error) {
                console.error(`Failed to update chat ${chatId}:`, error);
                throw error;
            }
        },
    
        async getSystemPrompt(modelId) {
            try {
                return await this.request(this.GET, `getSystemPrompt/${modelId || ''}`);
            } catch (error) {
                console.error(`Failed to fetch system prompt for model ${modelId}:`, error);
                throw error;
            }
        },
    
        async generateImage(options) {
            try {
                const imageBuffer = await this.request(this.POST, 'imagen/generate', options, true);
                const blob = new Blob([imageBuffer], { type: 'image/png' });
                return URL.createObjectURL(blob);
            } catch (error) {
                console.error('Failed to generate image:', error);
                throw error;
            }
        },
    
        async openStream(endpoint, postData, onChunk) {
            const res = await fetch(`${this.api}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`
                },
                body: typeof postData === "string"? postData: JSON.stringify(postData)
            });
    
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
    
            let buffer = "";
    
            let done = false;
            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
    
                    buffer += chunk;
    
                    let lines = buffer.split("\n");
                    buffer = lines.pop(); // incomplete line stays in buffer
    
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const dataStr = line.slice(6);
                            try {
                                onChunk(JSON.parse(dataStr));
                            } catch (e) {
                                console.error("Failed parsing JSON:", e);
                            }
                        }
                    }
                }
            }
    
            onChunk(null);
        },
    
        async deleteChat(chatId) {
            try {
                return await this.request(this.DELETE, `chat/${chatId}`);
            } catch (error) {
                console.error(`Failed to delete chat ${chatId}:`, error);
                throw error;
            }
        }
    }

    const autoResize = (textarea) => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(20, textarea.scrollHeight || 20) + 'px';
    };

    chatInput.addEventListener('input', () => autoResize(chatInput));
    autoResize(chatInput);

    chatInput.on("keydown", async (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !app.assistant.generating) {
            e.preventDefault();
            document.forms["assistantForm"].dispatchEvent(new Event("submit", { cancelable: true }));
        }
    });

    document.forms["assistantForm"].addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = chatInput.value.trim();

        if (app.assistant.generating) {
            console.warn("Already generating a response, please wait.");
            return false;
        }

        if (message) {
            chatInput.value = '';
            autoResize(chatInput);

            const infoBar = O(".assistant-intro");
            if (infoBar) infoBar.remove();

            const infoBarExamples = O(".assistant-examples");
            if (infoBarExamples) infoBarExamples.style.display = "none";

            app.assistant.generating = true;

            app.assistant.chatContainer.appendChild(N('div', {
                class: 'message-container message-user',
                inner: [
                    N('div', {
                        class: 'message',
                        inner: N('div', { textContent: message })
                    })
                ]
            }));

            const renderingTarget = N();
            const messageElement = N('div', {
                class: 'message-container message-assistant',
                inner: [
                    N('div', {
                        class: 'message',
                        inner: renderingTarget
                    })
                ]
            });

            app.assistant.chatContainer.appendChild(messageElement);

            if(!app.isLoggedIn) {
                messageElement.setAttribute("ls-accent", "red");
                renderingTarget.textContent = "You must be logged in to use the assistant.";
                app.assistant.generating = false;
                return;
            }

            const content = {
                content: message,
                isSiteAssistant: true
            };

            const onChunk = (chunk) => {
                if (chunk === null) {
                    // Stream ended
                    app.assistant.generating = false;
                    return;
                }

                if (chunk.type === 'info') {
                    app.assistant.currentChat = chunk;
                    return;
                }

                if (typeof chunk === 'string') {
                    renderingTarget.appendChild(document.createTextNode(chunk));
                    return;
                }

                if (chunk.error) {
                    console.error("Error in response:", chunk.error);
                    app.assistant.generating = false;
                    return;
                }

                if (chunk.type === 'embed') { /* tba */ }
            };

            try {
                if (app.assistant.currentChat) {
                    await app.assistant.postMessage(app.assistant.currentChat._id, content, onChunk).catch(error => { throw error; });
                } else {
                    await app.assistant.createChat(content, onChunk).catch(error => { throw error; });
                }
            } catch (error) {
                console.error(error);

                app.assistant.generating = false;
                messageElement.setAttribute("ls-accent", "red");
                renderingTarget.textContent = "An error occurred while processing your request. Please try again later.";
            }
        }

        return false;
    });

    function start(shaders) {
        if(shaders) {
            const background_canvas = N("canvas", {
                class: "background",
            });
    
            const main_shader_renderer = new CombinedShaderRenderer(background_canvas, { width: 1024, height: 1024 });
    
            main_shader_renderer.addShaderContext(ShaderSource.blurredColors(main_shader_renderer.gl), {
                u_time: { type: "uniform1f", value: a => [(a / 1e3)] },
                alpha: { type: "uniform1f", value: [0.6] },
                u_resolution: { type: "uniform2f", value: () => [background_canvas.width, background_canvas.height] },
                u_colors: { type: "uniform4fv", value: [[0.4392156862745098,0,1,0, 0,0.6235294117647059,1,0, 0.5019607843137255,0.7490196078431373,1,0.75, 0.3686274509803922,0.7686274509803922,1,0.27]] },
                u_blur: { type: "uniform1f", value: [1] },
                u_animate: { type: "uniform1f", value: [1] },
                u_animate_speed: { type: "uniform1f", value: [.4] },
                u_frequency: { type: "uniform1f", value: [0] }
            });

            container.appendChild(background_canvas);
            main_shader_renderer.resume();
        }

        container.get(".loading").remove();
        container.get(".content").style.display = "";
        container.class("ready");
    }

    if(typeof CombinedShaderRenderer === 'undefined') {
        M.LoadScript("/assets/js/shader.js" + window.cacheKey, (error) => {
            if(error) {
                console.error(error);
                start(false);
                return;
            }

            start(true)
        })
    } else start(true);

};