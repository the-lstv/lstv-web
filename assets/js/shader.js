class ShaderContext {
    constructor(gl, source) {
        this.gl = gl;
        this.source = source
        this.program = this.createProgram()
        this.uniformLocations = {};
        this.positionAttribute = -1;
    }

    createProgram() {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, this.source.vertexShader);
        this.gl.attachShader(program, this.source.fragmentShader);
        this.gl.linkProgram(program);

        // if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        //     console.error('Program linking error:', this.gl.getProgramInfoLog(program));
        //     return null;
        // }

        return program;
    }

    getUniformLocation(name) {
        if (!(name in this.uniformLocations)) {
            this.uniformLocations[name] = this.gl.getUniformLocation(this.program, name);
        }
        return this.uniformLocations[name];
    }

    getPositionAttribute() {
        if (this.positionAttribute === -1) {
            this.positionAttribute = this.gl.getAttribLocation(this.program, 'a_position');
        }
        return this.positionAttribute;
    }
}

class CombinedShaderRenderer extends LS.Util.FrameScheduler {
    constructor(canvas, dimensions = { width: 512, height: 512 }, options = {}) {
        super(null, options);

        this.callback = this.render.bind(this);

        this.width = dimensions.width;
        this.height = dimensions.height;
        canvas.width = this.width;
        canvas.height = this.height;

        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            // premultipliedAlpha: false,
            // antialias: true,
        });

        if (!this.gl) {
            // console.error('WebGL2 not supported, trying WebGL 1.0');
            
            // this.gl = canvas.getContext('webgl', {
            //     alpha: true,
            //     // premultipliedAlpha: false,
            //     // antialias: true,
            // });
            
            if(!this.gl) {
                console.error('WebGL not supported, can\'t draw shaders.');
                super.destroy();
                this.supported = false;
                this.gl = null;
                return;
            }
        }

        this.supported = true;

        this.canvas = canvas;
        this.shaders = [];
        this.uniforms = [];
        this.qualityReduction = 1;
        this.paused = true;

        this.frame = this.render.bind(this);
    }

    compileShader(vertexShader, fragmentShader){
        return new ShaderSource(this.gl, vertexShader, fragmentShader)
    }

    addShaderContext(source, uniforms){
        this.shaders.push(new ShaderContext(this.gl, source))
        this.uniforms.push(uniforms || {});
    }

    render(delta, time) {
        if(!this.gl) return;

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

            // Set uniforms
            for (const [name, { type, value }] of Object.entries(uniforms)) {
                const location = shaderContext.getUniformLocation(name);
                const uniformValue = typeof value === 'function' ? value(time) : value;
                gl[type](location, ...uniformValue);
            }

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
    }

    resize(width = this.width, height = this.height) {
        this.width = Math.max(128, width) - (64 * this.qualityReduction);
        this.height = Math.max(128, height) - (64 * this.qualityReduction);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    destroy() {
        // Stop animation
        this.stop();

        const gl = this.gl;
        if (!gl) return;

        // Delete shaders and programs
        this.shaders.forEach((shaderContext) => {
            if (shaderContext.program) {
                // Detach and delete shaders
                if (shaderContext.source.vertexShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.vertexShader);
                    // gl.deleteShader(shaderContext.source.vertexShader);
                }
                if (shaderContext.source.fragmentShader) {
                    gl.detachShader(shaderContext.program, shaderContext.source.fragmentShader);
                    // gl.deleteShader(shaderContext.source.fragmentShader);
                }
                gl.deleteProgram(shaderContext.program);
            }
        });

        // Clear arrays
        this.shaders = null;
        this.uniforms = null;

        super.destroy();
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

        // if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        //     console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
        //     this.gl.deleteShader(shader);
        //     return null;
        // }

        return shader;
    }

    // Fullscreen triangle vertex
    static gl2_vertex = `#version 300 es

out vec2 uv;

uniform vec2 uResolution;

const vec2 positions[3] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 3.0, -1.0),
    vec2(-1.0,  3.0)
);

void main() {
    vec2 pos = positions[gl_VertexID];
    gl_Position = vec4(pos, 0.0, 1.0);
    uv = (pos * 0.5 + 0.5) * uResolution;
    uv.y = uResolution.y - uv.y;
}`;
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

    static blurredColors(gl){return new ShaderSource(gl,ShaderSource.gl2_vertex,`#version 300 es
// Created by inigo quilez - iq/2014
// Ported to WebGL2
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
precision highp float;uniform vec2 u_resolution,u_mouse;uniform float u_time,alpha,u_blur,u_animate_speed,u_frequency;uniform vec4 u_colors[4];uniform bool u_animate;out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return .5+.5*mix(mix(dot(-1.+2.*hash(i),f),dot(-1.+2.*hash(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(-1.+2.*hash(i+vec2(0,1)),f-vec2(0,1)),dot(-1.+2.*hash(i+vec2(1)),f-1.),u.x),u.y);}
vec3 ok(vec3 a,vec3 b,float t){const mat3 A=mat3(.412165612,.211859107,.088309795,.536275208,.680718958,.281847417,.051457565,.107406579,.630261362),B=mat3(4.076724529,-1.268143773,-.004111989,-3.307216883,2.609332323,-.703476309,.230759054,-.341134429,1.706862569);vec3 x=pow(A*a,vec3(1./3.)),y=pow(A*b,vec3(1./3.));x=mix(x,y,t);return B*(x*x*x);}
vec4 ok(vec4 a,vec4 b,float t){return vec4(ok(a.rgb,b.rgb,t),mix(a.a,b.a,t));}
void main(){vec2 u=gl_FragCoord.xy/u_resolution,p=u-.5;float r=u_resolution.x/u_resolution.y,s=u_animate?u_time*10.*u_animate_speed:0.,d=noise(vec2(s*.01,p.x*p.y));p.y/=r;float a=(d-.5)*720.*.01745329252+3.141592654,c=cos(a),q=sin(a);p*=mat2(c,-q,q,c);p.y*=r;float f=20.*u_frequency,A=300.*(.01+u_blur);p.x+=sin(p.y*f+s)/A;p.y+=sin(p.x*f*1.5+s)/(A*.5);float t=S(-.3,.2,(p*mat2(.9961947,.08715574,-.08715574,.9961947)).x);vec4 a1=ok(u_colors[0],u_colors[1],t),a2=ok(u_colors[2],u_colors[3],t),z=ok(a1,a2,S(.5,-.3,p.y));fragColor=vec4(z.rgb,z.a*alpha);}`);
    }

    static sparkles(gl){return new ShaderSource(gl,ShaderSource.gl2_vertex,`#version 300 es
// Created by thelstv - 2025
// Inspired by PS3 XMB
precision mediump float;uniform vec2 resolution;uniform float time,areaFeather,areaInvert;uniform vec4 areaBounds;out vec4 fragColor;
vec2 h(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(vec2(p.x*p.y,p.x+p.y));}
vec2 d(vec2 r){vec2 p=r-.5,l=vec2(length(p));return l.x<.001?vec2(0,1):p/l.x;}
float D(vec2 u,float t){float w=(sin(u.x*3.+t*.5)*.5+.5)*(sin(u.y*4.-t*.3)*.5+.5)*.3;vec2 a=vec2(.5+sin(t*.4)*.3,.5+cos(t*.3)*.3),b=vec2(.5-sin(t*.5)*.2,.5-cos(t*.4)*.2);return mix(.4,1.4,w+exp(-length(u-a)*3.)*.5+exp(-length(u-b)*4.)*.4);}
float C(vec2 c,vec2 f,float m,float e,float n){vec2 r=h(c);if(r.x>n)return 0.;vec2 q=d(r),p=fract(r+q*m*mix(.08,.24,r.x)),v=c+p-f;float s=exp(-pow(length(v)/mix(.001,.1,r.y),10.5)),l=fract(e*mix(.5,1.2,r.x)+r.y),F=smoothstep(0.,.2,l)*(1.-smoothstep(.75,1.,l)),G=smoothstep(0.,.05,l)*(1.-smoothstep(.05,.15,l)),T=.5+.5*sin(e*.01*mix(6.,14.,r.x)+r.y*6.2831853);return s*T*F*(1.+G*2.5);}
float M(vec2 u){float b=sin(time*.8)*.15,p=sin(time*1.2)*.1;vec2 c=areaBounds.xy,r=areaBounds.zw+vec2(b,p);float a=atan(u.y-c.y,u.x-c.x),w=sin(a*3.+time*.5)*.05,x=length((u-c)/(r+w)),f=max(areaFeather,1e-4),m=1.-smoothstep(1.-f,1.+f,x);return mix(m,1.-m,clamp(areaInvert,0.,1.));}
void main(){vec2 u=gl_FragCoord.xy/resolution,f=u*vec2(50.,28.),b=floor(f);float m=time*2.,e=time*.6,n=D(u,time),g=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)g+=C(b+vec2(x,y),f,m,e,n);g=clamp(g*M(u),0.,1.);fragColor=vec4(g,g,g,g*.85);}`);
}
    }

window.CombinedShaderRenderer = CombinedShaderRenderer;
window.ShaderSource = ShaderSource;
window.ShaderContext = ShaderContext;