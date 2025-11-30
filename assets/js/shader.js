class ShaderContext {
    constructor(gl, source) {
        this.gl = gl;
        this.source = source
        this.program = this.createProgram()
        this.uniformLocations = {};
    }

    createProgram() {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, this.source.vertexShader);
        this.gl.attachShader(program, this.source.fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    getUniformLocation(name) {
        if (!(name in this.uniformLocations)) {
            this.uniformLocations[name] = this.gl.getUniformLocation(this.program, name);
        }
        return this.uniformLocations[name];
    }
}

class CombinedShaderRenderer {
    constructor(canvas, dimensions = { width: 1024, height: 1024 }) {
        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            // premultipliedAlpha: false,
            // antialias: true,
        });

        if (!this.gl) {
            console.error('WebGL2 not supported');
            return;
        }

        this.canvas = canvas;
        this.shaders = [];
        this.uniforms = [];

        this.width = dimensions.width;
        this.height = dimensions.height;
        this.qualityReduction = 1;
        this.animating = false;
        this.paused = true;

        // FPS tracking
        this.fpsEnabled = false;
        this.fpsCallback = null;
        this.fpsFrameTimes = [];
        this.fpsLastReportTime = 0;
        this.fpsReportInterval = 500; // Report FPS every 500ms

        canvas.width = this.width;
        canvas.height = this.height;

        this.setupBuffers();
        this.frame = this.render.bind(this);
    }

    compileShader(vertexShader, fragmentShader){
        return new ShaderSource(this.gl, vertexShader, fragmentShader)
    }

    addShaderContext(source, uniforms){
        this.shaders.push(new ShaderContext(this.gl, source))
        this.uniforms.push(uniforms || {});
    }

    setupBuffers() {
        const gl = this.gl;

        // Fullscreen quad
        const vertices = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    render(time) {
        if (this.paused) {
            this.animating = false;
            return;
        }

        // FPS tracking
        if (this.fpsEnabled) {
            this.fpsFrameTimes.push(time);
            // Keep only last 60 frame times
            if (this.fpsFrameTimes.length > 60) {
                this.fpsFrameTimes.shift();
            }
            
            // Report FPS at interval
            if (time - this.fpsLastReportTime >= this.fpsReportInterval) {
                const fps = this.calculateFPS();
                if (this.fpsCallback) {
                    this.fpsCallback(fps);
                }
                this.fpsLastReportTime = time;
            }
        }

        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        // gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);


        this.shaders.forEach((shaderContext, index) => {
            const uniforms = this.uniforms[index];
            gl.useProgram(shaderContext.program);

            // Bind position buffer
            const positionLocation = gl.getAttribLocation(shaderContext.program, 'a_position');
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            // Set uniforms
            for (const [name, { type, value }] of Object.entries(uniforms)) {
                const location = shaderContext.getUniformLocation(name);
                const uniformValue = typeof value === 'function' ? value(time) : value;
                gl[type](location, ...uniformValue);
            }

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });

        requestAnimationFrame(this.frame);
    }

    calculateFPS() {
        if (this.fpsFrameTimes.length < 2) return 0;
        
        const timeSpan = this.fpsFrameTimes[this.fpsFrameTimes.length - 1] - this.fpsFrameTimes[0];
        const frameCount = this.fpsFrameTimes.length - 1;
        
        if (timeSpan === 0) return 0;
        
        return Math.round((frameCount / timeSpan) * 1000);
    }

    watchFPS(callback, reportInterval = 500) {
        this.fpsEnabled = true;
        this.fpsCallback = callback;
        this.fpsReportInterval = reportInterval;
        this.fpsFrameTimes = [];
        this.fpsLastReportTime = 0;
    }

    unwatchFPS() {
        this.fpsEnabled = false;
        this.fpsCallback = null;
        this.fpsFrameTimes = [];
    }

    resize(width = this.width, height = this.height) {
        this.width = Math.max(128, width) - (64 * this.qualityReduction);
        this.height = Math.max(128, height) - (64 * this.qualityReduction);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    resume() {
        if (!this.paused || this.animating) return;
        this.paused = false;
        this.animating = true;
        requestAnimationFrame(this.frame);
    }

    pause() {
        this.paused = true;
    }

    destroy() {
        // Stop animation
        this.pause();
        this.animating = false;

        const gl = this.gl;
        if (!gl) return;

        // Delete position buffer
        if (this.positionBuffer) {
            gl.deleteBuffer(this.positionBuffer);
            this.positionBuffer = null;
        }

        // Delete shaders and programs
        this.shaders.forEach((shaderContext) => {
            if (shaderContext.program) {
                // Detach and delete shaders
                if (shaderContext.source.vertexShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.vertexShader);
                    gl.deleteShader(shaderContext.source.vertexShader);
                }
                if (shaderContext.source.fragmentShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.fragmentShader);
                    gl.deleteShader(shaderContext.source.fragmentShader);
                }
                gl.deleteProgram(shaderContext.program);
            }
        });

        // Clear arrays
        this.shaders = [];
        this.uniforms = [];

        // Clear FPS tracking
        this.unwatchFPS();
    }
}

