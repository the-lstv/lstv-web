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
}

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
            alpha: false,
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

        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        // gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
}