/**
 * Environment loader.
 */

class Environment {
    // Global environment variables
    env = {}

    #k;

    setEnv(n, v) {
        this.env[n] = v;
    }

    async resolvePath(k, pathv = this.#k.env.PATH) {
        for(const s of pathv.split(":")) {
            const rd = await this.#k.fileSystem.readDir(s);
            for(const ent of rd) if(k === ent) return RootFs.join(s, ent);
        }
        return null;
    }

    constructor(k) {
        // if(!(k instanceof Kernel)) throw new Error("Invalid instance of Kernel provided");
        if(!k.isKernel) throw new Error("Invalid instance of Kernel provided");

        this.#k = k;

        this.setEnv("SHELL", "/bin/bash");
        this.setEnv("HOSTNAME", k.sys.uname().nodename);
        this.setEnv("PATH", "/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin");
    }

    init() {
        app.desktop = new LiDesktop({ limited: !isDesktopModeEnabledAtStartup });
    }
}

export { Environment }