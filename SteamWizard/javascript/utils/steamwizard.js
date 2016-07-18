"using strict";
/*http://stackoverflow.com/a/18405800*/
if (!String.prototype.format) {
	String.prototype.format = function() {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) {
			return typeof args[number] != 'undefined'
				? args[number]
				: match
			;
		});
	};
}

var steamwizard = (function() {
    /* list of functions to be called after we finish initializing */
    var onReadyList = [];
    
    /* list of functions to be called on events */
    var eventListeners = [];
    
    /* is the plugin enabled or disabled */
    var isEnabled = false;
    
    /* did we finish initialization or not */
    var isReady = false;
    
    /* do we have a valid token or not */
    var isLoggedIn = false;
    
    /* api token */
    var token = null;
    
    /* our local storage */
    var storage = {};
    
    /* name must not include "_" */
    var NAMESPACE_SCREENSHOT     = constant.NAMESPACE_SCREENSHOT;
    var NAMESPACE_MARKET_INSPECT = constant.NAMESPACE_MARKET_INSPECT;

    /* port to backend */
    var port = chrome.runtime.connect();        
        
    function validateToken(token) {
        if(token == null)
           return false;

        try {
            var json = JSON.parse(atob(token));
        } catch(e) {
            return false;
        }

        if(json.timestamp == null || new Date().getTime() - json.timestamp > 2 * 24 * 60 * 60 * 1000)
           return false;

        return true;
    }

    function loginCallback(response) {
        if(response.success === true) {
           token = response.token;
           window.localStorage.setItem('steam_wizard_token', response.token);
        }
    }

    function processLogin() {
        /* make sure both services are enabled */
        if(token !== null) {
           csgozone.setToken(token);
           metjm.setToken(token);
           
           csgozone.status(function(response) {
                if(response.success)
                   port.postMessage({msg: "inspectStatus", data: response});
           });
                      
            metjm.status(function(response) {
                if(response.success)
					port.postMessage({msg: "screenshotStatus", data: response});
           });
        }
        
        isLoggedIn = token !== null;
    }
    
    function onMessage(request, port) {
        switch(request.msg) {
            case 'pluginStatus':
                  isEnabled = request.status;
                  broadcaseEvent({msg: 'pluginStatus', status: isEnabled});
                  break;
            case 'newItem':
                  steamwizard.storeItem(request.namespace, request.key, request.value);
                  broadcaseEvent(request);
                  break;
            case 'inspectLimit':
                   broadcaseEvent(request);
                   break;
            case 'inspectStatus':
                   broadcaseEvent(request);
                   break;
		    case 'screenshotStatus':
                   broadcaseEvent(request);
                   break;
        }
    }
    
    function broadcaseEvent(msg) {
        for(var i = 0; i < eventListeners.length; i++)
            eventListeners[i](msg);
    }
    
    function ready() {
        processLogin();
        
        isReady = true;
        
        for(var i=0; i < onReadyList.length; i++)
            onReadyList[i]();
    }

    /* start init */
    function init() {
        token = window.localStorage.getItem('steam_wizard_token');

        if(!validateToken(token)) {
            token = null;
            window.localStorage.removeItem('steam_wizard_token');
        }
        
        /* ask backend for initialization stuff */
	var localListener = function(request, port) {
            switch(request.msg) {
                case 'pluginStatus':
                     isEnabled = request.status;                   
                     break;
                case 'storageResponse':
                     storage[request.namespace] = request.value || {};
                     break;
            }
            
            /* each id maps to a deferred */
            deferredList[request.requestid].resolve();
        };
        
        var deferredList = [$.Deferred(), $.Deferred(), $.Deferred()];
        
        port.onMessage.addListener(localListener);
        port.postMessage({msg: 'getPluginStatus', requestid: 0});
        port.postMessage({msg: 'getStorage', namespace: NAMESPACE_SCREENSHOT, requestid: 1});
        port.postMessage({msg: 'getStorage', namespace: NAMESPACE_MARKET_INSPECT, requestid: 2});

        if(token === null) {
           deferredList.push(csgozone.login(loginCallback));
           deferredList.push(metjm.login(loginCallback));
        }
        
        $.when.apply(null, deferredList).then(function() {
            port.onMessage.removeListener(localListener);
            port.onMessage.addListener(onMessage);
            console.log(storage);
            console.log(Object.keys(storage['marketinspect']).length);
            ready();
        });
    }

    init();
    
    return {
        EVENT_STATUS_PROGRESS: 1,
        EVENT_STATUS_DONE: 2,
        EVENT_STATUS_FAIL: 3,
        
        /* JQUERY STYLE */
        ready: function(callback) {
            if(isReady)
               callback();
            else 
               onReadyList.push(callback);
        },
        
        addEventListener: function(callback) {
            if(eventListeners.indexOf(callback) > -1)
               return;
            
            eventListeners.push(callback);
        },
        
        isEnabled: function() {
            return isEnabled;
        },
        
        isLoggedIn: function() {
            return isLoggedIn;
        },
        
        revokeToken: function() {
            token = null;
            window.localStorage.removeItem('steam_wizard_token');
            isLoggedIn = false;
        },
        
        login: function(callback) {
            $.when(csgozone.login(loginCallback), metjm.login(loginCallback)).then(function() {
                processLogin();
                callback();
            });
        },
		
        storeItem: function(namespace, key, value, notifyBackground) {
            if (!storage[namespace])
                 storage[namespace] = {};
             
            storage[namespace][key] = value;
            
            if(notifyBackground)
               port.postMessage({msg: 'storeItem', namespace: namespace, key: key, value: value});
        },
            
        getScreenshot: function(inspectLink, callback) {
            metjm.requestScreenshot(inspectLink, function(result){
                if (result.success) {
                    if(result.result.status == metjm.STATUS_QUEUE){
                        callback({status: steamwizard.EVENT_STATUS_PROGRESS , msg: 'Queue: ' + result.result.place_in_queue});
                    }else if (result.result.status == metjm.STATUS_DONE){
			steamwizard.storeItem(NAMESPACE_SCREENSHOT, util.getAssetID(inspectLink), result.result.image_url, true);
                        callback({status: steamwizard.EVENT_STATUS_DONE , image_url: result.result.image_url});
                    }else{
                        callback({status: steamwizard.EVENT_STATUS_FAIL , msg:'Failed'});
                    }
                } else {
                    callback({status: steamwizard.EVENT_STATUS_FAIL , msg:'Failed'});

                    if(result.bad_token)
                       steamwizard.revokeToken();
                }
            });
        },
		
        getFloatValue: function(inspectLink, callback) {
            csgozone.market(inspectLink, function(data) {
                if(data.success === true) {
                    steamwizard.storeItem(NAMESPACE_MARKET_INSPECT, util.getAssetID(inspectLink), data, true);
                    callback({status: steamwizard.EVENT_STATUS_DONE , data: data});
                    port.postMessage({msg: 'inspectUsage', amount: 1});
                } else {
                   callback({status: steamwizard.EVENT_STATUS_FAIL , msg:'Failed'});
                   if(data.bad_token)
                      steamwizard.revokeToken();
                }
            });
        },
		
        getFloatValueCachedFromAssetid : function(assetid){
                return storage[NAMESPACE_MARKET_INSPECT][assetid];
        },
		
        getFloatValueCached : function(inspectLink){
            var assetid = util.getAssetID(inspectLink);
            return storage[NAMESPACE_MARKET_INSPECT][assetid];
        },
		
		getScreenshotCachedFromAssetid : function(assetid){
			return storage[NAMESPACE_SCREENSHOT][assetid];
		},
		
        getScreenshotCached : function(inspectLink){
            var assetid = util.getAssetID(inspectLink);
            return storage[NAMESPACE_SCREENSHOT][assetid];
        },
    };
})();
