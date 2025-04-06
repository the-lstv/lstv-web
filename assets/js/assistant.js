window._assistantCallback = (app) => {
    window.__assistant = true;

    const container = O("#assistant");

    console.log(app);
    

    O("#assistantButton").on("click", function (){
        if(hidden) show(); else hide();
    })

    container.get(".button-close").on("click", function (){
        hide();
    })

    container.get(".button-fullscren").on("click", function (){
        container.classList.toggle("fullscreen");
    })

    let hidden = true, showTimeout = 0;
    function show(){
        if(!hidden) return;

        // if(showTimeout) clearTimeout(showTimeout);

        // showTimeout = setTimeout(() => {
        container.class("shown");
        // }, 200);

        container.parentElement.removeAttribute("hidden");
        container.get("input").focus();
        hidden = false;
    }

    function hide(){
        container.class("shown", false);
        // container.parentElement.setAttribute("hidden", "");
        hidden = true;
    }

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
            })
    
            // main_shader_renderer.addShaderContext(ShaderSource.animatedNoise(main_shader_renderer.gl), {
            //     iTime: { type: "uniform1f", value: a => [a / 1000] },
            //     iResolution: { type: "uniform2f", value: () => [background_canvas.width, background_canvas.height] },
            //     Alpha: { type: "uniform1f", value: [.25] },
            //     Amount: { type: "uniform1f", value: [800] }
            // })
    
            O("#assistant").appendChild(background_canvas);
            main_shader_renderer.resume();
        }

        container.get(".loading").remove();
        container.get(".content").style.display = "flex";

        container.class("ready");
    }

    if(typeof CombinedShaderRenderer === 'undefined') {
        M.Script("/assets/js/shader.js" + window.cacheKey, (error) => {
            if(error) {
                console.error(error);
                start(false);
                return;
            }

            start(true)
        })
    } else start(true);

};