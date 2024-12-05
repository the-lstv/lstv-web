addEventListener("load", () => {
    class RecourserSession {
        constructor() {
            this.sessionData = {
                path: location.pathname,
                host: location.host,
                agent: navigator.userAgent,
                start: Date.now(),
                id: M.GlobalID
            }

            addEventListener('beforeunload', () => {
                this.sessionData.quitNaturally = true
                this.send()
            })

            let max_pings = 10, current_pings = 0, current_interval = 5000;

            let _this = this;
            
            function ping(){
                _this.send()

                current_pings++
                current_interval += 5000
    
                if(current_pings < max_pings) setTimeout(ping, current_interval)
            }

            setTimeout(ping, current_interval)
        }
    
        send(){
            console.log("[beacon] Sending ping.");
            navigator.sendBeacon('/ping', JSON.stringify(this.sessionData));
        }
    }
    
    session = new RecourserSession
})

let session