const year = new Date().getFullYear();

const about = LS.Reactive.wrap("about", {
    coding_years: year - 2016,
    design_years: year - 2021,
    music_years: year - 2023,
    age: year - 2007,
    name: "Lukáš",
    name_alt: "Lukas",
    location: "Czech Republic",
    github: "https://github.com/the-lstv"
});


app.module(document.currentScript, (app, page, container) => {
    let bgaSpeedFactor = .001, cloudsCanvas = O("#glCanvas"), raysCanvas = O("#raysBga"), cloudsRenderer, blurRenderer, noiseRenderer;

    page.title = "Home";
    page.requiresReload = true;

    let initialLoadApps = false, appsOffset = 0, appsAtBottom = false, cursorPopout = container.get("#cursorPopout");

    let customOrder = [2, 3, 4, 5, 10, 1, 8, 9, 7, 31, 11, 6],
        customBackOrder = [36, 27, 28, 29, 15, 26],
        customGroups = [
            [13, 19, 14]
        ],

        customColor = {
            7: ["#fff", "#eee", "#222"],
            16: ["#fff", "#eee", "#222"],
            13: ["#155676", "#030405", "#8fd2ff"],
            22: ["#ffffff", "#fbb8ff", "#320c35"],
            23: [null, null, "#fff"],
            42: ["#65243b", "#000"],
            28: [null, null, "#fff"],
            5: "#004ba6",
            10: "#0a0822",
            1: "#07436d",
            8: ["#ffe50e", "#c77c00", "#222"]
        }
    ;

    let appsPageSize = 100;

    function customSort(arr) {
        // Create a map for quick lookup of customOrder positions
        const customOrderMap = new Map(customOrder.map((id, index) => [id, index]));
        
        // Sort function
        arr.sort((a, b) => {
            // First, handle customBackOrder by placing those IDs at the end
            const aInBackOrder = customBackOrder.indexOf(a.id) !== -1;
            const bInBackOrder = customBackOrder.indexOf(b.id) !== -1;
            
            if (aInBackOrder && !bInBackOrder) return 1;
            if (!aInBackOrder && bInBackOrder) return -1;
            if (aInBackOrder && bInBackOrder) return customBackOrder.indexOf(a.id) - customBackOrder.indexOf(b.id);
            
            // Then, handle customOrder
            const aOrder = customOrderMap.has(a.id) ? customOrderMap.get(a.id) : customOrder.length;
            const bOrder = customOrderMap.has(b.id) ? customOrderMap.get(b.id) : customOrder.length;
            
            if (aOrder !== bOrder) return aOrder - bOrder;
            
            // Finally, handle customGroups
            for (let group of customGroups) {
                const aInGroup = group.findIndex(item => item === a.id);
                const bInGroup = group.findIndex(item => item === b.id);
                
                if (aInGroup !== -1 && bInGroup !== -1) {
                    return aInGroup - bInGroup;
                }
                if (aInGroup !== -1) return -1;
                if (bInGroup !== -1) return 1;
            }
            
            // Fallback to natural order by ID if none of the above applied
            return a.id - b.id;
        });
    }

    let types = ["Application", "Application", "Game", "Service", "Authentication", "Utility", "Website", "Finance"], list, elements = {};

    async function loadApps(limit = appsPageSize, offset = (appsOffset * appsPageSize)) {
        list = await app.auth.fetch(`${app.api}/v2/apps/list/home?limit=${limit}&offset=${offset}`).json()

        if(list.length < limit) appsAtBottom = true;

        customSort(list)

        drawApps()
    }

    function drawApps(filter){
        for(let item of list){

            if(typeof filter === "function" && !filter(item)) {
                if(elements[item.id]) elements[item.id].hide();
                continue
            }

            if(elements[item.id]) {
                elements[item.id].show()
                continue
            }

            if(item.tags) item.tags = item.tags.split(",");

            let element = elements[item.id] = N({
                accent: item.accent,
                inner: [
                    N({
                        class: "appTop",
                        inner: N("span", {
                            innerText: item.displayname//types[item.type]
                        })
                    }),

                    // .darken(16)
                    // .saturation(80)
                    // .substract(20, 20, 20)

                    N({
                        class: "appBody",
                        inner: [
                            item.icon? N({class: "appIconContainer", inner: N("img", {crossOrigin: "Anonymous", loading: "lazy", src: app.cdn + "/file/" + item.icon + (item.icon.endsWith("svg")? "": "?size=120"), onload(){
                                let override = typeof customColor[item.id] == "string"? [C(customColor[item.id])]: Array.isArray(customColor[item.id])? customColor[item.id].map(color => typeof color == "string"? C(color) : null) : [];
                                
                                let color = override[0] || LS.Color.fromImage(this);

                                element.appColor = color.rgb;
                                element.style.setProperty("--color-1", (override[1] || color.saturation(80).darken(15)).rgb)
                                element.style.setProperty("--color-2", element.appColor)
                                
                                let isDark = color.isDark;

                                element.fgColor = (override[2] || (isDark? color.lighten(60).saturation(80): color.darken(20).saturation(50))).rgb;
                                element.style.setProperty("--color-fg", element.fgColor)
                                element.style.setProperty("--color-fg-light", color.lighten(60).saturation(25).rgb)

                                element.class(isDark? "appItemDark" : "appItemLight")
                            }})}): "",

                            item.icon? N("br"): "",
    
                            // N("span", {innerText: item.displayname, class: "appName"}),
                            N({innerText: item.description, class: "appDescription"}),
                        ]
                    }),

                    item.tags? N({
                        class: "appBottom",
                        inner: item.tags.map(tag => N("ls-box", {innerText: tag.toUpperCase(), class: "inline appTag"}))
                    }): "",
                ],

                class: "appItem",

                onmouseenter(event){
                    updatePopout(event.clientX, event.clientY)
                    cursorPopout.style.setProperty("--accent", element.appColor || "#444")
                    cursorPopout.style.setProperty("--color", element.fgColor || "#fff")
                    cursorPopout.class("active")
                },

                onmousemove(event){
                    updatePopout(event.clientX, event.clientY)
                },
                
                onmouseleave(){
                    cursorPopout.class("active", 0)
                }
            });

            function updatePopout(x, y){
                cursorPopout.style.left = x + "px"
                cursorPopout.style.top = y + "px"
            }

            O("#apps-showcase").add(element)
        }
    }

    function fuzz(string){
        return string.toLowerCase().trim().replace(/[\s\n\t\r:|_]/g, "")
    }

    O("#searchInput").on("input", () => {
        let value = fuzz(O("#searchInput").value);

        drawApps(item => {
            return fuzz(item.name).includes(value) || fuzz(item.description).includes(value);
        })
    })

    setTimeout(() => {
        let lastScroll = 0;

        const onScroll = () => {
            let scroll = container.parentElement.scrollTop;
    
            window.requestAnimationFrame(() => {
                container.style.maxWidth = Math.min(1360 + scroll, 1920) + "px"
                // svgElement.style.transform = `translateY(${(scroll - 1000) / 2}px) scale(${(scroll + 1000) / 2000}) rotate(${(scroll - 2500) / 100}deg)`;
            })
    
            if (Math.abs(scroll - lastScroll) > 10) {
                container.get("#chevron").class("visible", scroll < 60)
    
                if(!initialLoadApps && scroll > 600) {
                    initialLoadApps = true
                    loadApps()
                }
    
                if(cloudsCanvas.isInView()){
                    cloudsRenderer.resume();
                } else cloudsRenderer.paused = true;
    
                if(raysCanvas.isInView()){
                    blurRenderer.resume();
                } else blurRenderer.paused = true;
    
                lastScroll = scroll;
            }
        }

        cloudsRenderer = new CombinedShaderRenderer(cloudsCanvas);
        const clouds_shader_source = cloudsRenderer.compileShader(ShaderSource.gl_vertex, `#ifdef GL_ES\nprecision mediump float;\n#endif\nuniform vec2 u_resolution,u_mouse;uniform vec4 u_colors[2];uniform float u_speed,u_time,u_scale,light,shadow,tint,coverage,alpha;const mat2 m=mat2(1.6,1.2,-1.2,1.6);vec2 hash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return-1.+2.*fract(sin(p)*43758.5453123);}float noise(vec2 p){vec2 i=floor(p+(p.x+p.y)*.366025404),a=p-i+(i.x+i.y)*.211324865,o=a.x>a.y?vec2(1,0):vec2(0,1),b=a-o+.211324865,c=a-1.+.42264973;vec3 h=max(.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.);return dot(h*h*h*h*vec3(dot(a,hash(i)),dot(b,hash(i+o)),dot(c,hash(i+1.))),vec3(70));}float fbm(vec2 n){float total=0.,amplitude=.1;for(int i=0;i<7;i++)total+=noise(n)*amplitude,n=m*n,amplitude*=.4;return total;}void main(){vec2 p=gl_FragCoord.xy/u_resolution.xy,uv=p*vec2(u_resolution.x/u_resolution.y,1);float speed=u_speed*.1,time=u_time*speed,scale=1.-u_scale,q=fbm(uv*scale*.5),r=0.;uv=uv*scale-q+time;float weight=.8;for(int i=0;i<8;i++)r+=abs(weight*noise(uv)),uv=m*uv+time,weight*=.7;float f=0.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*scale-q+time;weight=.7;for(int i=0;i<8;i++)f+=weight*noise(uv),uv=m*uv+time,weight*=.6;f*=r+f;float c=0.;time=u_time*speed*2.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*(scale*2.)-q+time;weight=.4;for(int i=0;i<7;i++)c+=weight*noise(uv),uv=m*uv+time,weight*=.6;float c1=0.;time=u_time*speed*3.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*(scale*3.)-q+time;weight=.4;for(int i=0;i<7;i++)c1+=abs(weight*noise(uv)),uv=m*uv+time,weight*=.6;c+=c1;vec4 skycolour=mix(u_colors[1],u_colors[0],p.y),cloudcolour=vec4(1)*clamp(1.-shadow+light*c,0.,1.);f=coverage+20.*alpha*f*r;cloudcolour=mix(skycolour,clamp(tint*skycolour+cloudcolour,0.,1.),clamp(f+c,0.,1.));gl_FragColor=cloudcolour;}`);

        cloudsRenderer.addShaderContext(clouds_shader_source, {
            u_time: { type: "uniform1f", value: time => [time * bgaSpeedFactor] },
            u_resolution: { type: "uniform2f", value: () => [cloudsCanvas.width, cloudsCanvas.height] },
            u_speed: { type: "uniform1f", value: [0.196] },
            u_scale: { type: "uniform1f", value: [0] },
            u_colors: { type: "uniform4fv", value: [[1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0]] },
            light: { type: "uniform1f", value: [0.5] },
            shadow: { type: "uniform1f", value: [0.5] },
            tint: { type: "uniform1f", value: [0.5] },
            coverage: { type: "uniform1f", value: [0.3] },
            alpha: { type: "uniform1f", value: [1.0] },
        })

        blurRenderer = new CombinedShaderRenderer(raysCanvas);

        blurRenderer.addShaderContext(ShaderSource.blurredColors(blurRenderer.gl), {
            u_time: { type: "uniform1f", value: time => [(time * bgaSpeedFactor) + 1000] },
            u_resolution: { type: "uniform2f", value: () => [cloudsCanvas.width, cloudsCanvas.height] },
            u_speed: { type: "uniform1f", value: [0.196] },
            u_scale: { type: "uniform1f", value: [4] },
            u_colors: { type: "uniform4fv", value: [[0.25098039215686274,0.7529411764705882,0.9058823529411765,1,0.9882352941176471,0.7607843137254902,0.10588235294117647,1,0.9294117647058824,0.4235294117647059,0.18823529411764706,1,0,0,0,0]] },
            u_blur: { type: "uniform1f", value: [1] },
            u_animate: { type: "uniform1f", value: [1] },
            u_animate_speed: { type: "uniform1f", value: [1] },
            u_frequency: { type: "uniform1f", value: [0] },
            alpha: { type: "uniform1f", value: [1] },
        })

        blurRenderer.resume();

        onScroll();
        container.classList.add("vfx-loaded");

        container.parentElement.addEventListener("scroll", onScroll);
    }, 50);
});