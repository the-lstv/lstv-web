let bgaSpeedFactor = .001, cloudsCanvas = O("#glCanvas"), raysCanvas = O("#raysBga"), noiseCanvas = O("#noiseBga"), cloudsRenderer, raysRenderer, noiseRenderer;

app.module("static.home", (app, page, container) => {
    page.title = "Home";
    page.requiresReload = true;

    let initialLoadApps = false, appsBottom = Infinity, appsOffset = 0, appsAtBottom = false, cursorPopout = container.get("#cursorPopout");

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
        },

        allTags = new Set
    ;

    let lastScroll = 0;
    // const svgElement = document.querySelector('.appShowcaseBackground svg');

    console.log(container.parentElement);
    

    container.parentElement.on("scroll", () => {
        let scroll = container.parentElement.scrollTop;

        window.requestAnimationFrame(() => {
            container.style.maxWidth = (1360 + scroll) + "px"
            // svgElement.style.transform = `translateY(${(scroll - 1000) / 2}px) scale(${(scroll + 1000) / 2000}) rotate(${(scroll - 2500) / 100}deg)`;
        })

        if (Math.abs(scroll - lastScroll) > 10) {
            container.get("#chevron").class("visible", scroll < 60)

            if(!initialLoadApps && scroll > 600) {
                initialLoadApps = true
                loadApps()
            }

            if(cloudsCanvas.isInView()){
                cloudsRenderer.resume()
            } else cloudsRenderer.paused = true;

            if(raysCanvas.isInView()){
                raysRenderer.resume()
            } else raysRenderer.paused = true;

            lastScroll = scroll;
        }

        // if(!appsAtBottom && scroll > (container.parentElement.scrollHeight - innerHeight - 100)) {
        //     appsOffset++
        //     loadApps()
        // }
    })

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
        list = await app.get(`${app.api}/v2/apps/list/home?limit=${limit}&offset=${offset}`).json()

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

    // Vertex shaders for both new and older shaders
    const gl2_vertex = `#version 300 es\nprecision mediump float; in vec4 a_position; void main() { gl_Position = a_position; }`;
    const gl_vertex = `attribute vec4 a_position;\nvoid main() { gl_Position = a_position; }`;

    cloudsRenderer = new CombinedShaderRenderer(cloudsCanvas);
    const clouds_shader_source = cloudsRenderer.compileShader(gl_vertex, `#ifdef GL_ES\nprecision mediump float;\n#endif\nuniform vec2 u_resolution,u_mouse;uniform vec4 u_colors[2];uniform float u_speed,u_time,u_scale,light,shadow,tint,coverage,alpha;const mat2 m=mat2(1.6,1.2,-1.2,1.6);vec2 hash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return-1.+2.*fract(sin(p)*43758.5453123);}float noise(vec2 p){vec2 i=floor(p+(p.x+p.y)*.366025404),a=p-i+(i.x+i.y)*.211324865,o=a.x>a.y?vec2(1,0):vec2(0,1),b=a-o+.211324865,c=a-1.+.42264973;vec3 h=max(.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.);return dot(h*h*h*h*vec3(dot(a,hash(i)),dot(b,hash(i+o)),dot(c,hash(i+1.))),vec3(70));}float fbm(vec2 n){float total=0.,amplitude=.1;for(int i=0;i<7;i++)total+=noise(n)*amplitude,n=m*n,amplitude*=.4;return total;}void main(){vec2 p=gl_FragCoord.xy/u_resolution.xy,uv=p*vec2(u_resolution.x/u_resolution.y,1);float speed=u_speed*.1,time=u_time*speed,scale=1.-u_scale,q=fbm(uv*scale*.5),r=0.;uv=uv*scale-q+time;float weight=.8;for(int i=0;i<8;i++)r+=abs(weight*noise(uv)),uv=m*uv+time,weight*=.7;float f=0.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*scale-q+time;weight=.7;for(int i=0;i<8;i++)f+=weight*noise(uv),uv=m*uv+time,weight*=.6;f*=r+f;float c=0.;time=u_time*speed*2.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*(scale*2.)-q+time;weight=.4;for(int i=0;i<7;i++)c+=weight*noise(uv),uv=m*uv+time,weight*=.6;float c1=0.;time=u_time*speed*3.;uv=p*vec2(u_resolution.x/u_resolution.y,1)*(scale*3.)-q+time;weight=.4;for(int i=0;i<7;i++)c1+=abs(weight*noise(uv)),uv=m*uv+time,weight*=.6;c+=c1;vec4 skycolour=mix(u_colors[1],u_colors[0],p.y),cloudcolour=vec4(1)*clamp(1.-shadow+light*c,0.,1.);f=coverage+20.*alpha*f*r;cloudcolour=mix(skycolour,clamp(tint*skycolour+cloudcolour,0.,1.),clamp(f+c,0.,1.));gl_FragColor=cloudcolour;}`);

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

    raysRenderer = new CombinedShaderRenderer(raysCanvas);
    const rays_shader_source = raysRenderer.compileShader(gl_vertex, `precision highp float;\nuniform vec2 u_resolution;\nuniform vec2 u_mouse;\nuniform float u_time;\nuniform vec4 u_colors[4];\nuniform float u_blur;\nuniform bool u_animate;\nuniform float u_animate_speed;\nuniform float u_frequency;\n#define S(a,b,t) smoothstep(a,b,t)\n#ifndef SRGB_EPSILON\n#define SRGB_EPSILON 0.00000001\n#endif\n#ifndef FNC_SRGB2RGB\n#define FNC_SRGB2RGB\nfloat srgb2rgb(float channel) {\nreturn (channel < 0.04045) ? channel * 0.0773993808 : pow((channel + 0.055) * 0.947867298578199,2.4);\n}\nvec3 srgb2rgb(vec3 srgb) {\nreturn vec3(srgb2rgb(srgb.r + SRGB_EPSILON),\nsrgb2rgb(srgb.g + SRGB_EPSILON),srgb2rgb(srgb.b + SRGB_EPSILON));\n}\nvec4 srgb2rgb(vec4 srgb) {\nreturn vec4(srgb2rgb(srgb.rgb),srgb.a);\n}\n#endif\n#if !defined(FNC_SATURATE) && !defined(saturate)\n#define FNC_SATURATE\n#define saturate(x) clamp(x,0.0,1.0)\n#endif\n#ifndef SRGB_EPSILON \n#define SRGB_EPSILON 0.00000001\n#endif\n#ifndef FNC_RGB2SRGB\n#define FNC_RGB2SRGB\nfloat rgb2srgb(float channel) {\nreturn (channel < 0.0031308) ? channel * 12.92 : 1.055 * pow(channel,0.4166666666666667) - 0.055;\n}\nvec3 rgb2srgb(vec3 rgb) {\nreturn saturate(vec3(rgb2srgb(rgb.r - SRGB_EPSILON),rgb2srgb(rgb.g - SRGB_EPSILON),rgb2srgb(rgb.b - SRGB_EPSILON)));\n}\nvec4 rgb2srgb(vec4 rgb) {\nreturn vec4(rgb2srgb(rgb.rgb),rgb.a);\n}\n#endif\n#ifndef FNC_MIXOKLAB\n#define FNC_MIXOKLAB\nvec3 mixOklab( vec3 colA,vec3 colB,float h ) {\n#ifdef MIXOKLAB_COLORSPACE_SRGB\ncolA = srgb2rgb(colA);\ncolB = srgb2rgb(colB);\n#endif\nconst mat3 kCONEtoLMS = mat3(\n0.4121656120,0.2118591070,0.0883097947,\n0.5362752080,0.6807189584,0.2818474174,\n0.0514575653,0.1074065790,0.6302613616);\nconst mat3 kLMStoCONE = mat3(\n4.0767245293,-1.2681437731,-0.0041119885,\n-3.3072168827,2.6093323231,-0.7034763098,\n0.2307590544,-0.3411344290,1.7068625689);\nvec3 lmsA = pow( kCONEtoLMS * colA,vec3(1.0/3.0) );\nvec3 lmsB = pow( kCONEtoLMS * colB,vec3(1.0/3.0) );\nvec3 lms = mix( lmsA,lmsB,h );\nvec3 rgb = kLMStoCONE*(lms*lms*lms);\n#ifdef MIXOKLAB_COLORSPACE_SRGB\nreturn rgb2srgb(rgb);\n#else\nreturn rgb;\n#endif\n}\nvec4 mixOklab( vec4 colA,vec4 colB,float h ) {\nreturn vec4( mixOklab(colA.rgb,colB.rgb,h),mix(colA.a,colB.a,h) );\n}\n#endif\nmat2 Rot(float a)\n{\nfloat s = sin(a);\nfloat c = cos(a);\nreturn mat2(c,-s,s,c);\n}\n// Created by inigo quilez - iq/2014\n// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\nvec2 hash( vec2 p )\n{\np = vec2( dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)) );\n\treturn fract(sin(p)*43758.5453);\n}\nfloat noise( in vec2 p )\n{\nvec2 i = floor( p );\nvec2 f = fract( p );\n\t\n\tvec2 u = f*f*(3.0-2.0*f);\nfloat n = mix( mix( dot( -1.0+2.0*hash( i + vec2(0.0,0.0) ),f - vec2(0.0,0.0) ),\ndot( -1.0+2.0*hash( i + vec2(1.0,0.0) ),f - vec2(1.0,0.0) ),u.x),\nmix( dot( -1.0+2.0*hash( i + vec2(0.0,1.0) ),f - vec2(0.0,1.0) ),\ndot( -1.0+2.0*hash( i + vec2(1.0,1.0) ),f - vec2(1.0,1.0) ),u.x),u.y);\n\treturn 0.5 + 0.5*n;\n}\nvoid main(){\n\nvec2 uv = gl_FragCoord.xy/u_resolution.xy;\nfloat ratio = u_resolution.x / u_resolution.y;\nvec2 tuv = uv;\ntuv -= .5;\n\n\nfloat speed = u_time * 10. * u_animate_speed;\nif(u_animate == false){\nspeed = 0.0;\n}\nfloat degree = noise(vec2(speed/100.0,tuv.x*tuv.y));\ntuv.y *= 1./ratio;\ntuv *= Rot(radians((degree-.5)*720.+180.));\ntuv.y *= ratio;\n// Wave warp with sin\nfloat frequency = 20. * u_frequency;\nfloat amplitude = 30. * (10.*(0.01+u_blur));\n\ntuv.x += sin(tuv.y*frequency+speed)/amplitude;\n\ttuv.y += sin(tuv.x*frequency*1.5+speed)/(amplitude*.5);\nvec4 layer1 = mixOklab(u_colors[0],u_colors[1],S(-.3,.2,(tuv*Rot(radians(-5.))).x));\nvec4 layer2 = mixOklab(u_colors[2],u_colors[3],S(-.3,.2,(tuv*Rot(radians(-5.))).x));\nvec4 finalComp = mixOklab(layer1,layer2,S(.5,-.3,tuv.y));\ngl_FragColor = finalComp;\n}\n`);

    raysRenderer.addShaderContext(rays_shader_source, {
        u_time: { type: "uniform1f", value: time => [(time * bgaSpeedFactor) + 1000] },
        u_resolution: { type: "uniform2f", value: () => [cloudsCanvas.width, cloudsCanvas.height] },
        u_speed: { type: "uniform1f", value: [0.196] },
        u_scale: { type: "uniform1f", value: [4] },
        u_colors: { type: "uniform4fv", value: [[0.25098039215686274,0.7529411764705882,0.9058823529411765,1,0.9882352941176471,0.7607843137254902,0.10588235294117647,1,0.9294117647058824,0.4235294117647059,0.18823529411764706,1,0,0,0,0]] },
        u_blur: { type: "uniform1f", value: [1] },
        u_animate: { type: "uniform1f", value: [1] },
        u_animate_speed: { type: "uniform1f", value: [1] },
        u_frequency: { type: "uniform1f", value: [0] },
    })


    noiseRenderer = new CombinedShaderRenderer(noiseCanvas);
    const noise_shader_source = noiseRenderer.compileShader(gl2_vertex, `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;

vec3 h(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.0+2.0*fract(sin(p)*43758.5453123);}

float n(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(mix(dot(h(i+vec3(0)),f-vec3(0)),dot(h(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(h(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(h(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),mix(mix(dot(h(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(h(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(h(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(h(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}

void main(){vec2 uv=gl_FragCoord.xy/iResolution.xy;uv=uv*2.0-1.0;uv.x*=iResolution.x/iResolution.y;vec3 d=normalize(vec3(uv,1.0));float s=pow(clamp(n(d*1000.0),0.0,1.0),10.0)*500.0;s*=mix(0.4,1.4,n(d*100.0+vec3(iTime)));fragColor=vec4(vec3(1.0),clamp(s,0.0,0.15));}
`);

    noiseRenderer.addShaderContext(noise_shader_source, { iTime: { type: "uniform1f", value: a => [a / 1450] }, iResolution: { type: "uniform2f", value: () => [noiseCanvas.width, noiseCanvas.height] } })

    noiseRenderer.resume()

    raysRenderer.resume()
});