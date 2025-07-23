// LSTV.Auth.js (to be included in all your frontend projects)
const LSTV = (() => {
    // const iframeOrigin = 'https://auth.extragon.cloud';
    const iframeOrigin = 'http://auth.extragon.localhost';
    const iframeURL = `${iframeOrigin}/bridge.html`;

    let iframe;
    let ready = false;
    const callbacks = [];

    function init() {
        if (iframe) return;

        iframe = document.createElement('iframe');
        iframe.src = iframeURL;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        window.addEventListener('message', e => {
            if (e.origin !== iframeOrigin) return;
            const { id, token, error } = e.data;
            const cb = callbacks.find(c => c.id === id);
            if (cb) {
                if (token) cb.resolve(token);
                else cb.reject(error);
                callbacks.splice(callbacks.indexOf(cb), 1);
            }
        });

        ready = true;
    }

    function getToken() {
        return new Promise((resolve, reject) => {
            if (!ready) init();

            const id = Math.random().toString(36).slice(2);
            callbacks.push({ id, resolve, reject });

            iframe.contentWindow.postMessage({ action: 'getToken', id }, iframeOrigin);
        });
    }

    return {
        getToken
    };
})();
