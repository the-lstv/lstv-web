addEventListener("load", () => {
    class RecourserSession {
        constructor() {
            this.sessionData = {
                path: location.pathname,
                host: location.host,
                agent: navigator.userAgent,
                mouse: [],
                clicks: [],
                ip: null,
                key: "",
                start: Date.now(),
                id: M.GlobalID,
                pings: 0
            }

            addEventListener("click", () => {
                this.sessionData.clicks.push([M.x, M.y, O(".page.active").scrollTop])
            })

            addEventListener("keypress", event => {
                this.sessionData.key += event.key
            })

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
    
            this.getIP()
            setTimeout(ping, current_interval)
        }
    
        getIP(){
            fetch('https://api.ipify.org')
                .then(response => response.text())
                .then(data => {
                    this.sessionData.ip = data
                })
        }
    
        send(){
            this.sessionData.end = Date.now()
            console.log("[beacon] Sending ping.");
            navigator.sendBeacon('/recourser', JSON.stringify(this.sessionData));
            this.sessionData.pings++
        }
    }
    
    session = new RecourserSession
})

let session