class ShaderSource {
    constructor(gl, vertexShaderSource, fragmentShaderSource) {
        this.gl = gl;
        this.vertexShader = this.compileShader(vertexShaderSource, gl.VERTEX_SHADER);
        this.fragmentShader = this.compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    static gl2_vertex = `#version 300 es\nprecision mediump float; in vec4 a_position; void main() { gl_Position = a_position; }`;
    static gl_vertex  = `attribute vec4 a_position;\nvoid main() { gl_Position = a_position; }`;

    // Shader presets

    static animatedNoise(gl) {
        return new ShaderSource(gl, ShaderSource.gl2_vertex, `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform float Alpha;
uniform float Amount;

vec3 h(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.0+2.0*fract(sin(p)*43758.5453123);}
float n(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(mix(dot(h(i+vec3(0)),f-vec3(0)),dot(h(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(h(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(h(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),mix(mix(dot(h(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(h(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(h(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(h(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
void main(){vec2 uv=gl_FragCoord.xy/iResolution.xy;uv=uv*2.0-1.0;uv.x*=iResolution.x/iResolution.y;vec3 d=normalize(vec3(uv,1.0));float s=pow(clamp(n(d*1000.0),0.0,1.0),10.0)*Amount;s*=mix(0.4,1.4,n(d*100.0+vec3(iTime)));fragColor=vec4(vec3(1.0),clamp(s,0.0,Alpha));}
`);
    }

    static clouds(gl) {
        return new ShaderSource(gl, ShaderSource.gl_vertex, `#ifdef GL_ES
precision mediump float;
#endif
uniform vec2 u_resolution,u_mouse;
uniform vec4 u_colors[2];
uniform float u_speed,u_time,u_scale,light,shadow,tint,coverage,alpha,u_quality;
const mat2 m=mat2(1.6,1.2,-1.2,1.6);
vec2 hash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return-1.+2.*fract(sin(p)*43758.5453123);}
float noise(vec2 p){const float K1=.366025404,K2=.211324865;vec2 i=floor(p+(p.x+p.y)*K1),a=p-i+(i.x+i.y)*K2,o=step(a.yx,a.xy),b=a-o+K2,c=a-1.+2.*K2;vec3 h=max(.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.),n=h*h*h*h*vec3(dot(a,hash(i)),dot(b,hash(i+o)),dot(c,hash(i+1.)));return dot(n,vec3(70.));}
float fbm(vec2 n){float t=0.,a=.1;int it=int(mix(4.,7.,u_quality));for(int i=0;i<7;i++){if(i>=it)break;t+=noise(n)*a;n=m*n;a*=.4;}return t;}
void main(){vec2 p=gl_FragCoord.xy/u_resolution.xy,uv=p*vec2(u_resolution.x/u_resolution.y,1.);float s=u_speed*.1,t=u_time*s,sc=1.-u_scale,q=fbm(uv*sc*.5);vec2 bu=uv*sc-q;int it1=int(mix(5.,8.,u_quality));float r=0.,w=.8;vec2 u1=bu+t;for(int i=0;i<8;i++){if(i>=it1)break;r+=abs(w*noise(u1));u1=m*u1+t;w*=.7;}int it2=int(mix(5.,8.,u_quality));float f=0.;w=.7;vec2 u2=bu+t;for(int i=0;i<8;i++){if(i>=it2)break;f+=w*noise(u2);u2=m*u2+t;w*=.6;}f*=r+f;int it3=int(mix(4.,7.,u_quality));float c=0.;w=.4;vec2 u3=uv*vec2(u_resolution.x/u_resolution.y,1.)*sc*2.-q+t*2.;for(int i=0;i<7;i++){if(i>=it3)break;c+=w*noise(u3);u3=m*u3+t*2.;w*=.6;}int it4=int(mix(4.,7.,u_quality));float c1=0.;w=.4;vec2 u4=uv*vec2(u_resolution.x/u_resolution.y,1.)*sc*3.-q+t*3.;for(int i=0;i<7;i++){if(i>=it4)break;c1+=abs(w*noise(u4));u4=m*u4+t*3.;w*=.6;}c+=c1;vec4 sky=mix(u_colors[1],u_colors[0],p.y),cld=vec4(1.)*clamp(1.-shadow+light*c,0.,1.);f=coverage+20.*alpha*f*r;gl_FragColor=mix(sky,clamp(tint*sky+cld,0.,1.),clamp(f+c,0.,1.));}`);
    }

    static blurredColors(gl) {
        return new ShaderSource(gl, ShaderSource.gl_vertex, `precision highp float;uniform vec2 u_resolution;uniform vec2 u_mouse;uniform float u_time;uniform float alpha;uniform vec4 u_colors[4];uniform float u_blur;uniform bool u_animate;uniform float u_animate_speed;uniform float u_frequency;
#define S(a,b,t) smoothstep(a,b,t)
#ifndef SRGB_EPSILON
#define SRGB_EPSILON 0.00000001
#endif
#ifndef FNC_SRGB2RGB
#define FNC_SRGB2RGB
float srgb2rgb(float channel){return(channel<0.04045)?channel*0.0773993808:pow((channel+0.055)*0.947867298578199,2.4);}
vec3 srgb2rgb(vec3 srgb){return vec3(srgb2rgb(srgb.r+SRGB_EPSILON),srgb2rgb(srgb.g+SRGB_EPSILON),srgb2rgb(srgb.b+SRGB_EPSILON));}
vec4 srgb2rgb(vec4 srgb){return vec4(srgb2rgb(srgb.rgb),srgb.a);}
#endif
#if !defined(FNC_SATURATE)&&!defined(saturate)
#define FNC_SATURATE
#define saturate(x) clamp(x,0.0,1.0)
#endif
#ifndef SRGB_EPSILON
#define SRGB_EPSILON 0.00000001
#endif
#ifndef FNC_RGB2SRGB
#define FNC_RGB2SRGB
float rgb2srgb(float channel){return(channel<0.0031308)?channel*12.92:1.055*pow(channel,0.4166666666666667)-0.055;}
vec3 rgb2srgb(vec3 rgb){return saturate(vec3(rgb2srgb(rgb.r-SRGB_EPSILON),rgb2srgb(rgb.g-SRGB_EPSILON),rgb2srgb(rgb.b-SRGB_EPSILON)));}
vec4 rgb2srgb(vec4 rgb){return vec4(rgb2srgb(rgb.rgb),rgb.a);}
#endif
#ifndef FNC_MIXOKLAB
#define FNC_MIXOKLAB
vec3 mixOklab(vec3 colA,vec3 colB,float h){
#ifdef MIXOKLAB_COLORSPACE_SRGB
colA=srgb2rgb(colA);colB=srgb2rgb(colB);
#endif
const mat3 kCONEtoLMS=mat3(0.4121656120,0.2118591070,0.0883097947,0.5362752080,0.6807189584,0.2818474174,0.0514575653,0.1074065790,0.6302613616);
const mat3 kLMStoCONE=mat3(4.0767245293,-1.2681437731,-0.0041119885,-3.3072168827,2.6093323231,-0.7034763098,0.2307590544,-0.3411344290,1.7068625689);
vec3 lmsA=pow(kCONEtoLMS*colA,vec3(1.0/3.0));vec3 lmsB=pow(kCONEtoLMS*colB,vec3(1.0/3.0));
vec3 lms=mix(lmsA,lmsB,h);vec3 rgb=kLMStoCONE*(lms*lms*lms);
#ifdef MIXOKLAB_COLORSPACE_SRGB
return rgb2srgb(rgb);
#else
return rgb;
#endif
}
vec4 mixOklab(vec4 colA,vec4 colB,float h){return vec4(mixOklab(colA.rgb,colB.rgb,h),mix(colA.a,colB.a,h));}
#endif
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
// Created by inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void main(){
vec2 uv=gl_FragCoord.xy/u_resolution.xy;float ratio=u_resolution.x/u_resolution.y;vec2 tuv=uv;tuv-=.5;float speed=u_time*10.*u_animate_speed;if(u_animate==false){speed=0.0;}
float degree=noise(vec2(speed/100.0,tuv.x*tuv.y));tuv.y*=1./ratio;tuv*=Rot(radians((degree-.5)*720.+180.));tuv.y*=ratio;float frequency=20.*u_frequency;float amplitude=30.*(10.*(0.01+u_blur));
tuv.x+=sin(tuv.y*frequency+speed)/amplitude;tuv.y+=sin(tuv.x*frequency*1.5+speed)/(amplitude*.5);
vec4 layer1=mixOklab(u_colors[0],u_colors[1],S(-.3,.2,(tuv*Rot(radians(-5.))).x)),layer2=mixOklab(u_colors[2],u_colors[3],S(-.3,.2,(tuv*Rot(radians(-5.))).x));
vec4 finalComp=mixOklab(layer1,layer2,S(.5,-.3,tuv.y));gl_FragColor=vec4(finalComp.rgb, finalComp.a * alpha);}`);
    }

    static sparkles(gl) {
        return new ShaderSource(gl, `attribute vec2 a_position;varying vec2 vUV;void main(){vUV=(a_position+1.0)/2.0;gl_Position=vec4(a_position,0.0,1.0);}`,`
precision mediump float;varying vec2 vUV;uniform vec2 resolution;uniform float time;uniform vec4 areaBounds;uniform float areaFeather;uniform float areaInvert;
vec2 hash22(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(vec2(p.x*p.y,p.x+p.y));}
vec2 randomDir(vec2 r){vec2 d=r-0.5;float l=length(d);return l<0.001?vec2(0.0,1.0):d/l;}
float densityMap(vec2 u,float t){float w1=sin(u.x*3.0+t*0.5)*0.5+0.5;float w2=sin(u.y*4.0-t*0.3)*0.5+0.5;vec2 c1=vec2(0.5+sin(t*0.4)*0.3,0.5+cos(t*0.3)*0.3);vec2 c2=vec2(0.5-sin(t*0.5)*0.2,0.5-cos(t*0.4)*0.2);float d1=length(u-c1);float d2=length(u-c2);float z1=exp(-d1*3.0);float z2=exp(-d2*4.0);return mix(0.4,1.4,w1*w2*0.3+z1*0.5+z2*0.4);}
float sparkleContribution(vec2 c,vec2 f,float tm,float te,float d){vec2 r=hash22(c);if(r.x>d)return 0.0;vec2 dr=randomDir(r);vec2 ct=fract(r+dr*tm*mix(0.08,0.24,r.x));vec2 df=(c+ct)-f;float sp=exp(-pow(length(df)/mix(0.001,0.1,r.y),10.5));float lf=fract(te*mix(0.5,1.2,r.x)+r.y);float fd=smoothstep(0.0,0.2,lf)*(1.0-smoothstep(0.75,1.0,lf));float gl=smoothstep(0.0,0.05,lf)*(1.0-smoothstep(0.05,0.15,lf));float tw=0.5+0.5*sin(te*0.01*mix(6.0,14.0,r.x)+r.y*6.283);return sp*tw*fd*(1.0+gl*2.5);}
float ovalMask(vec2 u){float b=sin(time*0.8)*0.15;float p=sin(time*1.2)*0.1;vec2 c=areaBounds.xy;vec2 rd=areaBounds.zw;rd.x+=b;rd.y+=p;float a=atan(u.y-c.y,u.x-c.x);float w=sin(a*3.0+time*0.5)*0.05;vec2 df=(u-c)/(rd+w);float dt=length(df);float ft=max(areaFeather,1e-4);float m=1.0-smoothstep(1.0-ft,1.0+ft,dt);return mix(m,1.0-m,clamp(areaInvert,0.0,1.0));}
void main(){vec2 u=gl_FragCoord.xy/resolution.xy;vec2 f=u*vec2(50.0,28.0);vec2 b=floor(f);float tm=time*2.0;float te=time*0.6;float d=densityMap(u,time);float g=0.0;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 cl=b+vec2(float(x),float(y));g+=sparkleContribution(cl,f,tm,te,d);}}float m=ovalMask(u);g=clamp(g*m,0.0,1.0);gl_FragColor=vec4(vec3(1.0)*g,g*0.85);}`);
    }
}