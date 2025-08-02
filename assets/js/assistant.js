window._assistantCallback = (app) => {
    window.__assistant = true;

    const container = O("#toolbarAssistant");

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