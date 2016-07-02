"using strict";

/**************************************
*************** UTIL ******************
**************************************/
function getInspectLink($marketListingRow) {
    $marketListingRow.find(".market_actionmenu_button")[0].click();
    var inspectLink =  $('#market_action_popup_itemactions').find('a').attr("href");
    $("#market_action_popup").css('display','none');
    return inspectLink;
}

/**************************************
************** FLOATS *****************
**************************************/
function getFloatValueRegexp(floatvalue){
	floatvalue = parseFloat(floatvalue);
	if (floatvalue > 0.45)
		return /(0\.)(450*)?(.*)/g;
	else if (floatvalue > 0.38)
		return /(0\.)(380*)?(.*)/g;
	else if (floatvalue > 0.15)
		return /(0\.)(150*)?(.*)/g;
	else if (floatvalue > 0.07)
		return /(0\.)(070*)?(.*)/g;
	else
		return /(0\.)(000*)?(.*)/g;
}
function getFloatMax(floatvalue){
	floatvalue = parseFloat(floatvalue);
	if (floatvalue > 0.45)
		return 1;
	else if (floatvalue > 0.38)
		return 0.45;
	else if (floatvalue > 0.15)
		return 0.38
	else if (floatvalue > 0.07)
		return 0.15;
	else
		return 0.07;
}
function generateColoredFloatSpan(floatvalue){
	var floatRegexp = getFloatValueRegexp(floatvalue);
	var match = floatRegexp.exec(floatvalue);
	if (match){
		var $output = $("<span>");
		var rgbValue = parseInt((floatvalue/getFloatMax(floatvalue)) * 180);
		var backgroundValue = "rgb(" + rgbValue + "," + rgbValue + "," + rgbValue +")";
		console.log(backgroundValue);
		$output.css({"background-color": backgroundValue, background:backgroundValue});
			
		$output.append($("<span style='color:#DDD;'></span>").text(match[1]));
		$output.append($("<span style='color:rgb(255, 215, 0);'></span>").text(match[2]));
		$output.append($("<span style='color:#DDD;'></span>").text(match[3]));
		return $output;
	}else{
		console.log('no match');
		console.log(floatRegexp);
		return $("<span>").text(floatvalue);
	}

}

function onGetFloat() {
    if(!steamwizard.isLoggedIn()) {
        ui.showLoginOverlay();
        return;
    }

    var $marketListingRow = $(this.closest('.market_listing_row'));
    var inspectLink = getInspectLink($marketListingRow);
    
    var $getFloatButton = $marketListingRow.find(".steam_wizard_load_button_float").first();
    $getFloatButton.off().text('loading...').addClass('btn_grey_white_innerfade');
	
	steamwizard.getFloatValue(inspectLink, function(result){
		$getFloatButton.empty();
		if (result.status == steamwizard.EVENT_STATUS_DONE){
			$getFloatButton.append(generateColoredFloatSpan(result.floatvalue));
			//$getFloatButton.removeClass('btn_grey_white_innerfade').addClass('btn_blue_white_innerfade');
		}else if (result.status == steamwizard.EVENT_STATUS_FAIL){
			$getFloatButton.text('Failed').addClass('steam_wizard_load_button_failed');
			$getFloatButton.click(onGetFloat);
		}
	});
}

function onGetAllFloats() {
    if(!steamwizard.isLoggedIn()) {
        ui.showLoginOverlay();
        return;
    }

    $('.steam_wizard_load_button_float').each(function(index, value){
        value.click();
    });
}

/**************************************
*********** SCREENSHOTS ***************
**************************************/
function onGetScreenshot() {
    if(!steamwizard.isLoggedIn()) {
        ui.showLoginOverlay();
        return;
    }

    var $marketListingRow = $(this.closest('.market_listing_row'));
	var inspectLink = getInspectLink($marketListingRow);
	
	var $getScreenshotButton = $marketListingRow.find(".steam_wizard_load_button_screenshot").first();
	$getScreenshotButton.off().text('loading...').addClass('btn_grey_white_innerfade');
	
	steamwizard.getScreenshot(inspectLink, function(result){
		if (result.status == steamwizard.EVENT_STATUS_PROGRESS){
			$getScreenshotButton.text(result.msg).addClass('btn_grey_white_innerfade');
		}else if (result.status == steamwizard.EVENT_STATUS_DONE){
			$getScreenshotButton.text('Open Screenshot');
			$getScreenshotButton.removeClass('btn_grey_white_innerfade').addClass('btn_blue_white_innerfade');
			$getScreenshotButton.click(function(){ui.showScreenshotOverlay(result.image_url);});
			$getScreenshotButton[0].click();
		}else if (result.status == steamwizard.EVENT_STATUS_FAIL){
			$getScreenshotButton.text(result.msg).addClass('steam_wizard_load_button_failed');
			$getScreenshotButton.click(onGetScreenshot);
		}
	});
}

function initButtons() {
    $("#searchResultsRows").find(".market_listing_row").each(function(index, marketListingRow) {
        var $marketListingRow = $(marketListingRow);

        //button which gets float
        var $getFloatButton = ui.createGreenSteamButton("Get Float");
        $getFloatButton.click(onGetFloat);
        $getFloatButton.addClass('steam_wizard_load_button_float');
        $marketListingRow.find(".market_listing_item_name").after($getFloatButton);

        //button which gets screenshot
        var $getScreenshotButton = ui.createGreenSteamButton("Get Screen");
        $getScreenshotButton.click(onGetScreenshot);
        $getScreenshotButton.addClass('steam_wizard_load_button_screenshot');
        $getFloatButton.after($getScreenshotButton);
    });

    //button to load all floats
    if ($("#searchResultsRows").find(".market_listing_row").length > 0) {
        var $getAllFloatsButton = ui.createGreenSteamButton("Load All Floats");
        $getAllFloatsButton.addClass('steam_wizard_load_button_float_all');
        $getAllFloatsButton.click(onGetAllFloats);
        $getAllFloatsButton.on('remove', function() {alert('removed');});

        var $container = $(".market_listing_header_namespacer").parent();
        $container.append($getAllFloatsButton);
    }
}

function removeButtons() {
    $("#searchResultsRows").find('.steam_wizard_load_button_float').remove();
    $("#searchResultsRows").find('.steam_wizard_load_button_screenshot').remove();
    $("#searchResultsRows").find('.steam_wizard_load_button_float_all').remove();
}

function start() {
    if(steamwizard.isEnabled())
        initButtons();
     else
        removeButtons();
}

function init() {
    ui.buildScreenshotOverlay();
    ui.buildLoginOverlay(function(e) {
        ui.removeOverlay();
        removeButtons();
        
        /* TODO: LOADING INDICATION */
        steamwizard.login(function() {
            start();
        });
    });

    /* for paging */
    var observer = new MutationObserver(function(mutation) {
        start();
    });
    observer.observe($('#searchResults_start')[0], {characterData: true, subtree: true});

    //remove overlay on escape
    $(document).keyup(function(e) {
        if(e.keyCode === 27)
           ui.removeOverlay();
    });

    steamwizard.onChange(start);
}

/**************************************
*************** INIT ******************
**************************************/
$(document).ready(function() {
        
    /* TODO: LOADING INDICATION */
    steamwizard.ready(function() {
        init();
        start();
    });
});