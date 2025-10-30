class MD_Renderer {
    constructor(root) {
        this.data = {
            nodes: ([root,,,,,]),
            index: 0,
        };
    }

    add_token(data, type) {
        let parent = data.nodes[data.index];
        let slot;

        switch (type) {
        case smd.DOCUMENT: return // document is provided
        case smd.BLOCKQUOTE:    slot = document.createElement("blockquote");break
        case smd.PARAGRAPH:     slot = document.createElement("p")         ;break
        case smd.LINE_BREAK:    slot = document.createElement("br")        ;break
        case smd.RULE:          slot = document.createElement("hr")        ;break
        case smd.HEADING_1:     slot = document.createElement("h1")        ;break
        case smd.HEADING_2:     slot = document.createElement("h2")        ;break
        case smd.HEADING_3:     slot = document.createElement("h3")        ;break
        case smd.HEADING_4:     slot = document.createElement("h4")        ;break
        case smd.HEADING_5:     slot = document.createElement("h5")        ;break
        case smd.HEADING_6:     slot = document.createElement("h6")        ;break
        case smd.ITALIC_AST:
        case smd.ITALIC_UND:    slot = document.createElement("em")        ;break
        case smd.STRONG_AST:
        case smd.STRONG_UND:    slot = document.createElement("strong")    ;break
        case smd.STRIKE:        slot = document.createElement("s")         ;break
        case smd.CODE_INLINE:   slot = document.createElement("code")      ;break
        case smd.RAW_URL:
        case smd.LINK:          slot = document.createElement("a")         ;break
        case smd.IMAGE:         slot = document.createElement("img")       ;break
        case smd.LIST_UNORDERED:slot = document.createElement("ul")        ;break
        case smd.LIST_ORDERED:  slot = document.createElement("ol")        ;break
        case smd.LIST_ITEM:     slot = document.createElement("li")        ;break
        case smd.CHECKBOX:
            let checkbox = slot = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.disabled = true
            break
        case smd.CODE_BLOCK:
        case smd.CODE_FENCE:
            parent = parent.appendChild(document.createElement("pre"))
            slot   = document.createElement("code")
            break
        case smd.TABLE:
            slot = document.createElement("table")
            break
        case smd.TABLE_ROW:
            switch (parent.children.length) {
            case 0:
                parent = parent.appendChild(document.createElement("thead"))
                break
            case 1:
                parent = parent.appendChild(document.createElement("tbody"))
                break
            default:
                parent = parent.children[1]
            }
            slot = document.createElement("tr")
            break
        case smd.TABLE_CELL:
            slot = document.createElement(parent.parentElement?.tagName === "THEAD" ? "th" : "td")
            break
        case smd.EQUATION_BLOCK:  slot = document.createElement("equation-block"); break
        case smd.EQUATION_INLINE: slot = document.createElement("equation-inline"); break
        }
    
        data.nodes[++data.index] = parent.appendChild(slot)
    }

    end_token(data) {
        data.index -= 1;
    }

    add_text(data, text) {
        data.nodes[data.index].appendChild(document.createTextNode(text))
    }

    attr_to_html_attr(type) {
        switch (type) {
        case smd.HREF:    return "href"
        case smd.SRC :    return "src"
        case smd.LANG:    return "class"
        case smd.CHECKED: return "checked"
        case smd.START:   return "start"
        }
    }

    set_attr(data, type, value) {
        data.nodes[data.index].setAttribute(this.attr_to_html_attr(type), value)
    }
}

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

    const exampleContainer = container.querySelector(".assistant-examples");

    if (exampleContainer) {
        for(let [value, text] of [["Hello! Who are you?", "Say hi"], ["Check my saved reminders.", "Check reminders"], ["I want to report a bug or suggest a feature related to lstv.space.", "Report a bug"]]) {
            exampleContainer.add(N("button", {
                class: "pill elevated",
                onclick() { chatInput.value = value; },
                inner: text
            }))
        }
    }

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

            if (exampleContainer) exampleContainer.style.display = "none";

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

            let renderingTarget = N();

            const renderer = new MD_Renderer(renderingTarget);
            const parser = smd.parser(renderer);

            const wasScrolledAtBottom = app.assistant.chatContainer.scrollHeight - app.assistant.chatContainer.scrollTop === app.assistant.chatContainer.clientHeight;

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
                    smd.parser_end(parser);
                    return;
                }

                if (typeof chunk === 'string') {
                    // if(chunk === "<think>") {
                    //     const newRenderingTarget = N();
                    //     renderingTargetStack.push(newRenderingTarget);
                    //     renderingTarget.appendChild(N('details', {
                    //         class: 'reasoning-container',
                    //         inner: [N("summary", "Reasoning..."), newRenderingTarget],
                    //         attr: ["ls-accent"],
                    //         onclick(){
                    //             this.classList.toggle("expanded");
                    //         }
                    //     }));

                    //     renderingTarget = newRenderingTarget;
                    //     return;
                    // }

                    // if(chunk === "</think>") {
                    //     renderingTargetStack.pop();
                    //     renderingTarget = renderingTargetStack[renderingTargetStack.length - 1];
                    //     return;
                    // }

                    smd.parser_write(parser, chunk);

                    if(wasScrolledAtBottom) {
                        app.assistant.chatContainer.scrollTop = app.assistant.chatContainer.scrollHeight;
                    }
                    return;
                }

                if (chunk.type === 'info') {
                    app.assistant.currentChat = chunk;
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


/*
Streaming Markdown Parser and Renderer
MIT License
Copyright 2024 Damian Tarnawski
https://github.com/thetarnav/streaming-markdown
*/;(()=>{var D=2,C=3,h=4,b=5,B=6,U=7,G=8,S=9,x=10,m=11,H=12,K=13,M=14,Q=15,w=16,q=17,W=18,P=19,Y=20,y=21,F=22,$=23,v=24,X=25,j=26,z=27,J=28,V=29,Z=30,p=31;var I=1,k=2,L=4,T=8,f=16;function ee(e){switch(e){case I:return"href";case k:return"src";case L:return"class";case T:return"checked";case f:return"start"}}var ne=e=>{switch(e){case 1:return 3;case 2:return 4;case 3:return 5;case 4:return 6;case 5:return 7;default:return 8}},te=ne;var O=24;function ae(e){let c=new Uint32Array(O);return c[0]=1,{renderer:e,text:"",pending:"",tokens:c,len:0,token:1,fence_end:0,blockquote_idx:0,hr_char:"",hr_chars:0,fence_start:0,spaces:new Uint8Array(O),indent:"",indent_len:0,table_state:0}}function ce(e){e.pending.length>0&&o(e,`
`)}function a(e){e.text.length!==0&&(e.renderer.add_text(e.renderer.data,e.text),e.text="")}function _(e){e.len-=1,e.token=e.tokens[e.len],e.renderer.end_token(e.renderer.data)}function i(e,c){(e.tokens[e.len]===24||e.tokens[e.len]===23)&&c!==25&&_(e),e.len+=1,e.tokens[e.len]=c,e.token=c,e.renderer.add_token(e.renderer.data,c)}function re(e,c,n){for(;n<=e.len;){if(e.tokens[n]===c)return n;n+=1}return-1}function l(e,c){for(e.fence_start=0;e.len>c;)_(e)}function u(e,c){let n=0;for(let t=0;t<=e.len&&(c-=e.spaces[t],!(c<0));t+=1)switch(e.tokens[t]){case 9:case 10:case 20:case 25:n=t;break}for(;e.len>n;)_(e);return c}function A(e,c){let n=-1,t=-1;for(let s=e.blockquote_idx+1;s<=e.len;s+=1)if(e.tokens[s]===25){if(e.indent_len<e.spaces[s]){t=-1;break}t=s}else e.tokens[s]===c&&(n=s);return t===-1?n===-1?(l(e,e.blockquote_idx),i(e,c),!0):(l(e,n),!1):(l(e,t),i(e,c),!0)}function g(e,c){i(e,25),e.spaces[e.len]=e.indent_len+c,E(e),e.token=103}function E(e){e.indent="",e.indent_len=0,e.pending=""}function N(e){switch(e){case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:return!0;default:return!1}}function ie(e){switch(e){case 32:case 58:case 59:case 41:case 44:case 33:case 46:case 63:case 93:case 10:return!0;default:return!1}}function se(e){return N(e)||ie(e)}function o(e,c){for(let n of c){if(e.token===101){switch(n){case" ":e.indent_len+=1;continue;case"	":e.indent_len+=4;continue}let s=u(e,e.indent_len);e.indent_len=0,e.token=e.tokens[e.len],s>0&&o(e," ".repeat(s))}let t=e.pending+n;switch(e.token){case 21:case 1:case 20:case 24:case 23:switch(e.pending[0]){case void 0:e.pending=n;continue;case" ":e.pending=n,e.indent+=" ",e.indent_len+=1;continue;case"	":e.pending=n,e.indent+="	",e.indent_len+=4;continue;case`
`:if(e.tokens[e.len]===25&&e.token===21){_(e),E(e),e.pending=n;continue}l(e,e.blockquote_idx),E(e),e.blockquote_idx=0,e.fence_start=0,e.pending=n;continue;case"#":switch(n){case"#":if(e.pending.length<6){e.pending=t;continue}break;case" ":u(e,e.indent_len),i(e,te(e.pending.length)),E(e);continue}break;case">":{let r=re(e,20,e.blockquote_idx+1);r===-1?(l(e,e.blockquote_idx),e.blockquote_idx+=1,e.fence_start=0,i(e,20)):e.blockquote_idx=r,E(e),e.pending=n;continue}case"-":case"*":case"_":if(e.hr_chars===0&&(e.hr_chars=1,e.hr_char=e.pending),e.hr_chars>0){switch(n){case e.hr_char:e.hr_chars+=1,e.pending=t;continue;case" ":e.pending=t;continue;case`
`:if(e.hr_chars<3)break;u(e,e.indent_len),e.renderer.add_token(e.renderer.data,22),e.renderer.end_token(e.renderer.data),E(e),e.hr_chars=0;continue}e.hr_chars=0}if(e.pending[0]!=="_"&&e.pending[1]===" "){A(e,23),g(e,2),o(e,t.slice(2));continue}break;case"`":if(e.pending.length<3){if(n==="`"){e.pending=t,e.fence_start=t.length;continue}e.fence_start=0;break}switch(n){case"`":e.pending.length===e.fence_start?(e.pending=t,e.fence_start=t.length):(i(e,2),E(e),e.fence_start=0,o(e,t));continue;case`
`:{u(e,e.indent_len),i(e,10),e.pending.length>e.fence_start&&e.renderer.set_attr(e.renderer.data,L,e.pending.slice(e.fence_start)),E(e),e.token=101;continue}default:e.pending=t;continue}case"+":if(n!==" ")break;A(e,23),g(e,2);continue;case"0":case"1":case"2":case"3":case"4":case"5":case"6":case"7":case"8":case"9":if(e.pending[e.pending.length-1]==="."){if(n!==" ")break;A(e,24)&&e.pending!=="1."&&e.renderer.set_attr(e.renderer.data,f,e.pending.slice(0,-1)),g(e,e.pending.length+1);continue}else{let r=n.charCodeAt(0);if(r===46||N(r)){e.pending=t;continue}}break;case"|":l(e,e.blockquote_idx),i(e,27),i(e,28),e.pending="",o(e,n);continue}let s=t;if(e.token===21)e.token=e.tokens[e.len],e.renderer.add_token(e.renderer.data,21),e.renderer.end_token(e.renderer.data);else if(e.indent_len>=4){let r=0;for(;r<4;r+=1)if(e.indent[r]==="	"){r=r+1;break}s=e.indent.slice(r)+t,i(e,9)}else i(e,2);E(e),o(e,s);continue;case 27:if(e.table_state===1)switch(n){case"-":case" ":case"|":case":":e.pending=t;continue;case`
`:e.table_state=2,e.pending="";continue;default:_(e),e.table_state=0;break}else switch(e.pending){case"|":i(e,28),e.pending="",o(e,n);continue;case`
`:_(e),e.pending="",e.table_state=0,o(e,n);continue}break;case 28:switch(e.pending){case"":break;case"|":i(e,29),_(e),e.pending="",o(e,n);continue;case`
`:_(e),e.table_state=Math.min(e.table_state+1,2),e.pending="",o(e,n);continue;default:i(e,29),o(e,n);continue}break;case 29:if(e.pending==="|"){a(e),_(e),e.pending="",o(e,n);continue}break;case 9:switch(t){case`
    `:case`
   	`:case`
  	`:case`
 	`:case`
	`:e.text+=`
`,e.pending="";continue;case`
`:case`
 `:case`
  `:case`
   `:e.pending=t;continue;default:e.pending.length!==0?(a(e),_(e),e.pending=n):e.text+=n;continue}case 10:switch(n){case"`":e.pending=t;continue;case`
`:if(t.length===e.fence_start+e.fence_end+1){a(e),_(e),e.pending="",e.fence_start=0,e.fence_end=0,e.token=101;continue}e.token=101;break;case" ":if(e.pending[0]===`
`){e.pending=t,e.fence_end+=1;continue}break}e.text+=e.pending,e.pending=n,e.fence_end=1;continue;case 11:switch(n){case"`":t.length===e.fence_start+ +(e.pending[0]===" ")?(a(e),_(e),e.pending="",e.fence_start=0):e.pending=t;continue;case`
`:e.text+=e.pending,e.pending="",e.token=21,e.blockquote_idx=0,a(e);continue;case" ":e.text+=e.pending,e.pending=n;continue;default:e.text+=t,e.pending="";continue}case 103:switch(e.pending.length){case 0:if(n!=="[")break;e.pending=t;continue;case 1:if(n!==" "&&n!=="x")break;e.pending=t;continue;case 2:if(n!=="]")break;e.pending=t;continue;case 3:if(n!==" ")break;e.renderer.add_token(e.renderer.data,26),e.pending[1]==="x"&&e.renderer.set_attr(e.renderer.data,T,""),e.renderer.end_token(e.renderer.data),e.pending=" ";continue}e.token=e.tokens[e.len],e.pending="",o(e,t);continue;case 14:case 15:{let r="*",d=12;if(e.token===15&&(r="_",d=13),r===e.pending){if(a(e),r===n){_(e),e.pending="";continue}i(e,d),e.pending=n;continue}break}case 12:case 13:{let r="*",d=14;switch(e.token===13&&(r="_",d=15),e.pending){case r:r===n?e.tokens[e.len-1]===d?e.pending=t:(a(e),i(e,d),e.pending=""):(a(e),_(e),e.pending=n);continue;case r+r:let R=e.token;a(e),_(e),_(e),r!==n?(i(e,R),e.pending=n):e.pending="";continue}break}case 16:if(t==="~~"){a(e),_(e),e.pending="";continue}break;case 105:n===`
`?(a(e),i(e,30),e.pending=""):(e.token=e.tokens[e.len],e.pending[0]==="\\"?e.text+="[":e.text+="$$",e.pending="",o(e,n));continue;case 30:if(t==="\\]"||t==="$$"){a(e),_(e),e.pending="";continue}break;case 31:if(t==="\\)"||e.pending[0]==="$"){a(e),_(e),n===")"?e.pending="":e.pending=n;continue}break;case 102:t==="http://"||t==="https://"?(a(e),i(e,18),e.pending=t,e.text=t):"http:/"[e.pending.length]===n||"https:/"[e.pending.length]===n?e.pending=t:(e.token=e.tokens[e.len],o(e,n));continue;case 17:case 19:if(e.pending==="]"){a(e),n==="("?e.pending=t:(_(e),e.pending=n);continue}if(e.pending[0]==="]"&&e.pending[1]==="("){if(n===")"){let r=e.token===17?I:k,d=e.pending.slice(2);e.renderer.set_attr(e.renderer.data,r,d),_(e),e.pending=""}else e.pending+=n;continue}break;case 18:n===" "||n===`
`||n==="\\"?(e.renderer.set_attr(e.renderer.data,I,e.pending),a(e),_(e),e.pending=n):(e.text+=n,e.pending=t);continue;case 104:if(t.startsWith("<br")){if(t.length===3||n===" "||n==="/"&&(t.length===4||e.pending[e.pending.length-1]===" ")){e.pending=t;continue}if(n===">"){a(e),e.token=e.tokens[e.len],e.renderer.add_token(e.renderer.data,21),e.renderer.end_token(e.renderer.data),e.pending="";continue}}e.token=e.tokens[e.len],e.text+="<",e.pending=e.pending.slice(1),o(e,n);continue}switch(e.pending[0]){case"\\":if(e.token===19||e.token===30||e.token===31)break;switch(n){case"(":a(e),i(e,31),e.pending="";continue;case"[":e.token=105,e.pending=t;continue;case`
`:e.pending=n;continue;default:let s=n.charCodeAt(0);e.pending="",e.text+=N(s)||s>=65&&s<=90||s>=97&&s<=122?t:n;continue}case`
`:switch(e.token){case 19:case 30:case 31:break;case 3:case 4:case 5:case 6:case 7:case 8:a(e),l(e,e.blockquote_idx),e.blockquote_idx=0,e.pending=n;continue;default:a(e),e.pending=n,e.token=21,e.blockquote_idx=0;continue}break;case"<":if(e.token!==19&&e.token!==30&&e.token!==31){a(e),e.pending=t,e.token=104;continue}break;case"`":if(e.token===19)break;n==="`"?(e.fence_start+=1,e.pending=t):(e.fence_start+=1,a(e),i(e,11),e.text=n===" "||n===`
`?"":n,e.pending="");continue;case"_":case"*":{if(e.token===19||e.token===30||e.token===31||e.token===14)break;let s=12,r=14,d=e.pending[0];if(d==="_"&&(s=13,r=15),e.pending.length===1){if(d===n){e.pending=t;continue}if(n!==" "&&n!==`
`){a(e),i(e,s),e.pending=n;continue}}else{if(d===n){a(e),i(e,r),i(e,s),e.pending="";continue}if(n!==" "&&n!==`
`){a(e),i(e,r),e.pending=n;continue}}break}case"~":if(e.token!==19&&e.token!==16){if(e.pending==="~"){if(n==="~"){e.pending=t;continue}}else if(n!==" "&&n!==`
`){a(e),i(e,16),e.pending=n;continue}}break;case"$":if(e.token!==19&&e.token!==16&&e.pending==="$")if(n==="$"){e.token=105,e.pending=t;continue}else{if(se(n.charCodeAt(0)))break;a(e),i(e,31),e.pending=n;continue}break;case"[":if(e.token!==19&&e.token!==17&&e.token!==30&&e.token!==31&&n!=="]"){a(e),i(e,17),e.pending=n;continue}break;case"!":if(e.token!==19&&n==="["){a(e),i(e,19),e.pending="";continue}break;case" ":if(e.pending.length===1&&n===" ")continue;break}if(e.token!==19&&e.token!==17&&e.token!==30&&e.token!==31&&n==="h"&&(e.pending===" "||e.pending==="")){e.text+=e.pending,e.pending=n,e.token=102;continue}e.text+=e.pending,e.pending=n}a(e)}function _e(e){return{add_token:oe,end_token:de,add_text:Ee,set_attr:le,data:{nodes:[e,,,,,],index:0}}}function oe(e,c){let n=e.nodes[e.index],t;switch(c){case 1:return;case 20:t=document.createElement("blockquote");break;case 2:t=document.createElement("p");break;case 21:t=document.createElement("br");break;case 22:t=document.createElement("hr");break;case 3:t=document.createElement("h1");break;case 4:t=document.createElement("h2");break;case 5:t=document.createElement("h3");break;case 6:t=document.createElement("h4");break;case 7:t=document.createElement("h5");break;case 8:t=document.createElement("h6");break;case 12:case 13:t=document.createElement("em");break;case 14:case 15:t=document.createElement("strong");break;case 16:t=document.createElement("s");break;case 11:t=document.createElement("code");break;case 18:case 17:t=document.createElement("a");break;case 19:t=document.createElement("img");break;case 23:t=document.createElement("ul");break;case 24:t=document.createElement("ol");break;case 25:t=document.createElement("li");break;case 26:let s=t=document.createElement("input");s.type="checkbox",s.disabled=!0;break;case 9:case 10:n=n.appendChild(document.createElement("pre")),t=document.createElement("code");break;case 27:t=document.createElement("table");break;case 28:switch(n.children.length){case 0:n=n.appendChild(document.createElement("thead"));break;case 1:n=n.appendChild(document.createElement("tbody"));break;default:n=n.children[1]}t=document.createElement("tr");break;case 29:t=document.createElement(n.parentElement?.tagName==="THEAD"?"th":"td");break;case 30:t=document.createElement("equation-block");break;case 31:t=document.createElement("equation-inline");break}e.nodes[++e.index]=n.appendChild(t)}function de(e){e.index-=1}function Ee(e,c){e.nodes[e.index].appendChild(document.createTextNode(c))}function le(e,c,n){e.nodes[e.index].setAttribute(ee(c),n)}window.smd={BLOCKQUOTE:Y,CHECKBOX:j,CHECKED:T,CODE_BLOCK:S,CODE_FENCE:x,CODE_INLINE:m,EQUATION_BLOCK:Z,EQUATION_INLINE:p,HEADING_1:C,HEADING_2:h,HEADING_3:b,HEADING_4:B,HEADING_5:U,HEADING_6:G,HREF:I,IMAGE:P,ITALIC_AST:H,ITALIC_UND:K,LANG:L,LINE_BREAK:y,LINK:q,LIST_ITEM:X,LIST_ORDERED:v,LIST_UNORDERED:$,PARAGRAPH:D,RAW_URL:W,RULE:F,SRC:k,START:f,STRIKE:w,STRONG_AST:M,STRONG_UND:Q,TABLE:z,TABLE_CELL:V,TABLE_ROW:J,default_renderer:_e,parser:ae,parser_end:ce,parser_write:o}})();